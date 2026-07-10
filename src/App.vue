<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch,
} from "vue";
import { useDebounceFn, useDropZone, useFileDialog } from "@vueuse/core";
import {
  SwitchRoot,
  SwitchThumb,
  TabsContent,
  TabsList,
  TabsRoot,
  TabsTrigger,
} from "reka-ui";
import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CloudUpload,
  Code2,
  FileArchive,
  FileDown,
  FileText,
  Layers3,
  LoaderCircle,
  Maximize2,
  Minimize2,
  Play,
  RefreshCw,
  Sparkles,
  TerminalSquare,
  WandSparkles,
  X,
} from "@lucide/vue";
import { HostedAiProvider } from "@/lib/ai";
import ThemeStudio from "@/components/ThemeStudio.vue";
import { createProjectZip, downloadBlob, slugify } from "@/lib/export";
import {
  generateMarkdown,
  parseOutline,
  updateMarkdownHeadmatter,
} from "@/lib/markdown";
import { createProjectFiles } from "@/lib/project";
import { useVercelPreview } from "@/composables/useVercelPreview";
import type { DeckConfig, ExtractedPdf, GeneratedDeck } from "@/types/deck";

type WorkStatus =
  | "idle"
  | "extracting"
  | "ready"
  | "generating"
  | "generated"
  | "error";

const config = reactive<DeckConfig>({
  title: "",
  variant: "editorial",
  accent: "#0f7cff",
  atmosphere: "grain",
  logo: "",
  logoInvert: false,
  density: "balanced",
  tone: "executive",
  includeNotes: true,
  preserveSourceReferences: true,
});
const pdf = ref<ExtractedPdf>();
const deck = ref<GeneratedDeck>();
const markdown = ref("");
const status = ref<WorkStatus>("idle");
const error = ref("");
const progress = ref({ current: 0, total: 0 });
const editorTab = ref("markdown");
const dropZone = ref<HTMLElement>();
const isDraggingOver = ref(false);
const showTerminal = ref(false);
const hasManualEdits = ref(false);
const previewFrame = ref<HTMLIFrameElement>();
const previewShell = ref<HTMLElement>();
const isPreviewFullscreen = ref(false);

const preview = useVercelPreview();
const outline = computed(() =>
  markdown.value ? parseOutline(markdown.value) : [],
);
const assets = computed<Record<string, Uint8Array>>(() => {
  const result: Record<string, Uint8Array> = {};
  const cover = pdf.value?.coverPng;
  if (cover) result["source-cover.png"] = cover;
  return result;
});
const coverDataUrl = computed(() => {
  const bytes = pdf.value?.coverPng;
  if (!bytes) return "";
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  }
  return `data:image/png;base64,${btoa(binary)}`;
});
const projectFiles = computed(() =>
  createProjectFiles(markdown.value, config, assets.value),
);
const canGenerate = computed(
  () =>
    Boolean(pdf.value) &&
    status.value !== "generating" &&
    status.value !== "extracting",
);
const isPreviewBusy = computed(() =>
  ["creating", "starting", "syncing"].includes(preview.status.value),
);
const friendlyPreviewMessage = computed(() => {
  const messages = {
    idle: "Your presentation preview is ready to be opened.",
    creating: "Preparing your preview…",
    starting: "Opening your presentation…",
    syncing: "Saving your latest changes…",
    ready: "Your preview is up to date.",
  } as const;
  return (
    messages[preview.status.value as keyof typeof messages] ??
    preview.message.value
  );
});

const { open: openFileDialog, onChange } = useFileDialog({
  accept: "application/pdf",
  multiple: false,
});
onChange((files) => {
  const file = files?.item(0);
  if (file) void loadPdf(file);
});

useDropZone(dropZone, {
  onDrop(files) {
    isDraggingOver.value = false;
    const file = files?.[0];
    if (file) void loadPdf(file);
  },
  onOver: () => {
    isDraggingOver.value = true;
  },
  onLeave: () => {
    isDraggingOver.value = false;
  },
  dataTypes: ["application/pdf"],
  multiple: false,
  preventDefaultForUnhandled: true,
});

async function loadPdf(file: File) {
  error.value = "";
  status.value = "extracting";
  progress.value = { current: 0, total: 0 };
  deck.value = undefined;
  markdown.value = "";
  await preview.stop();
  try {
    const { extractPdf } = await import("@/lib/pdf");
    pdf.value = await extractPdf(file, (current, total) => {
      progress.value = { current, total };
    });
    if (!config.title) config.title = file.name.replace(/\.pdf$/i, "");
    status.value = "ready";
    const preparingDeck = createProjectFiles(
      generateMarkdown(
        {
          title: config.title,
          slides: [
            {
              title: "Preparing your presentation…",
              body: ["Finding the story in your document"],
            },
          ],
        },
        config,
      ),
      config,
      assets.value,
    );
    void preview.prewarm(preparingDeck).catch(() => undefined);
  } catch (cause) {
    pdf.value = undefined;
    status.value = "error";
    error.value =
      cause instanceof Error
        ? cause.message
        : "The PDF could not be processed.";
  }
}

async function generateDeck() {
  if (!pdf.value) return;
  error.value = "";
  status.value = "generating";
  try {
    const provider = new HostedAiProvider();
    deck.value = await provider.generateDeck({ pdf: pdf.value, config });
    if (!config.title.trim()) config.title = deck.value.title;
    markdown.value = generateMarkdown(deck.value, config);
    hasManualEdits.value = false;
    status.value = "generated";
    void preview.start(projectFiles.value).catch(() => undefined);
  } catch (cause) {
    status.value = "error";
    error.value =
      cause instanceof Error
        ? cause.message
        : "Deck generation failed. Try again.";
  }
}

function onMarkdownInput(event: Event) {
  markdown.value = (event.target as HTMLTextAreaElement).value;
  hasManualEdits.value = true;
}

const syncPreview = useDebounceFn(async () => {
  if (preview.status.value === "ready" && markdown.value)
    await preview.update(projectFiles.value);
}, 500);

watch(
  config,
  () => {
    if (!markdown.value) return;
    markdown.value = updateMarkdownHeadmatter(markdown.value, config);
    void syncPreview();
  },
  { deep: true },
);

watch(markdown, () => {
  void syncPreview();
});

async function startPreview() {
  error.value = "";
  try {
    await preview.start(projectFiles.value);
  } catch {
    // The preview composable exposes a user-facing error and retry state.
  }
}

function sendPreviewCommand(action: "previous" | "next") {
  const frameWindow = previewFrame.value?.contentWindow;
  if (!frameWindow || !preview.url.value) return;
  frameWindow.postMessage(
    { type: "decksmith:navigate", action },
    new URL(preview.url.value).origin,
  );
  previewFrame.value?.focus();
}

function syncNativePreviewControls() {
  const frameWindow = previewFrame.value?.contentWindow;
  if (!frameWindow || !preview.url.value) return;
  frameWindow.postMessage(
    {
      type: "decksmith:fullscreen",
      fullscreen: isPreviewFullscreen.value,
    },
    new URL(preview.url.value).origin,
  );
}

async function togglePreviewFullscreen() {
  if (document.fullscreenElement) {
    await document.exitFullscreen();
    return;
  }
  await previewShell.value?.requestFullscreen();
}

function onFullscreenChange() {
  isPreviewFullscreen.value = document.fullscreenElement === previewShell.value;
  syncNativePreviewControls();
}

onMounted(() =>
  document.addEventListener("fullscreenchange", onFullscreenChange),
);
onBeforeUnmount(() =>
  document.removeEventListener("fullscreenchange", onFullscreenChange),
);

function downloadMarkdown() {
  downloadBlob(
    new Blob([markdown.value], { type: "text/markdown;charset=utf-8" }),
    `${slugify(config.title)}-slides.md`,
  );
}

async function downloadProject() {
  const zip = await createProjectZip(projectFiles.value);
  downloadBlob(zip, `${slugify(config.title)}-slidev.zip`);
}

function resetPdf() {
  void preview.stop();
  pdf.value = undefined;
  deck.value = undefined;
  markdown.value = "";
  status.value = "idle";
  error.value = "";
  config.title = "";
}
</script>

<template>
  <div class="min-h-screen bg-canvas text-ink">
    <header class="h-[72px] border-b border-white/10 bg-navy text-white">
      <div
        class="mx-auto flex h-full max-w-[1600px] items-center justify-between px-8 max-[720px]:px-4"
      >
        <a
          class="inline-flex items-center gap-3 text-[19px] font-semibold tracking-[-0.03em] text-white no-underline"
          href="#"
          aria-label="Decksmith home"
        >
          <span
            class="grid size-9 place-items-center rounded-xl bg-accent text-white shadow-[0_8px_28px_rgba(15,124,255,.32)]"
            ><Layers3 :size="20" :stroke-width="2.2"
          /></span>
          <span>decksmith</span>
          <span
            class="hidden border-l border-white/15 pl-3 text-[12px] font-normal tracking-normal text-white/50 sm:inline"
            >AI presentation maker</span
          >
        </a>

        <div class="flex items-center gap-2.5">
          <span
            v-if="!pdf"
            class="hidden items-center gap-2 text-[13px] text-white/55 md:inline-flex"
            ><span class="size-1.5 rounded-full bg-[#62d7ad]"></span>Your
            presentation stays private</span
          >
          <span
            v-else
            class="hidden max-w-[260px] items-center gap-2 truncate rounded-full border border-white/12 bg-white/[.07] px-3 py-2 text-[12px] text-white/70 lg:inline-flex"
            ><FileText :size="14" />{{ pdf.fileName
            }}<button
              class="grid cursor-pointer place-items-center text-white/50 transition-transform duration-150 ease-snappy active:scale-90 motion-reduce:transition-none"
              aria-label="Remove PDF"
              @click="resetPdf"
            >
              <X :size="14" /></button
          ></span>
          <button
            v-if="markdown"
            class="hidden h-10 cursor-pointer items-center gap-2 rounded-xl border border-white/15 bg-white/[.06] px-4 text-[13px] font-medium text-white/80 transition-[transform,background-color] duration-150 ease-snappy hover:bg-white/10 active:scale-[.97] motion-reduce:transition-none sm:inline-flex"
            @click="downloadMarkdown"
          >
            <FileDown :size="16" />Download slides
          </button>
          <button
            v-if="markdown"
            class="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-white px-4 text-[13px] font-semibold text-navy shadow-[0_6px_18px_rgba(0,0,0,.16)] transition-transform duration-150 ease-snappy active:scale-[.97] motion-reduce:transition-none"
            @click="downloadProject"
          >
            <FileArchive :size="16" />Download presentation
          </button>
        </div>
      </div>
    </header>

    <main
      class="h-[calc(100vh-72px)] overflow-auto bg-canvas max-[720px]:h-auto max-[720px]:min-h-[calc(100vh-72px)]"
    >
      <section
        v-if="!pdf"
        class="upload-gradient flex min-h-full flex-col items-center px-6 py-12 text-center text-white max-[720px]:px-4"
      >
        <div class="max-w-[840px]">
          <div
            class="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[.07] px-4 py-2 text-[11px] font-semibold tracking-[0.12em] text-white/75 uppercase backdrop-blur-xl"
          >
            <Sparkles :size="15" />From document to deck, in minutes
          </div>
          <h1
            class="text-[clamp(42px,5.5vw,72px)] leading-[1.02] font-normal tracking-[-0.052em] text-white"
          >
            Your document has a story.<br /><span class="text-[#a9d8ff]"
              >Bring it to life.</span
            >
          </h1>
          <p
            class="mx-auto mt-5 max-w-[680px] text-[17px] leading-[1.65] text-white/65"
          >
            Upload a report, proposal, or guide. Decksmith finds the narrative
            and turns it into a presentation you can shape and share.
          </p>
        </div>

        <button
          ref="dropZone"
          type="button"
          class="mt-9 flex min-h-[215px] w-full max-w-[650px] cursor-pointer flex-col items-center justify-center rounded-[26px] border border-white/70 bg-white p-8 text-[#151a24] shadow-[0_24px_70px_rgba(2,21,61,.28),0_2px_8px_rgba(2,21,61,.12)] transition-transform duration-150 ease-snappy hover:-translate-y-0.5 active:scale-[.99] motion-reduce:transform-none motion-reduce:transition-none"
          :class="{ '-translate-y-1 ring-4 ring-white/25': isDraggingOver }"
          @click="openFileDialog()"
        >
          <span
            class="mb-4 grid size-14 place-items-center rounded-2xl bg-[#eef6ff] text-accent"
            ><CloudUpload :size="28" :stroke-width="1.8"
          /></span>
          <strong class="text-[17px] font-semibold tracking-[-0.01em]"
            >Drop your PDF here</strong
          >
          <span class="mt-1.5 text-[14px] text-[#808897]"
            >or choose a file from your computer</span
          >
          <span
            class="mt-5 inline-flex h-10 items-center rounded-xl text-shadow-2xs ring-blue-700/70 inset-shadow-xs inset-shadow-blue-400 ring bg-linear-to-b bg-accent from-blue-500 via-accent to-blue-700/60 px-5 text-[13px] font-semibold text-white shadow-md shadow-blue-800/30"
            >Choose a PDF</span
          >
          <small class="mt-3 text-[11px] text-[#a0a7b2]"
            >Up to 25 MB · 80 pages</small
          >
        </button>

        <div
          v-if="status === 'extracting'"
          class="mt-5 flex items-center gap-2 text-[13px] text-white/75"
        >
          <LoaderCircle
            class="animate-spin motion-reduce:animate-none"
            :size="18"
          />Reading page {{ progress.current }} of {{ progress.total || "…" }}
        </div>

        <div
          class="mt-9 grid w-full max-w-[900px] grid-cols-3 border-t border-white/12 pt-7 text-left max-[720px]:grid-cols-1 max-[720px]:gap-4"
        >
          <div class="flex items-center justify-center gap-3">
            <span
              class="grid size-10 place-items-center rounded-xl bg-white/[.08] text-[#b9ddff]"
              ><FileText :size="19" /></span
            ><span
              ><strong class="block text-[13px] font-medium text-white/85"
                >Works with real documents</strong
              ><small class="mt-1 block text-[11px] text-white/45"
                >Reports, proposals, guides, and more</small
              ></span
            >
          </div>
          <div class="flex items-center justify-center gap-3">
            <span
              class="grid size-10 place-items-center rounded-xl bg-white/[.08] text-[#b9ddff]"
              ><WandSparkles :size="19" /></span
            ><span
              ><strong class="block text-[13px] font-medium text-white/85"
                >Organized by ideas</strong
              ><small class="mt-1 block text-[11px] text-white/45"
                >Not one slide per page</small
              ></span
            >
          </div>
          <div class="flex items-center justify-center gap-3">
            <span
              class="grid size-10 place-items-center rounded-xl bg-white/[.08] text-[#b9ddff]"
              ><Layers3 :size="19" /></span
            ><span
              ><strong class="block text-[13px] font-medium text-white/85"
                >Everything stays editable</strong
              ><small class="mt-1 block text-[11px] text-white/45"
                >Change the words, style, and structure</small
              ></span
            >
          </div>
        </div>
      </section>

      <section
        v-else-if="!markdown"
        class="min-h-full bg-[#f7f9fc] bg-[radial-gradient(#dce2ea_1px,transparent_1px)] bg-[length:16px_16px] px-5 py-9 max-[720px]:px-3 max-[720px]:py-5"
      >
        <div class="mx-auto max-w-[920px]">
          <div class="mb-7 flex flex-wrap items-end justify-between gap-5">
            <div>
              <span
                class="text-[12px] font-semibold tracking-[0.12em] text-accent uppercase"
                >Create your first draft</span
              >
              <h1
                class="mt-2 text-[clamp(30px,4vw,48px)] leading-[1.08] font-normal tracking-[-0.045em] text-[#171a21]"
              >
                How should Decksmith tell the story?
              </h1>
              <p
                class="mt-3 max-w-[650px] text-[15px] leading-relaxed text-[#747d8a]"
              >
                Choose the voice and level of detail now. You’ll design the
                presentation alongside its live preview next.
              </p>
            </div>
            <article
              class="flex min-w-[330px] items-center gap-3 rounded-2xl border border-[#e0e5eb] bg-white p-3 pr-4 shadow-card max-[520px]:min-w-0 max-[520px]:w-full"
            >
              <div
                class="grid h-[62px] w-[48px] shrink-0 place-items-center overflow-hidden rounded-lg border border-[#e4e8ee] bg-[#f0f3f7] text-[#87909e]"
              >
                <img
                  v-if="coverDataUrl"
                  class="size-full object-cover"
                  :src="coverDataUrl"
                  alt="PDF first page preview"
                /><FileText v-else :size="22" />
              </div>
              <div class="min-w-0 flex-1">
                <span
                  class="inline-flex items-center gap-1 text-[10px] font-semibold text-[#24845f]"
                  ><Check :size="12" />PDF ready</span
                >
                <h2 class="mt-1 truncate text-[13px] font-semibold">
                  {{ pdf.fileName }}
                </h2>
                <p class="mt-0.5 text-[11px] text-[#89919e]">
                  {{ pdf.pageCount }} pages
                </p>
              </div>
              <button
                class="grid size-9 shrink-0 cursor-pointer place-items-center rounded-xl border border-[#dfe3e9] text-[#727b88] transition-[transform,background-color] duration-150 ease-snappy hover:bg-[#f4f6f8] active:scale-[.94]"
                type="button"
                aria-label="Choose a different PDF"
                @click="openFileDialog()"
              >
                <RefreshCw :size="15" />
              </button>
            </article>
          </div>

          <article
            class="rounded-[24px] border border-[#e0e5eb] bg-white p-6 shadow-card max-[620px]:p-5"
          >
            <label class="grid gap-2 text-[12px] font-medium text-[#5d6572]"
              >Presentation title<input
                v-model="config.title"
                class="h-11 w-full rounded-xl border border-[#dce1e8] bg-[#fbfcfd] px-3.5 text-[13px] font-normal text-[#262b34]"
                placeholder="Untitled presentation"
            /></label>
            <div class="mt-5 grid grid-cols-2 gap-5 max-[620px]:grid-cols-1">
              <label class="grid gap-2 text-[12px] font-medium text-[#5d6572]"
                >Voice<span class="relative"
                  ><select
                    v-model="config.tone"
                    class="h-11 w-full appearance-none rounded-xl border border-[#dce1e8] bg-[#fbfcfd] px-3.5 pr-9 text-[13px] font-normal text-[#262b34]"
                  >
                    <option value="executive">Professional</option>
                    <option value="educational">Teaching</option>
                    <option value="persuasive">Persuasive</option>
                    <option value="conversational">Friendly</option></select
                  ><ChevronDown
                    class="pointer-events-none absolute top-3.5 right-3 text-[#9aa2ae]"
                    :size="15" /></span
              ></label>
              <div>
                <span class="text-[12px] font-medium text-[#5d6572]"
                  >Amount of detail</span
                >
                <div class="mt-2 grid grid-cols-3 rounded-xl bg-[#f1f3f6] p-1">
                  <button
                    v-for="option in [
                      { value: 'airy', label: 'Simple' },
                      { value: 'balanced', label: 'Balanced' },
                      { value: 'dense', label: 'Detailed' },
                    ]"
                    :key="option.value"
                    class="cursor-pointer rounded-lg px-2 py-2.5 text-[11px] font-medium text-[#7a8290] transition-[transform,background-color,color,box-shadow] duration-150 ease-snappy active:scale-[.97]"
                    :class="{
                      'bg-white text-[#252a33] shadow-sm':
                        config.density === option.value,
                    }"
                    @click="
                      config.density = option.value as DeckConfig['density']
                    "
                  >
                    {{ option.label }}
                  </button>
                </div>
              </div>
            </div>
            <div class="mt-5 grid grid-cols-2 gap-3 max-[620px]:grid-cols-1">
              <div
                class="flex items-center justify-between gap-4 rounded-xl border border-[#e6e9ee] px-4 py-3"
              >
                <span
                  ><strong class="block text-[12px] font-medium text-[#343a44]"
                    >Presenter notes</strong
                  ><small class="mt-0.5 block text-[10px] text-[#929aa7]"
                    >Helpful talking points</small
                  ></span
                ><SwitchRoot
                  v-model="config.includeNotes"
                  class="relative h-[22px] w-[38px] cursor-pointer rounded-full bg-[#ccd2db] p-[3px] transition-colors duration-150 data-[state=checked]:bg-accent"
                  ><SwitchThumb
                    class="block size-4 rounded-full bg-white shadow-sm transition-transform duration-150 data-[state=checked]:translate-x-4"
                /></SwitchRoot>
              </div>
              <div
                class="flex items-center justify-between gap-4 rounded-xl border border-[#e6e9ee] px-4 py-3"
              >
                <span
                  ><strong class="block text-[12px] font-medium text-[#343a44]"
                    >Page references</strong
                  ><small class="mt-0.5 block text-[10px] text-[#929aa7]"
                    >Show where ideas came from</small
                  ></span
                ><SwitchRoot
                  v-model="config.preserveSourceReferences"
                  class="relative h-[22px] w-[38px] cursor-pointer rounded-full bg-[#ccd2db] p-[3px] transition-colors duration-150 data-[state=checked]:bg-accent"
                  ><SwitchThumb
                    class="block size-4 rounded-full bg-white shadow-sm transition-transform duration-150 data-[state=checked]:translate-x-4"
                /></SwitchRoot>
              </div>
            </div>
            <div
              v-if="error"
              class="mt-5 flex items-start gap-2.5 rounded-xl border border-[#f0c9ce] bg-[#fff6f7] px-3.5 py-3 text-[12px] leading-relaxed text-[#a94b57]"
            >
              <CircleAlert class="mt-0.5 shrink-0" :size="16" />{{ error }}
            </div>
            <button
              class="mt-6 flex h-12 w-full cursor-pointer items-center justify-center gap-2.5 rounded-xl bg-accent px-5 text-[14px] font-semibold text-white shadow-[0_10px_24px_rgba(15,124,255,.24)] transition-transform duration-150 ease-snappy active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-45"
              :disabled="!canGenerate"
              @click="generateDeck"
            >
              <LoaderCircle
                v-if="status === 'generating'"
                class="animate-spin motion-reduce:animate-none"
                :size="19"
              /><WandSparkles v-else :size="19" />{{
                status === "generating"
                  ? "Creating your presentation…"
                  : "Create my presentation"
              }}<ArrowRight
                v-if="status !== 'generating'"
                class="ml-auto"
                :size="18"
              />
            </button>
          </article>
        </div>
      </section>

      <section
        v-else
        class="min-h-full bg-[#f7f9fc] bg-[radial-gradient(#dce2ea_1px,transparent_1px)] bg-[length:16px_16px] px-5 py-6 max-[720px]:px-3 max-[720px]:py-4"
      >
        <div class="mx-auto">
          <div
            class="mb-5 flex flex-wrap items-end gap-4 rounded-[20px] border border-[#e1e5eb] bg-white p-4 shadow-card"
          >
            <label
              class="grid min-w-[220px] flex-1 gap-1.5 text-[11px] font-medium text-[#69717d]"
              >Title<input
                v-model="config.title"
                class="h-10 rounded-xl border border-[#dfe3e9] bg-[#fbfcfd] px-3 text-[13px] font-normal text-[#252a33]"
            /></label>
            <label
              class="grid min-w-[140px] gap-1.5 text-[11px] font-medium text-[#69717d]"
              >Voice<span class="relative"
                ><select
                  v-model="config.tone"
                  class="h-10 w-full appearance-none rounded-xl border border-[#dfe3e9] bg-[#fbfcfd] px-3 pr-8 text-[13px] font-normal text-[#252a33]"
                >
                  <option value="executive">Professional</option>
                  <option value="educational">Teaching</option>
                  <option value="persuasive">Persuasive</option>
                  <option value="conversational">Friendly</option></select
                ><ChevronDown
                  class="pointer-events-none absolute top-3 right-2.5 text-[#9aa2ae]"
                  :size="14" /></span
            ></label>
            <div
              class="flex h-10 items-center gap-4 rounded-xl bg-[#f3f5f7] px-3"
            >
              <label
                class="flex items-center gap-2 text-[11px] font-medium text-[#69717d]"
                >Notes<SwitchRoot
                  v-model="config.includeNotes"
                  class="relative h-5 w-9 cursor-pointer rounded-full bg-[#cbd1da] p-0.5 transition-colors duration-150 data-[state=checked]:bg-accent"
                  ><SwitchThumb
                    class="block size-4 rounded-full bg-white shadow-sm transition-transform duration-150 data-[state=checked]:translate-x-4" /></SwitchRoot></label
              ><label
                class="flex items-center gap-2 text-[11px] font-medium text-[#69717d]"
                >References<SwitchRoot
                  v-model="config.preserveSourceReferences"
                  class="relative h-5 w-9 cursor-pointer rounded-full bg-[#cbd1da] p-0.5 transition-colors duration-150 data-[state=checked]:bg-accent"
                  ><SwitchThumb
                    class="block size-4 rounded-full bg-white shadow-sm transition-transform duration-150 data-[state=checked]:translate-x-4" /></SwitchRoot
              ></label>
            </div>
          </div>

          <div
            class="grid min-h-[650px] grid-cols-[minmax(340px,.82fr)_minmax(440px,1.18fr)_320px] gap-5 max-[1240px]:grid-cols-2 max-[860px]:grid-cols-1"
          >
            <section
              class="flex min-h-[560px] min-w-0 flex-col overflow-hidden rounded-[22px] border border-[#e1e5eb] bg-white shadow-card"
            >
              <TabsRoot v-model="editorTab" class="flex h-full flex-col">
                <div
                  class="flex h-16 shrink-0 items-center justify-between border-b border-[#e9ecf0] px-5"
                >
                  <div>
                    <h2 class="text-[15px] font-semibold text-[#252a33]">
                      Edit your presentation
                    </h2>
                    <p class="mt-0.5 text-[11px] text-[#929aa7]">
                      Change the wording, structure, or formatting
                    </p>
                  </div>
                  <TabsList class="flex h-9 gap-1 rounded-xl bg-[#f1f3f6] p-1"
                    ><TabsTrigger
                      class="flex cursor-pointer items-center gap-1.5 rounded-lg px-3 text-[12px] font-medium text-[#78818d] data-[state=active]:bg-white data-[state=active]:text-[#252a33] data-[state=active]:shadow-sm"
                      value="markdown"
                      ><Code2 :size="15" />Content</TabsTrigger
                    ><TabsTrigger
                      class="flex cursor-pointer items-center gap-1.5 rounded-lg px-3 text-[12px] font-medium text-[#78818d] data-[state=active]:bg-white data-[state=active]:text-[#252a33] data-[state=active]:shadow-sm"
                      value="outline"
                      ><Layers3 :size="15" />Outline
                      <span class="text-[10px] text-[#9aa2ae]">{{
                        outline.length
                      }}</span></TabsTrigger
                    ></TabsList
                  >
                </div>
                <TabsContent value="markdown" class="min-h-0 flex-1">
                  <textarea
                    class="size-full resize-none border-0 bg-white px-6 py-5 font-mono text-[13px] leading-[1.8] text-[#434a55] caret-accent outline-0"
                    :value="markdown"
                    spellcheck="false"
                    aria-label="Presentation content editor"
                    @input="onMarkdownInput"
                  ></textarea>
                </TabsContent>
                <TabsContent value="outline" class="flex-1 overflow-y-auto p-4"
                  ><button
                    v-for="item in outline"
                    :key="item.index"
                    class="grid min-h-[58px] w-full cursor-pointer grid-cols-[40px_1fr_auto] items-center gap-2 rounded-xl px-3 text-left transition-[transform,background-color] duration-150 ease-snappy hover:bg-[#f5f7f9] active:scale-[.99] motion-reduce:transition-none"
                  >
                    <span class="text-[11px] text-[#9aa2ae]">{{
                      String(item.index + 1).padStart(2, "0")
                    }}</span
                    ><strong class="text-[13px] font-medium text-[#444b56]">{{
                      item.title
                    }}</strong
                    ><ArrowRight class="text-[#a1a8b3]" :size="15" /></button
                ></TabsContent>
              </TabsRoot>
            </section>

            <section
              class="flex min-h-[560px] min-w-0 flex-col overflow-hidden rounded-[22px] border border-[#d9dee6] bg-white shadow-[0_18px_55px_rgba(24,39,75,.12)]"
            >
              <div
                class="flex h-16 shrink-0 items-center justify-between border-b border-[#e9ecf0] px-5"
              >
                <div class="flex items-center gap-3">
                  <span
                    class="grid size-9 place-items-center rounded-xl bg-[#eef6ff] text-accent"
                    ><Play :size="16" fill="currentColor" /></span
                  ><span
                    ><strong
                      class="block text-[14px] font-semibold text-[#252a33]"
                      >Presentation preview</strong
                    ><small class="mt-0.5 block text-[11px] text-[#929aa7]"
                      >Your live preview starts automatically</small
                    ></span
                  >
                </div>
                <div class="flex items-center gap-2">
                  <button
                    v-if="preview.terminal.value.length"
                    class="grid size-9 cursor-pointer place-items-center rounded-xl border border-[#dfe3e9] bg-white text-[#838b98] transition-transform duration-150 ease-snappy active:scale-[.95]"
                    aria-label="Show troubleshooting details"
                    @click="showTerminal = !showTerminal"
                  >
                    <TerminalSquare :size="16" /></button
                  ><button
                    v-if="preview.status.value === 'error'"
                    class="inline-flex h-9 cursor-pointer items-center gap-2 rounded-xl bg-accent px-3.5 text-[12px] font-semibold text-white shadow-[0_7px_18px_rgba(15,124,255,.22)] transition-transform duration-150 ease-snappy active:scale-[.97]"
                    @click="startPreview"
                  >
                    <RefreshCw :size="15" />Try again
                  </button>
                </div>
              </div>
              <div
                class="preview-grid relative min-h-0 flex-1 overflow-hidden p-[clamp(18px,2.5vw,34px)]"
              >
                <div
                  v-if="preview.url.value"
                  ref="previewShell"
                  class="flex size-full min-h-0 flex-col overflow-hidden rounded-2xl border border-[#d9dee6] bg-white shadow-[0_14px_38px_rgba(29,46,79,.16)]"
                >
                  <iframe
                    ref="previewFrame"
                    class="min-h-0 w-full flex-1 border-0 bg-white"
                    :src="preview.url.value"
                    title="Presentation preview"
                    allow="fullscreen; screen-wake-lock"
                    allowfullscreen
                    @load="syncNativePreviewControls"
                  ></iframe>
                  <div
                    class="flex h-12 shrink-0 items-center justify-between border-t border-[#e4e8ee] bg-white px-3 text-[#616a77]"
                  >
                    <span
                      class="hidden items-center gap-2 px-2 text-[11px] font-medium sm:inline-flex"
                      ><span class="size-1.5 rounded-full bg-[#4db78c]"></span
                      >Live preview</span
                    >
                    <div
                      class="flex items-center gap-1 rounded-xl bg-[#f2f4f7] p-1"
                    >
                      <button
                        class="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-[12px] font-medium transition-[transform,background-color,color,box-shadow] duration-150 ease-snappy hover:bg-white hover:text-[#252a33] hover:shadow-sm active:scale-[.96]"
                        type="button"
                        aria-label="Previous slide"
                        @click="sendPreviewCommand('previous')"
                      >
                        <ChevronLeft :size="16" />Previous
                      </button>
                      <span
                        class="h-4 w-px bg-[#d9dee5]"
                        aria-hidden="true"
                      ></span>
                      <button
                        class="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-[12px] font-medium transition-[transform,background-color,color,box-shadow] duration-150 ease-snappy hover:bg-white hover:text-[#252a33] hover:shadow-sm active:scale-[.96]"
                        type="button"
                        aria-label="Next slide"
                        @click="sendPreviewCommand('next')"
                      >
                        Next<ChevronRight :size="16" />
                      </button>
                    </div>
                    <button
                      class="inline-flex h-8 cursor-pointer items-center gap-2 rounded-lg px-2.5 text-[12px] font-medium transition-[transform,background-color,color] duration-150 ease-snappy hover:bg-[#f2f4f7] hover:text-[#252a33] active:scale-[.96]"
                      type="button"
                      :aria-label="
                        isPreviewFullscreen
                          ? 'Exit fullscreen'
                          : 'Enter fullscreen'
                      "
                      @click="togglePreviewFullscreen"
                    >
                      <Minimize2
                        v-if="isPreviewFullscreen"
                        :size="16"
                      /><Maximize2 v-else :size="16" /><span
                        class="hidden sm:inline"
                        >{{
                          isPreviewFullscreen ? "Exit" : "Full screen"
                        }}</span
                      >
                    </button>
                  </div>
                </div>
                <div
                  v-else
                  class="flex size-full min-h-[400px] flex-col items-center justify-center rounded-2xl border border-[#dfe4eb] bg-white/85 text-center backdrop-blur-sm"
                >
                  <div
                    class="preview-illustration relative mb-7 h-[88px] w-[142px] rounded-xl border border-[#d9e0e9] bg-white shadow-[8px_9px_0_-3px_#eef2f7,8px_9px_0_-2px_#dfe5ed]"
                  >
                    <div></div>
                    <span class="absolute right-4 bottom-4 text-accent"
                      ><Play :size="25" fill="currentColor"
                    /></span>
                  </div>
                  <h3 class="text-[16px] font-semibold text-[#303640]">
                    {{
                      isPreviewBusy
                        ? "Preparing your presentation…"
                        : "Ready when you are"
                    }}
                  </h3>
                  <p
                    class="mx-6 mt-2 mb-5 max-w-[390px] text-[13px] leading-relaxed text-[#818996]"
                  >
                    {{ friendlyPreviewMessage }}
                  </p>
                  <button
                    v-if="preview.status.value === 'error'"
                    class="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-accent px-4 text-[13px] font-semibold text-white shadow-[0_8px_20px_rgba(15,124,255,.24)] transition-transform duration-150 ease-snappy active:scale-[.97]"
                    @click="startPreview"
                  >
                    <RefreshCw :size="16" />Try preview again
                  </button>
                  <div
                    v-else-if="isPreviewBusy"
                    class="mt-3 h-1 w-[170px] overflow-hidden rounded-full bg-[#e2e7ee]"
                  >
                    <span
                      class="preview-progress block h-full w-[42%] rounded-full bg-accent motion-reduce:animate-pulse"
                    ></span>
                  </div>
                </div>
                <div
                  v-if="showTerminal"
                  class="absolute right-8 bottom-8 left-8 max-h-[45%] overflow-hidden rounded-2xl border border-[#283448] bg-[#071426]/95 text-white shadow-[0_20px_55px_rgba(7,20,38,.28)]"
                >
                  <div
                    class="flex h-10 items-center justify-between border-b border-white/10 px-3.5 text-[11px] text-white/60"
                  >
                    <span>Troubleshooting details</span
                    ><button
                      class="cursor-pointer transition-transform duration-150 active:scale-90"
                      @click="showTerminal = false"
                    >
                      <X :size="15" />
                    </button>
                  </div>
                  <pre
                    class="m-0 max-h-[230px] overflow-auto p-4 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-white/70"
                    >{{ preview.terminal.value.join("\n") }}</pre
                  >
                </div>
              </div>
              <div
                class="flex h-9 items-center gap-2 border-t border-[#e9ecf0] px-4 text-[11px] text-[#89919d]"
                :class="{
                  'text-[#368567]': preview.status.value === 'ready',
                  'text-[#aa5862]': preview.status.value === 'error',
                }"
              >
                <span
                  class="size-1.5 rounded-full"
                  :class="
                    preview.status.value === 'ready'
                      ? 'bg-[#4db78c]'
                      : preview.status.value === 'error'
                        ? 'bg-[#d77983]'
                        : 'bg-[#a7aeb8]'
                  "
                ></span
                >{{ friendlyPreviewMessage }}
              </div>
            </section>
            <ThemeStudio
              v-model:variant="config.variant"
              v-model:accent="config.accent"
              v-model:atmosphere="config.atmosphere"
              v-model:logo="config.logo"
              v-model:logo-invert="config.logoInvert"
              class="max-[1240px]:col-span-2 max-[860px]:col-span-1"
            />
          </div>
        </div>
      </section>
    </main>
  </div>
</template>
