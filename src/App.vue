<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useDebounceFn, useDropZone, useFileDialog } from '@vueuse/core'
import { SwitchRoot, SwitchThumb, TabsContent, TabsList, TabsRoot, TabsTrigger } from 'reka-ui'
import {
  ArrowRight,
  Check,
  ChevronDown,
  CircleAlert,
  CloudUpload,
  Code2,
  Eye,
  FileArchive,
  FileDown,
  FileText,
  KeyRound,
  Layers3,
  LoaderCircle,
  PanelLeft,
  Play,
  RefreshCw,
  Sparkles,
  TerminalSquare,
  WandSparkles,
  X,
} from '@lucide/vue'
import { AnthropicBrowserProvider } from '@/lib/ai'
import { createProjectZip, downloadBlob, slugify } from '@/lib/export'
import { generateMarkdown, parseOutline, updateMarkdownHeadmatter } from '@/lib/markdown'
import { createProjectFiles } from '@/lib/project'
import { useWebContainer } from '@/composables/useWebContainer'
import type { DeckConfig, ExtractedPdf, GeneratedDeck } from '@/types/deck'

type WorkStatus = 'idle' | 'extracting' | 'ready' | 'generating' | 'generated' | 'error'

const config = reactive<DeckConfig>({
  title: '',
  theme: 'seriph',
  density: 'balanced',
  tone: 'executive',
  includeNotes: true,
  preserveSourceReferences: true,
})
const pdf = ref<ExtractedPdf>()
const deck = ref<GeneratedDeck>()
const markdown = ref('')
const apiKey = ref('')
const showKey = ref(false)
const status = ref<WorkStatus>('idle')
const error = ref('')
const progress = ref({ current: 0, total: 0 })
const editorTab = ref('markdown')
const dropZone = ref<HTMLElement>()
const isDraggingOver = ref(false)
const showTerminal = ref(false)
const hasManualEdits = ref(false)

const preview = useWebContainer()
const outline = computed(() => markdown.value ? parseOutline(markdown.value) : [])
const assets = computed<Record<string, Uint8Array>>(() => {
  const result: Record<string, Uint8Array> = {}
  const cover = pdf.value?.coverPng
  if (cover) result['source-cover.png'] = cover
  return result
})
const coverDataUrl = computed(() => {
  const bytes = pdf.value?.coverPng
  if (!bytes) return ''
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192))
  }
  return `data:image/png;base64,${btoa(binary)}`
})
const projectFiles = computed(() => createProjectFiles(markdown.value, config, assets.value))
const canGenerate = computed(() => Boolean(pdf.value) && status.value !== 'generating' && status.value !== 'extracting')
const isPreviewBusy = computed(() => ['booting', 'installing', 'starting'].includes(preview.status.value))

const { open: openFileDialog, onChange } = useFileDialog({ accept: 'application/pdf', multiple: false })
onChange((files) => {
  const file = files?.item(0)
  if (file) void loadPdf(file)
})

useDropZone(dropZone, {
  onDrop(files) {
    isDraggingOver.value = false
    const file = files?.[0]
    if (file) void loadPdf(file)
  },
  onOver: () => { isDraggingOver.value = true },
  onLeave: () => { isDraggingOver.value = false },
  dataTypes: ['application/pdf'],
  multiple: false,
  preventDefaultForUnhandled: true,
})

async function loadPdf(file: File) {
  error.value = ''
  status.value = 'extracting'
  progress.value = { current: 0, total: 0 }
  deck.value = undefined
  markdown.value = ''
  try {
    const { extractPdf } = await import('@/lib/pdf')
    pdf.value = await extractPdf(file, (current, total) => { progress.value = { current, total } })
    if (!config.title) config.title = file.name.replace(/\.pdf$/i, '')
    status.value = 'ready'
  } catch (cause) {
    pdf.value = undefined
    status.value = 'error'
    error.value = cause instanceof Error ? cause.message : 'The PDF could not be processed.'
  }
}

async function generateDeck() {
  if (!pdf.value) return
  error.value = ''
  if (!apiKey.value.trim()) {
    error.value = 'Add your Anthropic API key. It stays in this browser tab and is sent directly to Anthropic.'
    return
  }
  status.value = 'generating'
  try {
    const provider = new AnthropicBrowserProvider(apiKey.value)
    deck.value = await provider.generateDeck({ pdf: pdf.value, config })
    if (!config.title.trim()) config.title = deck.value.title
    markdown.value = generateMarkdown(deck.value, config)
    hasManualEdits.value = false
    status.value = 'generated'
  } catch (cause) {
    status.value = 'error'
    error.value = cause instanceof Error ? cause.message : 'Deck generation failed. Try again.'
  }
}

function onMarkdownInput(event: Event) {
  markdown.value = (event.target as HTMLTextAreaElement).value
  hasManualEdits.value = true
}

const syncPreview = useDebounceFn(async () => {
  if (preview.status.value === 'ready' && markdown.value) await preview.update(projectFiles.value)
}, 500)

watch(config, () => {
  if (!markdown.value) return
  markdown.value = updateMarkdownHeadmatter(markdown.value, config)
  void syncPreview()
}, { deep: true })

watch(markdown, () => { void syncPreview() })

async function startPreview() {
  error.value = ''
  try {
    await preview.start(projectFiles.value)
  } catch {
    // The preview composable exposes a user-facing error and retry state.
  }
}

function downloadMarkdown() {
  downloadBlob(new Blob([markdown.value], { type: 'text/markdown;charset=utf-8' }), `${slugify(config.title)}-slides.md`)
}

async function downloadProject() {
  const zip = await createProjectZip(projectFiles.value)
  downloadBlob(zip, `${slugify(config.title)}-slidev.zip`)
}

function resetPdf() {
  pdf.value = undefined
  deck.value = undefined
  markdown.value = ''
  status.value = 'idle'
  error.value = ''
  config.title = ''
}
</script>

<template>
  <div class="app-shell">
    <header class="topbar">
      <a class="brand" href="#" aria-label="Decksmith home">
        <span class="brand-mark"><Layers3 :size="18" :stroke-width="2.2" /></span>
        <span>decksmith</span>
        <span class="version-pill">BETA</span>
      </a>
      <div class="topbar-center">
        <span v-if="pdf" class="file-chip"><FileText :size="14" />{{ pdf.fileName }}<button aria-label="Remove PDF" @click="resetPdf"><X :size="13" /></button></span>
        <span v-else class="privacy-note"><span class="privacy-dot"></span>Files stay in your browser</span>
      </div>
      <div class="topbar-actions">
        <button class="icon-button" aria-label="Toggle sidebar"><PanelLeft :size="18" /></button>
        <button class="secondary-button" :disabled="!markdown" @click="downloadMarkdown"><FileDown :size="16" />Markdown</button>
        <button class="primary-button compact" :disabled="!markdown" @click="downloadProject"><FileArchive :size="16" />Export project</button>
      </div>
    </header>

    <main class="workspace" :class="{ 'is-empty': !pdf }">
      <aside class="flow-rail">
        <div class="rail-label">WORKFLOW</div>
        <ol class="steps">
          <li class="step active">
            <span class="step-number"><Check v-if="pdf" :size="13" /><span v-else>1</span></span>
            <div><strong>Source PDF</strong><small>{{ pdf ? `${pdf.pageCount} pages extracted` : 'Upload your document' }}</small></div>
          </li>
          <li class="step" :class="{ active: pdf }">
            <span class="step-number">2</span>
            <div><strong>AI rewrite</strong><small>Shape the narrative</small></div>
          </li>
          <li class="step" :class="{ active: markdown }">
            <span class="step-number">3</span>
            <div><strong>Edit & configure</strong><small>Refine your deck</small></div>
          </li>
          <li class="step" :class="{ active: preview.status.value === 'ready' }">
            <span class="step-number">4</span>
            <div><strong>Preview & export</strong><small>Run the real project</small></div>
          </li>
        </ol>

        <div class="rail-divider"></div>
        <div class="rail-label">DECK SETTINGS</div>
        <div class="settings-stack">
          <label class="field-label">Title<input v-model="config.title" placeholder="Untitled deck" /></label>
          <label class="field-label">Theme
            <span class="select-wrap"><select v-model="config.theme"><option value="seriph">Seriph</option><option value="default">Default</option><option value="apple-basic">Apple Basic</option></select><ChevronDown :size="14" /></span>
          </label>
          <div class="field-label">Layout density
            <div class="segmented"><button v-for="density in ['airy', 'balanced', 'dense']" :key="density" :class="{ selected: config.density === density }" @click="config.density = density as DeckConfig['density']">{{ density }}</button></div>
          </div>
          <label class="field-label">Tone
            <span class="select-wrap"><select v-model="config.tone"><option value="executive">Executive</option><option value="educational">Educational</option><option value="persuasive">Persuasive</option><option value="conversational">Conversational</option></select><ChevronDown :size="14" /></span>
          </label>
          <div class="switch-row"><span><strong>Speaker notes</strong><small>Write presenter cues</small></span><SwitchRoot v-model="config.includeNotes" class="switch-root"><SwitchThumb class="switch-thumb" /></SwitchRoot></div>
          <div class="switch-row"><span><strong>Source references</strong><small>Keep original page links</small></span><SwitchRoot v-model="config.preserveSourceReferences" class="switch-root"><SwitchThumb class="switch-thumb" /></SwitchRoot></div>
        </div>

        <div class="rail-footer"><KeyRound :size="14" /><span>Bring-your-own key<br /><small>Never stored or proxied</small></span></div>
      </aside>

      <section v-if="!pdf" class="empty-stage">
        <div class="hero-copy">
          <div class="eyebrow"><Sparkles :size="14" />PDF → REAL SLIDEV PROJECT</div>
          <h1>Turn documents into<br /><em>decks worth sharing.</em></h1>
          <p>Drop in a PDF. AI finds the story, writes the slides, and spins up a live Slidev project—right in your browser.</p>
        </div>

        <div ref="dropZone" class="drop-card" :class="{ dragging: isDraggingOver }" @click="openFileDialog()">
          <div class="upload-orbit"><CloudUpload :size="27" /></div>
          <strong>Drop your PDF here</strong>
          <span>or click to browse</span>
          <small>PDF · MAX 25 MB · UP TO 80 PAGES</small>
        </div>

        <div v-if="status === 'extracting'" class="inline-status"><LoaderCircle class="spin" :size="17" />Extracting page {{ progress.current }} of {{ progress.total || '…' }}</div>
        <div v-if="error" class="error-banner"><CircleAlert :size="17" />{{ error }}</div>

        <div class="feature-strip">
          <div><span class="feature-icon"><WandSparkles :size="18" /></span><span><strong>Topic-aware rewrite</strong><small>Splits ideas, not pages</small></span></div>
          <div><span class="feature-icon"><Code2 :size="18" /></span><span><strong>Editable Markdown</strong><small>Slidev-native output</small></span></div>
          <div><span class="feature-icon"><Play :size="18" /></span><span><strong>Live project preview</strong><small>Powered by WebContainers</small></span></div>
        </div>
      </section>

      <template v-else>
        <section class="editor-panel">
          <div v-if="!markdown" class="generation-stage">
            <div class="source-summary">
              <div class="pdf-cover">
                <img v-if="coverDataUrl" :src="coverDataUrl" alt="PDF first page preview" />
                <FileText v-else :size="30" />
              </div>
              <div><span>SOURCE READY</span><h2>{{ pdf.fileName }}</h2><p>{{ pdf.pageCount }} pages · {{ pdf.pages.reduce((sum, page) => sum + page.characterCount, 0).toLocaleString() }} extracted characters</p></div>
              <span class="ready-check"><Check :size="16" /></span>
            </div>

            <div class="generation-copy"><span class="eyebrow"><WandSparkles :size="14" />AI REWRITE</span><h1>Shape the source into a story.</h1><p>Decksmith groups related ideas, breaks up dense pages, and returns validated slide data before writing Markdown.</p></div>

            <div class="key-card">
              <label><span>Anthropic API key</span><small>Used directly from this tab. It is never saved.</small></label>
              <div class="key-input"><KeyRound :size="16" /><input v-model="apiKey" :type="showKey ? 'text' : 'password'" placeholder="sk-ant-api03-…" autocomplete="off" /><button :aria-label="showKey ? 'Hide API key' : 'Show API key'" @click="showKey = !showKey"><Eye :size="16" /></button></div>
            </div>
            <div v-if="error" class="error-banner"><CircleAlert :size="17" />{{ error }}</div>
            <button class="generate-button" :disabled="!canGenerate" @click="generateDeck">
              <LoaderCircle v-if="status === 'generating'" class="spin" :size="19" />
              <WandSparkles v-else :size="19" />
              {{ status === 'generating' ? 'Rewriting your document…' : 'Generate Slidev deck' }}
              <ArrowRight v-if="status !== 'generating'" :size="18" />
            </button>
          </div>

          <TabsRoot v-else v-model="editorTab" class="editor-tabs">
            <div class="panel-header">
              <TabsList class="tab-list"><TabsTrigger value="markdown"><Code2 :size="15" />Markdown</TabsTrigger><TabsTrigger value="outline"><Layers3 :size="15" />Outline <span>{{ outline.length }}</span></TabsTrigger></TabsList>
              <div class="edit-state"><span class="live-dot"></span>{{ hasManualEdits ? 'Edited' : 'Generated' }}</div>
            </div>
            <TabsContent value="markdown" class="markdown-pane"><textarea :value="markdown" spellcheck="false" aria-label="Slidev markdown editor" @input="onMarkdownInput"></textarea></TabsContent>
            <TabsContent value="outline" class="outline-pane"><button v-for="item in outline" :key="item.index"><span>{{ String(item.index + 1).padStart(2, '0') }}</span><strong>{{ item.title }}</strong><ArrowRight :size="14" /></button></TabsContent>
          </TabsRoot>
        </section>

        <section class="preview-panel">
          <div class="panel-header">
            <div class="preview-title"><span class="preview-icon"><Play :size="14" fill="currentColor" /></span><span><strong>Live Slidev</strong><small>WebContainer runtime</small></span></div>
            <div class="preview-actions">
              <button v-if="preview.terminal.value.length" class="icon-button" aria-label="Toggle terminal log" @click="showTerminal = !showTerminal"><TerminalSquare :size="16" /></button>
              <button class="secondary-button" :disabled="!markdown || isPreviewBusy" @click="startPreview"><RefreshCw v-if="preview.status.value === 'ready'" :size="15" /><Play v-else :size="15" />{{ preview.status.value === 'ready' ? 'Sync preview' : 'Start preview' }}</button>
            </div>
          </div>
          <div class="preview-canvas">
            <iframe
              v-if="preview.url.value"
              :src="preview.url.value"
              title="Live Slidev preview"
              allow="fullscreen"
              allowfullscreen
            ></iframe>
            <div v-else class="preview-placeholder">
              <div class="preview-illustration"><div></div><span><Play :size="23" fill="currentColor" /></span></div>
              <h3>{{ isPreviewBusy ? 'Building the real Slidev project…' : 'Preview in a browser-native runtime' }}</h3>
              <p>{{ markdown ? preview.message.value : 'Generate your deck, then start an isolated Slidev development server here.' }}</p>
              <button v-if="markdown && !isPreviewBusy" class="primary-button" @click="startPreview"><Play :size="16" />Start live preview</button>
              <div v-if="isPreviewBusy" class="progress-line"><span></span></div>
            </div>
            <div v-if="showTerminal" class="terminal-drawer"><div><span>WEBContainer output</span><button @click="showTerminal = false"><X :size="14" /></button></div><pre>{{ preview.terminal.value.join('\n') }}</pre></div>
          </div>
          <div class="preview-status" :class="preview.status.value"><span></span>{{ preview.message.value }}</div>
        </section>
      </template>
    </main>
  </div>
</template>
