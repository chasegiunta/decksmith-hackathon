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
  <div class="app-surface min-h-screen bg-canvas text-ink">
    <header class="glass-chrome grid h-[68px] grid-cols-[292px_1fr_auto] items-center border-b border-line bg-canvas/90 px-[22px] backdrop-blur-xl max-[1050px]:grid-cols-[245px_1fr_auto] max-[780px]:sticky max-[780px]:top-0 max-[780px]:z-20 max-[780px]:grid-cols-[1fr_auto]">
      <a class="inline-flex items-center gap-2.5 text-[18px] font-bold tracking-[-0.03em] text-ink no-underline" href="#" aria-label="Decksmith home">
        <span class="grid size-8 place-items-center rounded-[9px] bg-acid text-canvas shadow-[0_0_28px_rgba(201,240,113,.12)]"><Layers3 :size="19" :stroke-width="2.2" /></span>
        <span>decksmith</span>
        <span class="ml-0.5 rounded-[5px] border border-[#3c4238] px-1.5 py-1 font-mono text-[10px] leading-none font-semibold tracking-[0.12em] text-[#8f9788]">BETA</span>
      </a>

      <div class="flex justify-center max-[1050px]:hidden">
        <span v-if="pdf" class="inline-flex items-center gap-2 rounded-lg border border-line bg-[#171a16] px-3 py-2 text-[13px] text-[#a8ada4]">
          <FileText :size="15" />{{ pdf.fileName }}
          <button class="ml-0.5 grid cursor-pointer place-items-center text-[#737970] transition-transform duration-150 ease-snappy active:scale-[.92] motion-reduce:transition-none" aria-label="Remove PDF" @click="resetPdf"><X :size="14" /></button>
        </span>
        <span v-else class="inline-flex items-center gap-2 text-[13px] text-[#858b81]"><span class="size-1.5 rounded-full bg-mint shadow-[0_0_0_3px_rgba(118,213,170,.08)]"></span>Files stay in your browser</span>
      </div>

      <div class="flex items-center gap-2">
        <button class="grid size-9 cursor-pointer place-items-center rounded-lg border border-[#343931] bg-[#1a1e19] text-[#a1a79c] transition-[transform,background-color,border-color] duration-150 ease-snappy hover:border-[#555d50] hover:bg-[#20241f] active:scale-[.96] motion-reduce:transition-none max-[780px]:hidden" aria-label="Toggle sidebar"><PanelLeft :size="19" /></button>
        <button class="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#343931] bg-[#1a1e19] px-3.5 text-[13px] font-semibold text-[#c6cabf] transition-[transform,background-color,border-color] duration-150 ease-snappy hover:border-[#555d50] hover:bg-[#20241f] active:scale-[.97] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none max-[780px]:hidden" :disabled="!markdown" @click="downloadMarkdown"><FileDown :size="17" />Markdown</button>
        <button class="inline-flex h-9 min-w-[132px] cursor-pointer items-center justify-center gap-2 rounded-lg border border-acid bg-acid px-3.5 text-[13px] font-bold text-canvas transition-[transform,background-color] duration-150 ease-snappy hover:bg-[#d4f589] active:scale-[.97] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none" :disabled="!markdown" @click="downloadProject"><FileArchive :size="17" />Export project</button>
      </div>
    </header>

    <main
      class="grid h-[calc(100vh-68px)] max-[780px]:h-auto max-[780px]:min-h-[calc(100vh-68px)] max-[780px]:grid-cols-1"
      :class="pdf ? 'grid-cols-[264px_minmax(400px,1fr)_minmax(460px,1.15fr)] max-[1050px]:grid-cols-[230px_minmax(350px,1fr)_minmax(380px,1fr)]' : 'grid-cols-[264px_1fr] max-[1050px]:grid-cols-[230px_1fr]'"
    >
      <aside class="glass-chrome flex min-h-0 flex-col overflow-y-auto border-r border-line bg-[#141713]/85 px-5 py-7 backdrop-blur-lg max-[780px]:hidden">
        <div class="mx-2 mb-4 font-mono text-[10px] leading-tight font-bold tracking-[0.15em] text-[#747a70]">WORKFLOW</div>
        <ol class="m-0 grid list-none gap-1.5 p-0">
          <li class="relative flex min-h-14 items-center gap-3 rounded-lg bg-white/[.025] p-2.5 text-[#d4d8cf] [&:not(:last-child)]:after:absolute [&:not(:last-child)]:after:top-11 [&:not(:last-child)]:after:left-[21px] [&:not(:last-child)]:after:h-[17px] [&:not(:last-child)]:after:w-px [&:not(:last-child)]:after:bg-[#30342e] [&:not(:last-child)]:after:content-['']">
            <span class="grid size-6 shrink-0 place-items-center rounded-full border font-mono text-[11px] leading-none font-semibold" :class="pdf ? 'border-acid bg-acid text-canvas' : 'border-[#6f7967] text-acid'"><Check v-if="pdf" :size="14" /><span v-else>1</span></span>
            <div><strong class="block text-[13px] font-semibold">Source PDF</strong><small class="mt-1 block text-[11px] text-[#72796e]">{{ pdf ? `${pdf.pageCount} pages extracted` : 'Upload your document' }}</small></div>
          </li>
          <li class="relative flex min-h-14 items-center gap-3 rounded-lg p-2.5 text-[#62685f] [&:not(:last-child)]:after:absolute [&:not(:last-child)]:after:top-11 [&:not(:last-child)]:after:left-[21px] [&:not(:last-child)]:after:h-[17px] [&:not(:last-child)]:after:w-px [&:not(:last-child)]:after:bg-[#30342e] [&:not(:last-child)]:after:content-['']" :class="{ 'bg-white/[.025] text-[#d4d8cf]': pdf }">
            <span class="grid size-6 shrink-0 place-items-center rounded-full border border-[#363b34] font-mono text-[11px] font-semibold" :class="{ 'border-[#6f7967] text-acid': pdf }">2</span>
            <div><strong class="block text-[13px] font-semibold">AI rewrite</strong><small class="mt-1 block text-[11px] text-[#72796e]">Shape the narrative</small></div>
          </li>
          <li class="relative flex min-h-14 items-center gap-3 rounded-lg p-2.5 text-[#62685f] [&:not(:last-child)]:after:absolute [&:not(:last-child)]:after:top-11 [&:not(:last-child)]:after:left-[21px] [&:not(:last-child)]:after:h-[17px] [&:not(:last-child)]:after:w-px [&:not(:last-child)]:after:bg-[#30342e] [&:not(:last-child)]:after:content-['']" :class="{ 'bg-white/[.025] text-[#d4d8cf]': markdown }">
            <span class="grid size-6 shrink-0 place-items-center rounded-full border border-[#363b34] font-mono text-[11px] font-semibold" :class="{ 'border-[#6f7967] text-acid': markdown }">3</span>
            <div><strong class="block text-[13px] font-semibold">Edit & configure</strong><small class="mt-1 block text-[11px] text-[#72796e]">Refine your deck</small></div>
          </li>
          <li class="relative flex min-h-14 items-center gap-3 rounded-lg p-2.5 text-[#62685f]" :class="{ 'bg-white/[.025] text-[#d4d8cf]': preview.status.value === 'ready' }">
            <span class="grid size-6 shrink-0 place-items-center rounded-full border border-[#363b34] font-mono text-[11px] font-semibold" :class="{ 'border-[#6f7967] text-acid': preview.status.value === 'ready' }">4</span>
            <div><strong class="block text-[13px] font-semibold">Preview & export</strong><small class="mt-1 block text-[11px] text-[#72796e]">Run the real project</small></div>
          </li>
        </ol>

        <div class="mx-2 my-6 h-px bg-line"></div>
        <div class="mx-2 mb-4 font-mono text-[10px] leading-tight font-bold tracking-[0.15em] text-[#747a70]">DECK SETTINGS</div>
        <div class="grid gap-[18px] px-2">
          <label class="grid gap-2 text-[12px] font-semibold text-[#92988e]">Title<input v-model="config.title" class="h-10 w-full rounded-lg border border-[#32372f] bg-canvas px-3 text-[13px] font-normal text-[#d0d4cb]" placeholder="Untitled deck" /></label>
          <label class="grid gap-2 text-[12px] font-semibold text-[#92988e]">Theme
            <span class="relative block"><select v-model="config.theme" class="h-10 w-full appearance-none rounded-lg border border-[#32372f] bg-canvas px-3 pr-8 text-[13px] font-normal text-[#d0d4cb]"><option value="seriph">Seriph</option><option value="default">Default</option><option value="apple-basic">Apple Basic</option></select><ChevronDown class="pointer-events-none absolute top-3 right-2.5 text-[#777e73]" :size="15" /></span>
          </label>
          <div class="grid gap-2 text-[12px] font-semibold text-[#92988e]">Layout density
            <div class="grid grid-cols-3 rounded-lg border border-[#30352d] bg-canvas p-1">
              <button v-for="density in ['airy', 'balanced', 'dense']" :key="density" class="cursor-pointer rounded-[5px] px-1 py-2 text-[11px] font-medium text-[#747b70] capitalize transition-[transform,background-color,color] duration-150 ease-snappy active:scale-[.96] motion-reduce:transition-none" :class="{ 'bg-[#2a3027] text-[#e0e3dc]': config.density === density }" @click="config.density = density as DeckConfig['density']">{{ density }}</button>
            </div>
          </div>
          <label class="grid gap-2 text-[12px] font-semibold text-[#92988e]">Tone
            <span class="relative block"><select v-model="config.tone" class="h-10 w-full appearance-none rounded-lg border border-[#32372f] bg-canvas px-3 pr-8 text-[13px] font-normal text-[#d0d4cb]"><option value="executive">Executive</option><option value="educational">Educational</option><option value="persuasive">Persuasive</option><option value="conversational">Conversational</option></select><ChevronDown class="pointer-events-none absolute top-3 right-2.5 text-[#777e73]" :size="15" /></span>
          </label>
          <div class="flex items-center justify-between gap-3"><span><strong class="block text-[12px] font-semibold text-[#b7bcb2]">Speaker notes</strong><small class="mt-1 block text-[10px] text-[#6f756b]">Write presenter cues</small></span><SwitchRoot v-model="config.includeNotes" class="relative h-5 w-[35px] cursor-pointer rounded-full bg-[#353a33] p-0.5 transition-colors duration-150 ease-snappy data-[state=checked]:bg-acid motion-reduce:transition-none"><SwitchThumb class="block size-4 rounded-full bg-[#d6d9d2] transition-transform duration-150 ease-snappy data-[state=checked]:translate-x-[15px] data-[state=checked]:bg-canvas motion-reduce:transition-none" /></SwitchRoot></div>
          <div class="flex items-center justify-between gap-3"><span><strong class="block text-[12px] font-semibold text-[#b7bcb2]">Source references</strong><small class="mt-1 block text-[10px] text-[#6f756b]">Keep original page links</small></span><SwitchRoot v-model="config.preserveSourceReferences" class="relative h-5 w-[35px] cursor-pointer rounded-full bg-[#353a33] p-0.5 transition-colors duration-150 ease-snappy data-[state=checked]:bg-acid motion-reduce:transition-none"><SwitchThumb class="block size-4 rounded-full bg-[#d6d9d2] transition-transform duration-150 ease-snappy data-[state=checked]:translate-x-[15px] data-[state=checked]:bg-canvas motion-reduce:transition-none" /></SwitchRoot></div>
        </div>

        <div class="mt-auto flex items-center gap-2.5 px-2 pt-7 text-[11px] leading-relaxed text-[#777e73]"><KeyRound :size="15" /><span>Bring-your-own key<br /><small class="text-[10px] text-[#5f655c]">Never stored or proxied</small></span></div>
      </aside>

      <section v-if="!pdf" class="relative flex min-w-0 flex-col items-center justify-center overflow-y-auto px-[7vw] pt-12 pb-8 max-[780px]:min-h-[calc(100vh-68px)] max-[780px]:px-[22px] max-[780px]:py-12">
        <div class="max-w-[790px] text-center">
          <div class="inline-flex items-center gap-2 font-mono text-[11px] leading-tight font-bold tracking-[0.15em] text-acid"><Sparkles :size="15" />PDF → REAL SLIDEV PROJECT</div>
          <h1 class="my-5 font-display text-[clamp(42px,5vw,70px)] leading-[.99] font-medium tracking-[-0.05em] text-ink">Turn documents into<br /><em class="font-normal text-[#aab1a4]">decks worth sharing.</em></h1>
          <p class="mx-auto max-w-[620px] text-[16px] leading-[1.65] text-[#858c80]">Drop in a PDF. AI finds the story, writes the slides, and spins up a live Slidev project—right in your browser.</p>
        </div>

        <div ref="dropZone" class="mt-9 flex min-h-[205px] w-full max-w-[560px] cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-[#42493d] bg-[radial-gradient(circle_at_center,rgba(201,240,113,.035),transparent_68%)] bg-[#181c17]/65 transition-[transform,background-color,border-color] duration-150 ease-snappy hover:-translate-y-0.5 hover:border-acid hover:bg-[#20251d]/85 active:scale-[.99] motion-reduce:transform-none motion-reduce:transition-none" :class="{ '-translate-y-0.5 border-acid bg-[#20251d]/85': isDraggingOver }" @click="openFileDialog()">
          <div class="mb-[18px] grid size-14 place-items-center rounded-full border border-[#3e4638] bg-[#1c211a] text-acid shadow-[0_0_0_8px_rgba(201,240,113,.025)]"><CloudUpload :size="29" /></div>
          <strong class="text-[15px] font-semibold text-[#e3e6de]">Drop your PDF here</strong>
          <span class="mt-1.5 text-[13px] text-[#7a8175]">or click to browse</span>
          <small class="mt-5 font-mono text-[10px] leading-none font-semibold tracking-[0.11em] text-[#62685f]">PDF · MAX 25 MB · UP TO 80 PAGES</small>
        </div>

        <div v-if="status === 'extracting'" class="mt-4 flex items-center gap-2 text-[13px] text-[#a5aba0]"><LoaderCircle class="animate-spin motion-reduce:animate-none" :size="18" />Extracting page {{ progress.current }} of {{ progress.total || '…' }}</div>
        <div v-if="error" class="mt-4 flex max-w-[650px] items-center gap-2.5 rounded-lg border border-[rgba(255,124,112,.25)] bg-[rgba(126,42,35,.12)] px-3.5 py-3 text-[13px] leading-relaxed text-[#e5a19a]"><CircleAlert :size="18" />{{ error }}</div>

        <div class="mt-10 grid w-full max-w-[780px] grid-cols-3 border-t border-[#242822] max-[1050px]:max-w-[640px] max-[780px]:grid-cols-1 max-[780px]:gap-3">
          <div class="flex items-center justify-center gap-3 pt-7 max-[780px]:justify-start max-[780px]:px-5 max-[780px]:pt-4"><span class="grid size-9 place-items-center rounded-lg bg-[#1b1f19] text-[#9aaf8e]"><WandSparkles :size="19" /></span><span><strong class="block text-[12px] font-semibold text-[#abb1a6]">Topic-aware rewrite</strong><small class="mt-1 block text-[10px] text-[#666c63]">Splits ideas, not pages</small></span></div>
          <div class="flex items-center justify-center gap-3 pt-7 max-[780px]:justify-start max-[780px]:px-5 max-[780px]:pt-4"><span class="grid size-9 place-items-center rounded-lg bg-[#1b1f19] text-[#9aaf8e]"><Code2 :size="19" /></span><span><strong class="block text-[12px] font-semibold text-[#abb1a6]">Editable Markdown</strong><small class="mt-1 block text-[10px] text-[#666c63]">Slidev-native output</small></span></div>
          <div class="flex items-center justify-center gap-3 pt-7 max-[780px]:justify-start max-[780px]:px-5 max-[780px]:pt-4"><span class="grid size-9 place-items-center rounded-lg bg-[#1b1f19] text-[#9aaf8e]"><Play :size="19" /></span><span><strong class="block text-[12px] font-semibold text-[#abb1a6]">Live project preview</strong><small class="mt-1 block text-[10px] text-[#666c63]">Powered by WebContainers</small></span></div>
        </div>
      </section>

      <template v-else>
        <section class="min-h-0 min-w-0 border-r border-line bg-[#141713] max-[780px]:min-h-[650px] max-[780px]:border-r-0">
          <div v-if="!markdown" class="h-full overflow-y-auto px-[clamp(30px,5vw,76px)] py-[clamp(32px,5vh,64px)]">
            <div class="grid grid-cols-[58px_1fr_auto] items-center gap-3.5 rounded-xl border border-[#30352e] bg-[#191d18] p-3">
              <div class="grid h-[70px] w-[58px] place-items-center overflow-hidden rounded-md bg-[#252a23] text-[#7b8875]"><img v-if="coverDataUrl" class="size-full object-cover" :src="coverDataUrl" alt="PDF first page preview" /><FileText v-else :size="31" /></div>
              <div class="min-w-0"><span class="font-mono text-[10px] leading-tight font-bold tracking-[0.12em] text-mint">SOURCE READY</span><h2 class="my-1.5 max-w-[350px] truncate text-[14px] font-semibold text-[#dce0d7]">{{ pdf.fileName }}</h2><p class="m-0 text-[11px] text-[#737a70]">{{ pdf.pageCount }} pages · {{ pdf.pages.reduce((sum, page) => sum + page.characterCount, 0).toLocaleString() }} extracted characters</p></div>
              <span class="grid size-7 place-items-center rounded-full bg-mint text-[#152018]"><Check :size="17" /></span>
            </div>

            <div class="my-[clamp(46px,8vh,94px)] max-w-[580px] mb-8"><span class="inline-flex items-center gap-2 font-mono text-[11px] leading-tight font-bold tracking-[0.15em] text-acid"><WandSparkles :size="15" />AI REWRITE</span><h1 class="my-4 font-display text-[clamp(34px,3.5vw,50px)] leading-[1.04] font-medium tracking-[-0.04em] text-[#e8ebe3]">Shape the source into a story.</h1><p class="text-[14px] leading-[1.65] text-[#858c80]">Decksmith groups related ideas, breaks up dense pages, and returns validated slide data before writing Markdown.</p></div>

            <div class="rounded-xl border border-[#30352e] bg-[#181b17] p-4">
              <label class="mb-3 flex items-baseline justify-between gap-4 max-[780px]:flex-col max-[780px]:items-start max-[780px]:gap-1"><span class="text-[12px] font-semibold text-[#c1c6bb]">Anthropic API key</span><small class="text-[10px] text-[#6f756b]">Used directly from this tab. It is never saved.</small></label>
              <div class="flex h-11 items-center gap-2.5 rounded-lg border border-[#343a31] bg-[#10130f] px-3 text-[#737a6f]"><KeyRound :size="17" /><input v-model="apiKey" class="h-full w-full border-0 bg-transparent font-mono text-[12px] text-[#d0d4cb] outline-0" :type="showKey ? 'text' : 'password'" placeholder="sk-ant-api03-…" autocomplete="off" /><button class="cursor-pointer transition-transform duration-150 ease-snappy active:scale-[.92] motion-reduce:transition-none" :aria-label="showKey ? 'Hide API key' : 'Show API key'" @click="showKey = !showKey"><Eye :size="17" /></button></div>
            </div>
            <div v-if="error" class="mt-4 flex max-w-[650px] items-center gap-2.5 rounded-lg border border-[rgba(255,124,112,.25)] bg-[rgba(126,42,35,.12)] px-3.5 py-3 text-[13px] leading-relaxed text-[#e5a19a]"><CircleAlert :size="18" />{{ error }}</div>
            <button class="mt-4 flex h-[52px] w-full cursor-pointer items-center justify-center gap-2.5 rounded-lg border border-acid bg-acid px-5 text-[14px] font-bold text-canvas transition-[transform,background-color] duration-150 ease-snappy hover:bg-[#d4f589] active:scale-[.985] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none" :disabled="!canGenerate" @click="generateDeck"><LoaderCircle v-if="status === 'generating'" class="animate-spin motion-reduce:animate-none" :size="20" /><WandSparkles v-else :size="20" />{{ status === 'generating' ? 'Rewriting your document…' : 'Generate Slidev deck' }}<ArrowRight v-if="status !== 'generating'" class="ml-auto" :size="19" /></button>
          </div>

          <TabsRoot v-else v-model="editorTab" class="flex h-full flex-col">
            <div class="flex h-[58px] shrink-0 items-center justify-between border-b border-line bg-[#171a16] px-4">
              <TabsList class="flex h-9 gap-1 rounded-lg border border-[#30352e] bg-canvas p-1"><TabsTrigger class="flex cursor-pointer items-center gap-1.5 rounded-[5px] px-3 text-[12px] font-medium text-[#747b70] data-[state=active]:bg-[#282d26] data-[state=active]:text-[#cbd0c5]" value="markdown"><Code2 :size="16" />Markdown</TabsTrigger><TabsTrigger class="flex cursor-pointer items-center gap-1.5 rounded-[5px] px-3 text-[12px] font-medium text-[#747b70] data-[state=active]:bg-[#282d26] data-[state=active]:text-[#cbd0c5]" value="outline"><Layers3 :size="16" />Outline <span class="text-[10px] text-[#676e64]">{{ outline.length }}</span></TabsTrigger></TabsList>
              <div class="flex items-center gap-2 text-[11px] text-[#747b70]"><span class="size-1.5 rounded-full bg-mint"></span>{{ hasManualEdits ? 'Edited' : 'Generated' }}</div>
            </div>
            <TabsContent value="markdown" class="min-h-0 flex-1"><textarea class="size-full resize-none border-0 bg-[#121511] px-7 py-6 font-mono text-[13px] leading-[1.75] text-[#c2c9bb] caret-acid outline-0" :value="markdown" spellcheck="false" aria-label="Slidev markdown editor" @input="onMarkdownInput"></textarea></TabsContent>
            <TabsContent value="outline" class="flex-1 overflow-y-auto p-4"><button v-for="item in outline" :key="item.index" class="grid min-h-[54px] w-full cursor-pointer grid-cols-[38px_1fr_auto] items-center gap-2 border-b border-[#262a24] px-3 text-left text-[#8f968b] transition-[transform,background-color] duration-150 ease-snappy hover:bg-[#191d18] active:scale-[.99] motion-reduce:transition-none"><span class="font-mono text-[11px] text-[#62695f]">{{ String(item.index + 1).padStart(2, '0') }}</span><strong class="text-[13px] font-medium text-[#bdc2b8]">{{ item.title }}</strong><ArrowRight :size="15" /></button></TabsContent>
          </TabsRoot>
        </section>

        <section class="flex h-full min-h-0 min-w-0 flex-col bg-canvas max-[780px]:min-h-[620px] max-[780px]:border-t max-[780px]:border-line">
          <div class="flex h-[58px] shrink-0 items-center justify-between border-b border-line bg-[#171a16] px-4">
            <div class="flex items-center gap-2.5"><span class="grid size-8 place-items-center rounded-lg bg-acid/10 text-acid"><Play :size="15" fill="currentColor" /></span><span><strong class="block text-[12px] font-semibold text-[#d0d4cb]">Live Slidev</strong><small class="mt-0.5 block text-[10px] text-[#656c62]">WebContainer runtime</small></span></div>
            <div class="flex items-center gap-2"><button v-if="preview.terminal.value.length" class="grid size-8 cursor-pointer place-items-center rounded-lg border border-[#343931] bg-[#1a1e19] text-[#a1a79c] transition-[transform,background-color,border-color] duration-150 ease-snappy hover:border-[#555d50] hover:bg-[#20241f] active:scale-[.95] motion-reduce:transition-none" aria-label="Toggle terminal log" @click="showTerminal = !showTerminal"><TerminalSquare :size="17" /></button><button class="inline-flex h-8 cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#343931] bg-[#1a1e19] px-3 text-[11px] font-semibold text-[#c6cabf] transition-[transform,background-color,border-color] duration-150 ease-snappy hover:border-[#555d50] hover:bg-[#20241f] active:scale-[.97] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none" :disabled="!markdown || isPreviewBusy" @click="startPreview"><RefreshCw v-if="preview.status.value === 'ready'" :size="16" /><Play v-else :size="16" />{{ preview.status.value === 'ready' ? 'Sync preview' : 'Start preview' }}</button></div>
          </div>
          <div class="preview-grid relative min-h-0 flex-1 overflow-hidden p-[clamp(20px,3vw,42px)]">
            <iframe v-if="preview.url.value" class="size-full rounded-xl border border-[#33392f] bg-white shadow-[0_18px_60px_rgba(0,0,0,.32)]" :src="preview.url.value" title="Live Slidev preview" allow="fullscreen" allowfullscreen></iframe>
            <div v-else class="flex size-full min-h-[330px] flex-col items-center justify-center rounded-xl border border-[#2d322b] bg-[#121511]/90 text-center">
              <div class="preview-illustration relative mb-8 h-[82px] w-[132px] rounded-md border border-[#3a4036] bg-[linear-gradient(135deg,#22281f,#171b16)] shadow-[9px_9px_0_-4px_#1a1e18,9px_9px_0_-3px_#30352d]"><div></div><span class="absolute right-4 bottom-3.5 text-acid"><Play :size="24" fill="currentColor" /></span></div>
              <h3 class="m-0 text-[14px] font-semibold text-[#cbd0c5]">{{ isPreviewBusy ? 'Building the real Slidev project…' : 'Preview in a browser-native runtime' }}</h3>
              <p class="mx-6 mt-2.5 mb-5 max-w-[370px] text-[12px] leading-relaxed text-[#747b70]">{{ markdown ? preview.message.value : 'Generate your deck, then start an isolated Slidev development server here.' }}</p>
              <button v-if="markdown && !isPreviewBusy" class="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-lg border border-acid bg-acid px-4 text-[12px] font-bold text-canvas transition-[transform,background-color] duration-150 ease-snappy hover:bg-[#d4f589] active:scale-[.97] motion-reduce:transition-none" @click="startPreview"><Play :size="17" />Start live preview</button>
              <div v-if="isPreviewBusy" class="mt-3 h-0.5 w-[160px] overflow-hidden rounded-full bg-[#2c312a]"><span class="preview-progress block h-full w-[42%] bg-acid motion-reduce:animate-pulse"></span></div>
            </div>
            <div v-if="showTerminal" class="absolute right-10 bottom-10 left-10 max-h-[44%] overflow-hidden rounded-lg border border-[#363c33] bg-[#0a0c09]/95 shadow-[0_15px_45px_rgba(0,0,0,.4)]"><div class="flex h-9 items-center justify-between border-b border-[#272b25] px-3 font-mono text-[10px] tracking-[0.1em] text-[#858c80] uppercase"><span>WEBContainer output</span><button class="cursor-pointer text-[#777e73] transition-transform duration-150 ease-snappy active:scale-[.9] motion-reduce:transition-none" @click="showTerminal = false"><X :size="15" /></button></div><pre class="m-0 max-h-[230px] overflow-auto p-3.5 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-[#abb3a5]">{{ preview.terminal.value.join('\n') }}</pre></div>
          </div>
          <div class="flex h-8 items-center gap-2 border-t border-line px-3.5 text-[10px] text-[#666d63]" :class="{ 'text-[#86b79d]': preview.status.value === 'ready', 'text-[#b77972]': ['error', 'unsupported'].includes(preview.status.value) }"><span class="size-1.5 rounded-full" :class="preview.status.value === 'ready' ? 'bg-mint shadow-[0_0_0_3px_rgba(118,213,170,.07)]' : ['error', 'unsupported'].includes(preview.status.value) ? 'bg-[#d7796e]' : 'bg-[#62695f]' "></span>{{ preview.message.value }}</div>
        </section>
      </template>
    </main>
  </div>
</template>
