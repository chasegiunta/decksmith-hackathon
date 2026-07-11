<script setup lang="ts">
import {
  computed,
  defineAsyncComponent,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch,
} from "vue";
import {
  useDebounceFn,
  useDropZone,
  useFileDialog,
  useMediaQuery,
} from "@vueuse/core";
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  SplitterGroup,
  SplitterPanel,
  SplitterResizeHandle,
  TabsContent,
  TabsList,
  TabsRoot,
  TabsTrigger,
} from "reka-ui";
import {
  AnimatePresence,
  LazyMotion,
  MotionConfig,
  domMax,
  m,
  useDomRef,
  useReducedMotion,
} from "motion-v";
import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CloudUpload,
  Code2,
  FileArchive,
  FileDown,
  FileText,
  GripVertical,
  Layers3,
  LoaderCircle,
  Maximize2,
  Minimize2,
  Images,
  Play,
  Presentation,
  RefreshCw,
  Sparkles,
  TerminalSquare,
  WandSparkles,
  X,
} from "@lucide/vue";
import { HostedAiProvider } from "@/lib/ai";
import ThemeStudio from "@/components/ThemeStudio.vue";
import UiAlert from "@/components/ui/UiAlert.vue";
import UiButton from "@/components/ui/UiButton.vue";
import UiSegmentedControl from "@/components/ui/UiSegmentedControl.vue";
import UiSelect from "@/components/ui/UiSelect.vue";
import { createProjectZip, downloadBlob, slugify } from "@/lib/export";
import {
  generateMarkdown,
  parseSlideSections,
  replaceSlideSection,
  updateMarkdownHeadmatter,
} from "@/lib/markdown";
import { createProjectFiles } from "@/lib/project";
import { randomDeckAtmosphere, randomThemeVariant } from "@/lib/themes";
import { useVercelPreview } from "@/composables/useVercelPreview";
import type { PreviewExportFormat } from "@/composables/useVercelPreview";
import type { DeckConfig, ExtractedPdf, GeneratedDeck } from "@/types/deck";

type WorkStatus =
  | "idle"
  | "extracting"
  | "ready"
  | "generating"
  | "generated"
  | "error";

const toneOptions = [
  { value: "executive", label: "Professional" },
  { value: "educational", label: "Teaching" },
  { value: "persuasive", label: "Persuasive" },
  { value: "conversational", label: "Friendly" },
] as const;
const densityOptions = [
  { value: "airy", label: "Simple" },
  { value: "balanced", label: "Balanced" },
  { value: "dense", label: "Detailed" },
] as const;

const motionEase = [0.23, 1, 0.32, 1] as const;
const surfaceTransition = {
  transform: { type: "spring" as const, bounce: 0, visualDuration: 0.38 },
  opacity: { duration: 0.18, ease: motionEase },
};
const quickSurfaceTransition = {
  transform: { type: "spring" as const, bounce: 0, visualDuration: 0.28 },
  opacity: { duration: 0.14, ease: motionEase },
};
const contentCrossfadeTransition = {
  duration: 0.18,
  ease: motionEase,
};
const uploaderLayoutTransition = {
  layout: { type: "spring" as const, bounce: 0, visualDuration: 0.36 },
  scale: { duration: 0.12, ease: motionEase },
};
function heroEntranceTransition(delay: number) {
  return {
    transform: {
      type: "spring" as const,
      bounce: 0,
      visualDuration: 0.4,
      delay,
    },
    opacity: { duration: 0.18, ease: motionEase, delay },
  };
}

const MarkdownEditor = defineAsyncComponent(
  () => import("@/components/MarkdownEditor.vue"),
);

const config = reactive<DeckConfig>({
  title: "",
  variant: randomThemeVariant(),
  accent: "#0f7cff",
  atmosphere: randomDeckAtmosphere(),
  logo: "",
  logoInvert: false,
  density: "balanced",
  tone: "executive",
});
const pdf = ref<ExtractedPdf>();
const deck = ref<GeneratedDeck>();
const markdown = ref("");
const status = ref<WorkStatus>("idle");
const error = ref("");
const progress = ref({ current: 0, total: 0 });
const editorTab = ref("outline");
const selectedSlideIndex = ref(0);
const dropZone = useDomRef();
const isDraggingOver = ref(false);
const showTerminal = ref(false);
const hasManualEdits = ref(false);
const previewFrame = ref<HTMLIFrameElement>();
const previewShell = ref<HTMLElement>();
const isPreviewFullscreen = ref(false);
const exporting = ref<PreviewExportFormat>();
const isNarrowWorkspace = useMediaQuery("(max-width: 860px)");
const prefersReducedMotion = useReducedMotion();

const preview = useVercelPreview();
const slideSections = computed(() =>
  markdown.value ? parseSlideSections(markdown.value) : [],
);
const outline = computed(() =>
  slideSections.value.map(({ index, title }) => ({ index, title })),
);
const selectedSlide = computed(
  () => slideSections.value[selectedSlideIndex.value],
);
const assets = computed<Record<string, Uint8Array>>(() => {
  const result: Record<string, Uint8Array> = {};
  const cover = pdf.value?.coverPng;
  if (cover) result["source-cover.png"] = cover;
  for (const image of pdf.value?.images ?? []) result[image.id] = image.data;
  return result;
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
  pdf.value = undefined;
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
              build: "none",
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
    selectedSlideIndex.value = 0;
    editorTab.value = "outline";
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

async function rewriteDeck() {
  if (
    hasManualEdits.value &&
    !window.confirm(
      "Rewrite from the original PDF? This will replace your manual content edits.",
    )
  )
    return;
  await generateDeck();
}

function onMarkdownInput(value: string) {
  markdown.value = value;
  hasManualEdits.value = true;
}

function onSlideMarkdownInput(value: string) {
  markdown.value = replaceSlideSection(
    markdown.value,
    selectedSlideIndex.value,
    value,
  );
  hasManualEdits.value = true;
}

function openSlide(index: number) {
  selectedSlideIndex.value = index;
  editorTab.value = "slide";
  sendPreviewCommand("go", index + 1);
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

watch(
  () => slideSections.value.length,
  (length) => {
    if (selectedSlideIndex.value >= length)
      selectedSlideIndex.value = Math.max(0, length - 1);
  },
);

async function startPreview() {
  error.value = "";
  try {
    await preview.start(projectFiles.value);
  } catch {
    // The preview composable exposes a user-facing error and retry state.
  }
}

function sendPreviewCommand(
  action: "previous" | "next" | "go",
  slide?: number,
) {
  const frameWindow = previewFrame.value?.contentWindow;
  if (!frameWindow || !preview.url.value) return;
  frameWindow.postMessage(
    { type: "decksmith:navigate", action, slide },
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

async function exportPresentation(format: PreviewExportFormat) {
  error.value = "";
  exporting.value = format;
  try {
    await preview.update(projectFiles.value);
    const artifact = await preview.exportArtifact(format);
    const extension = format === "png" ? "slides-png.zip" : format;
    downloadBlob(artifact, `${slugify(config.title)}.${extension}`);
  } catch (cause) {
    error.value =
      cause instanceof Error
        ? cause.message
        : "The presentation could not be exported.";
  } finally {
    exporting.value = undefined;
  }
}

function resetPdf() {
  void preview.stop();
  pdf.value = undefined;
  deck.value = undefined;
  markdown.value = "";
  status.value = "idle";
  error.value = "";
  config.title = "";
  config.variant = randomThemeVariant();
  config.atmosphere = randomDeckAtmosphere();
}
</script>

<template>
  <MotionConfig reduced-motion="user">
    <LazyMotion :features="domMax" strict>
      <div class="min-h-screen bg-canvas text-ink">
        <header class="h-18 border-b border-white/10 bg-navy text-white">
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
                class="hidden max-w-65 items-center gap-2 truncate rounded-full border border-white/12 bg-white/[.07] px-3 py-2 text-[12px] text-white/70 lg:inline-flex"
                ><FileText :size="14" />{{ pdf.fileName
                }}<button
                  class="grid cursor-pointer place-items-center text-white/50 transition-transform duration-150 ease-snappy active:scale-90 motion-reduce:transition-none"
                  aria-label="Remove PDF"
                  @click="resetPdf"
                >
                  <X :size="14" /></button
              ></span>
              <DropdownMenuRoot v-if="markdown">
                <DropdownMenuTrigger as-child>
                  <UiButton variant="secondary" :disabled="Boolean(exporting)">
                    <LoaderCircle
                      v-if="exporting"
                      class="animate-spin motion-reduce:animate-none"
                      :size="16"
                    />
                    <FileDown v-else :size="16" />
                    {{ exporting ? "Exporting…" : "Export" }}
                    <ChevronDown v-if="!exporting" :size="14" />
                  </UiButton>
                </DropdownMenuTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuContent
                    :side-offset="8"
                    align="end"
                    class="dropdown-surface z-100 w-72 rounded-2xl border border-black/8 bg-white p-1.5 text-ink shadow-[0_18px_55px_rgba(5,16,37,.2),0_2px_8px_rgba(5,16,37,.08)] outline-none"
                  >
                    <DropdownMenuLabel
                      class="px-3 pt-2 pb-1.5 text-[11px] font-semibold tracking-[.08em] text-[#8a91a0] uppercase"
                    >
                      Share your presentation
                    </DropdownMenuLabel>
                    <DropdownMenuItem
                      class="group flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-40 data-[highlighted]:bg-[#eef6ff]"
                      :disabled="preview.status.value !== 'ready'"
                      @select="exportPresentation('pdf')"
                    >
                      <span
                        class="grid size-9 shrink-0 place-items-center rounded-xl bg-[#eaf3ff] text-accent"
                        ><FileDown :size="18"
                      /></span>
                      <span
                        ><strong class="block text-[13px] font-semibold"
                          >PDF document</strong
                        ><small class="mt-0.5 block text-[11px] text-[#777f8d]"
                          >Best for sharing and printing</small
                        ></span
                      >
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      class="group flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-40 data-[highlighted]:bg-[#eef6ff]"
                      :disabled="preview.status.value !== 'ready'"
                      @select="exportPresentation('pptx')"
                    >
                      <span
                        class="grid size-9 shrink-0 place-items-center rounded-xl bg-[#fff1e8] text-[#dc5a1f]"
                        ><Presentation :size="18"
                      /></span>
                      <span
                        ><strong class="block text-[13px] font-semibold"
                          >PowerPoint</strong
                        ><small class="mt-0.5 block text-[11px] text-[#777f8d]"
                          >Open in PowerPoint or Keynote</small
                        ></span
                      >
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      class="group flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-40 data-[highlighted]:bg-[#eef6ff]"
                      :disabled="preview.status.value !== 'ready'"
                      @select="exportPresentation('png')"
                    >
                      <span
                        class="grid size-9 shrink-0 place-items-center rounded-xl bg-[#edf8f3] text-[#21835f]"
                        ><Images :size="18"
                      /></span>
                      <span
                        ><strong class="block text-[13px] font-semibold"
                          >PNG images</strong
                        ><small class="mt-0.5 block text-[11px] text-[#777f8d]"
                          >One image per slide, in a ZIP</small
                        ></span
                      >
                    </DropdownMenuItem>
                    <DropdownMenuSeparator class="mx-2 my-1 h-px bg-black/7" />
                    <DropdownMenuItem
                      class="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 outline-none select-none data-[highlighted]:bg-[#f3f5f8]"
                      @select="downloadMarkdown"
                    >
                      <span
                        class="grid size-9 shrink-0 place-items-center rounded-xl bg-[#f1f3f6] text-[#596171]"
                        ><FileText :size="18"
                      /></span>
                      <span
                        ><strong class="block text-[13px] font-semibold"
                          >Markdown</strong
                        ><small class="mt-0.5 block text-[11px] text-[#777f8d]"
                          >Just the presentation content</small
                        ></span
                      >
                    </DropdownMenuItem>
                    <DropdownMenuLabel
                      class="px-3 pt-2 pb-1 text-[10px] font-semibold tracking-[.08em] text-[#a0a6b1] uppercase"
                      >Advanced</DropdownMenuLabel
                    >
                    <DropdownMenuItem
                      class="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 outline-none select-none data-[highlighted]:bg-[#f3f5f8]"
                      @select="downloadProject"
                    >
                      <span
                        class="grid size-9 shrink-0 place-items-center rounded-xl bg-[#f1f3f6] text-[#596171]"
                        ><FileArchive :size="18"
                      /></span>
                      <span
                        ><strong class="block text-[13px] font-semibold"
                          >Slidev project</strong
                        ><small class="mt-0.5 block text-[11px] text-[#777f8d]"
                          >Source files for developers</small
                        ></span
                      >
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenuPortal>
              </DropdownMenuRoot>
            </div>
          </div>
        </header>

        <main
          class="h-[calc(100vh-72px)] overflow-auto bg-navy max-[720px]:h-auto max-[720px]:min-h-[calc(100vh-72px)]"
        >
          <AnimatePresence mode="wait">
            <m.section
              v-if="!markdown"
              key="upload"
              class="upload-gradient flex min-h-full flex-col items-center px-6 py-12 text-center text-white max-[720px]:px-4"
              :exit="{ opacity: 0 }"
              :transition="{ opacity: { duration: 0.16, ease: motionEase } }"
            >
              <div class="max-w-240">
                <m.div
                  class="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[.07] px-4 py-2 text-[11px] font-semibold tracking-[0.12em] text-white/75 uppercase backdrop-blur-xl"
                  :initial="
                    prefersReducedMotion
                      ? { opacity: 0 }
                      : { opacity: 0, transform: 'translateY(-10px)' }
                  "
                  :animate="{ opacity: 1, transform: 'translateY(0px)' }"
                  :transition="heroEntranceTransition(0.04)"
                >
                  <Sparkles :size="15" />From document to deck, in minutes
                </m.div>
                <m.h1
                  class="text-[clamp(42px,5.5vw,72px)] leading-[1.02] font-[450] tracking-[-0.045em] text-white text-shadow-lg"
                  :initial="
                    prefersReducedMotion
                      ? { opacity: 0 }
                      : { opacity: 0, transform: 'translateY(-12px)' }
                  "
                  :animate="{ opacity: 1, transform: 'translateY(0px)' }"
                  :transition="heroEntranceTransition(0.1)"
                >
                  Your document has a story.<br /><span
                    class="text-[#a9d8ff] text-shadow-lg text-shadow-blue-950"
                    >Bring it to life.</span
                  >
                </m.h1>
                <m.p
                  class="mx-auto mt-5 max-w-170 text-[17px] leading-[1.65] text-blue-100"
                  :initial="
                    prefersReducedMotion
                      ? { opacity: 0 }
                      : { opacity: 0, transform: 'translateY(-10px)' }
                  "
                  :animate="{ opacity: 1, transform: 'translateY(0px)' }"
                  :transition="heroEntranceTransition(0.16)"
                >
                  Upload a report, proposal, or guide. Decksmith finds the
                  narrative and turns it into a presentation you can shape and
                  share.
                </m.p>
              </div>

              <m.button
                ref="dropZone"
                type="button"
                layout="size"
                :layout-dependency="Boolean(pdf)"
                :transition="uploaderLayoutTransition"
                :while-press="
                  prefersReducedMotion ? undefined : { scale: 0.99 }
                "
                class="relative mt-9 block w-full max-w-162.5 cursor-pointer overflow-hidden rounded-[26px] bg-linear-to-b from-white to-white/95 ring ring-white text-[#151a24] shadow-lg shadow-blue-950/50 transition-shadow duration-150 ease-snappy hover:shadow-xl motion-reduce:transition-none"
                :class="isDraggingOver ? 'ring-4 ring-white/25' : ''"
                @click="openFileDialog()"
              >
                <AnimatePresence mode="popLayout" :initial="false">
                  <m.div
                    v-if="pdf"
                    key="selected-pdf"
                    layout
                    class="flex w-full flex-col items-center justify-center p-8"
                    :initial="{ opacity: 0 }"
                    :animate="{ opacity: 1 }"
                    :exit="{ opacity: 0 }"
                    :transition="{
                      ...uploaderLayoutTransition,
                      opacity: contentCrossfadeTransition,
                    }"
                  >
                    <span
                      class="mb-3 grid size-12 place-items-center rounded-2xl bg-[#eaf8f1] text-[#24845f]"
                    >
                      <Check :size="23" :stroke-width="2.2" />
                    </span>
                    <strong
                      class="max-w-full truncate text-[16px] font-semibold tracking-[-0.01em]"
                    >
                      {{ pdf.fileName }}
                    </strong>
                    <span class="mt-1 text-[13px] text-[#7c8592]">
                      {{ pdf.pageCount }} pages<span v-if="pdf.images.length">
                        · {{ pdf.images.length }} usable
                        {{ pdf.images.length === 1 ? "image" : "images" }}</span
                      >
                      · Ready to create
                    </span>
                    <small
                      class="mt-3 text-[11px] font-medium text-accent shrink-0"
                      >Choose a different PDF</small
                    >
                  </m.div>
                  <m.div
                    v-else
                    key="empty-upload"
                    layout
                    class="flex w-full flex-col items-center justify-center p-8"
                    :initial="{ opacity: 0 }"
                    :animate="{ opacity: 1 }"
                    :exit="{ opacity: 0 }"
                    :transition="{
                      ...uploaderLayoutTransition,
                      opacity: contentCrossfadeTransition,
                    }"
                  >
                    <span
                      class="mb-4 grid size-14 shrink-0 place-items-center rounded-2xl bg-[#eef6ff] text-accent"
                    >
                      <CloudUpload :size="28" :stroke-width="1.8" />
                    </span>
                    <strong class="text-[17px] font-semibold tracking-[-0.01em]"
                      >Drop your PDF here</strong
                    >
                    <span class="mt-1.5 text-[14px] text-[#808897]"
                      >or choose a file from your computer</span
                    >
                    <span
                      class="mt-5 inline-flex min-h-9 items-center rounded-xl text-shadow-2xs ring-blue-700/70 inset-shadow-xs inset-shadow-blue-400 ring bg-linear-to-b bg-accent from-blue-500 via-accent to-blue-700/60 px-5 text-[13px] font-semibold text-white shadow-md shadow-blue-800/30"
                      >Choose a PDF</span
                    >
                    <small class="mt-3 text-[11px] text-[#a0a7b2]"
                      >Up to 25 MB · 80 pages</small
                    >
                  </m.div>
                </AnimatePresence>
              </m.button>

              <div
                v-if="status === 'extracting'"
                class="mt-5 flex items-center gap-2 text-[13px] text-white/75"
              >
                <LoaderCircle
                  class="animate-spin motion-reduce:animate-none"
                  :size="18"
                />Reading page {{ progress.current }} of
                {{ progress.total || "…" }}
              </div>

              <article
                class="mt-6 w-full max-w-162.5 rounded-[22px] ring ring-gray-600/50 bg-white py-4 px-4 text-left text-[#252a33] shadow-lg shadow-blue-800/30"
              >
                <label
                  class="grid gap-1.5 text-[12px] font-medium text-[#5d6572]"
                >
                  Presentation title
                  <input
                    v-model="config.title"
                    class="h-10 w-full rounded-lg border border-[#dce1e8] bg-[#fbfcfd] px-3 text-[13px] font-normal text-[#262b34]"
                    placeholder="Untitled presentation"
                  />
                </label>
                <div
                  class="mt-3 grid grid-cols-2 gap-4 max-[620px]:grid-cols-1"
                >
                  <div>
                    <label
                      class="grid gap-1 text-[12px] font-medium text-[#5d6572]"
                    >
                      Voice
                      <UiSelect v-model="config.tone" :options="toneOptions" />
                    </label>
                  </div>
                  <div class="grid gap-1">
                    <span class="text-[12px] font-medium text-[#5d6572]"
                      >Amount of detail</span
                    >
                    <UiSegmentedControl
                      v-model="config.density"
                      :options="densityOptions"
                      label="Amount of detail"
                    />
                  </div>
                </div>
                <UiAlert v-if="error" class="mt-4">
                  {{ error }}
                </UiAlert>
                <UiButton
                  size="lg"
                  class="mt-3 w-full"
                  :disabled="!canGenerate"
                  @click="generateDeck"
                >
                  <LoaderCircle
                    v-if="status === 'generating'"
                    class="animate-spin motion-reduce:animate-none"
                    :size="19"
                  />
                  <WandSparkles v-else :size="19" />
                  {{
                    status === "generating"
                      ? "Creating your presentation…"
                      : "Create my presentation"
                  }}
                  <ArrowRight
                    v-if="status !== 'generating'"
                    class="ml-auto"
                    :size="18"
                  />
                </UiButton>
              </article>

              <div
                class="mt-9 grid w-full max-w-225 grid-cols-3 border-t border-white/12 pt-7 text-left max-[720px]:grid-cols-1 max-[720px]:gap-4"
              >
                <div class="flex items-center justify-center gap-3">
                  <span
                    class="grid size-10 place-items-center rounded-xl bg-white/8 text-[#b9ddff]"
                    ><FileText :size="19"
                  /></span>
                  <span
                    ><strong class="block text-[13px] font-medium text-white/85"
                      >Works with real documents</strong
                    ><small class="mt-1 block text-[11px] text-white/45"
                      >Reports, proposals, guides, and more</small
                    ></span
                  >
                </div>
                <div class="flex items-center justify-center gap-3">
                  <span
                    class="grid size-10 place-items-center rounded-xl bg-white/8 text-[#b9ddff]"
                    ><WandSparkles :size="19"
                  /></span>
                  <span
                    ><strong class="block text-[13px] font-medium text-white/85"
                      >Organized by ideas</strong
                    ><small class="mt-1 block text-[11px] text-white/45"
                      >Not one slide per page</small
                    ></span
                  >
                </div>
                <div class="flex items-center justify-center gap-3">
                  <span
                    class="grid size-10 place-items-center rounded-xl bg-white/8 text-[#b9ddff]"
                    ><Layers3 :size="19"
                  /></span>
                  <span
                    ><strong class="block text-[13px] font-medium text-white/85"
                      >Everything stays editable</strong
                    ><small class="mt-1 block text-[11px] text-white/45"
                      >Change the words, style, and structure</small
                    ></span
                  >
                </div>
              </div>
            </m.section>

            <m.section
              v-else
              key="workspace"
              class="h-full overflow-hidden bg-[#f7f9fc] bg-[radial-gradient(#dce2ea_1px,transparent_1px)] bg-size-[16px_16px] max-[860px]:h-auto max-[860px]:min-h-full max-[860px]:overflow-visible"
              :initial="
                prefersReducedMotion
                  ? { opacity: 0 }
                  : { opacity: 0, transform: 'translateY(12px)' }
              "
              :animate="{ opacity: 1, transform: 'translateY(0px)' }"
              :exit="{ opacity: 0 }"
              :transition="surfaceTransition"
            >
              <div class="mx-auto h-full">
                <SplitterGroup
                  :direction="isNarrowWorkspace ? 'vertical' : 'horizontal'"
                  :auto-save-id="
                    isNarrowWorkspace
                      ? 'decksmith-workspace-vertical'
                      : 'decksmith-workspace-horizontal'
                  "
                  class="h-full min-h-0 w-full max-[860px]:h-75"
                >
                  <SplitterPanel
                    :default-size="42"
                    :min-size="28"
                    class="min-w-148 pr-2 pl-6 pt-6 pb-6"
                  >
                    <section
                      class="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-[22px] border border-[#e1e5eb] bg-white shadow-lg"
                    >
                      <ThemeStudio
                        v-model:variant="config.variant"
                        v-model:accent="config.accent"
                        v-model:atmosphere="config.atmosphere"
                      />
                      <TabsRoot
                        v-model="editorTab"
                        class="flex min-h-0 flex-1 flex-col"
                      >
                        <div
                          class="flex h-16 shrink-0 items-center justify-between border-b border-[#e9ecf0] px-5"
                        >
                          <div>
                            <h2
                              class="text-[15px] font-semibold text-[#252a33]"
                            >
                              Edit your presentation
                            </h2>
                            <p class="mt-0.5 text-[11px] text-[#929aa7]">
                              Change the wording, structure, or formatting
                            </p>
                          </div>
                          <TabsList
                            class="flex h-9 gap-1 rounded-xl bg-[#f1f3f6] p-1"
                            ><TabsTrigger
                              class="flex cursor-pointer items-center gap-1.5 rounded-lg px-3 text-[12px] font-medium text-[#78818d] data-[state=active]:bg-white data-[state=active]:text-[#252a33] data-[state=active]:shadow-sm"
                              value="outline"
                              ><Layers3 :size="15" />Outline
                              <span class="text-[10px] text-[#9aa2ae]">{{
                                outline.length
                              }}</span></TabsTrigger
                            ><TabsTrigger
                              class="flex cursor-pointer items-center gap-1.5 rounded-lg px-3 text-[12px] font-medium text-[#78818d] data-[state=active]:bg-white data-[state=active]:text-[#252a33] data-[state=active]:shadow-sm"
                              value="slide"
                              >Slide {{ selectedSlideIndex + 1 }}</TabsTrigger
                            ><TabsTrigger
                              class="flex cursor-pointer items-center gap-1.5 rounded-lg px-3 text-[12px] font-medium text-[#78818d] data-[state=active]:bg-white data-[state=active]:text-[#252a33] data-[state=active]:shadow-sm"
                              value="markdown"
                              ><Code2 :size="15" />Full deck</TabsTrigger
                            ></TabsList
                          >
                        </div>
                        <TabsContent
                          value="slide"
                          class="flex min-h-0 flex-1 flex-col"
                        >
                          <div
                            class="flex h-11 shrink-0 items-center justify-between border-b border-[#eef0f3] px-5 text-[11px] text-[#858e9b]"
                          >
                            <span>Slide {{ selectedSlideIndex + 1 }}</span>
                            <strong
                              class="truncate font-medium text-[#515966]"
                              >{{ selectedSlide?.title }}</strong
                            >
                          </div>
                          <MarkdownEditor
                            :key="selectedSlideIndex"
                            class="min-h-0 flex-1"
                            :model-value="selectedSlide?.content || ''"
                            :label="`Markdown for slide ${selectedSlideIndex + 1}`"
                            @update:model-value="onSlideMarkdownInput"
                          />
                        </TabsContent>
                        <TabsContent value="markdown" class="min-h-0 flex-1">
                          <MarkdownEditor
                            :model-value="markdown"
                            label="Presentation content editor"
                            @update:model-value="onMarkdownInput"
                          />
                        </TabsContent>
                        <TabsContent
                          value="outline"
                          class="min-h-0 flex-1 overflow-y-auto p-4"
                          ><button
                            v-for="item in outline"
                            :key="item.index"
                            class="grid min-h-14 w-full cursor-pointer grid-cols-[40px_1fr_auto] items-center gap-2 rounded-xl px-3 text-left transition-[transform,background-color] duration-150 ease-snappy hover:bg-[#f5f7f9] active:scale-[.99] motion-reduce:transition-none"
                            :class="{
                              'bg-slate-50 ring ring-gray-400/30 shadow':
                                selectedSlideIndex === item.index,
                            }"
                            @click="openSlide(item.index)"
                          >
                            <span class="text-[11px] text-[#9aa2ae]">{{
                              String(item.index + 1).padStart(2, "0")
                            }}</span
                            ><strong
                              class="text-[13px] font-medium text-[#444b56]"
                              >{{ item.title }}</strong
                            ><ArrowRight
                              class="text-[#a1a8b3]"
                              :size="15"
                            /></button
                        ></TabsContent>
                        <footer
                          class="shrink-0 border-t border-[#e9ecf0] bg-[#fbfcfd] p-3.5"
                        >
                          <UiAlert v-if="error" class="mb-3" compact>
                            {{ error }}
                          </UiAlert>
                          <div
                            class="flex flex-wrap items-end justify-between gap-3"
                          >
                            <label
                              class="grid min-w-[145px] flex-1 gap-1.5 text-[11px] font-medium text-[#69717d]"
                              >Voice<UiSelect
                                v-model="config.tone"
                                class="w-full"
                                :options="toneOptions"
                                size="sm"
                            /></label>
                            <div class="ml-auto text-right">
                              <UiButton
                                variant="secondary"
                                :disabled="status === 'generating'"
                                @click="rewriteDeck"
                              >
                                <LoaderCircle
                                  v-if="status === 'generating'"
                                  class="animate-spin motion-reduce:animate-none"
                                  :size="15"
                                /><WandSparkles v-else :size="15" />{{
                                  status === "generating"
                                    ? "Rewriting…"
                                    : "Rewrite"
                                }}
                              </UiButton>
                            </div>
                          </div>
                        </footer>
                      </TabsRoot>
                    </section>
                  </SplitterPanel>
                  <SplitterResizeHandle
                    class="group relative grid w-5 shrink-0 cursor-col-resize place-items-center outline-none max-[860px]:h-5 max-[860px]:w-full max-[860px]:cursor-row-resize"
                  >
                    <span
                      class="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-[#d8dee7] transition-colors duration-150 group-data-[state=drag]:bg-accent group-focus-visible:bg-accent max-[860px]:inset-x-0 max-[860px]:top-1/2 max-[860px]:h-px max-[860px]:w-auto max-[860px]:-translate-y-1/2 max-[860px]:translate-x-0"
                    ></span>
                    <span
                      class="relative grid h-9 w-4 place-items-center rounded-full border border-[#d8dee7] bg-white text-[#9aa2ae] shadow-sm transition-[border-color,color,transform] duration-150 group-hover:border-[#b9c2ce] group-hover:text-[#687281] group-data-[state=drag]:scale-105 group-data-[state=drag]:border-accent group-data-[state=drag]:text-accent group-focus-visible:border-accent group-focus-visible:text-accent max-[860px]:h-4 max-[860px]:w-9"
                      ><GripVertical class="max-[860px]:rotate-90" :size="12"
                    /></span>
                  </SplitterResizeHandle>
                  <SplitterPanel
                    :default-size="58"
                    :min-size="38"
                    class="min-w-0 pl-2 pt-6 pb-6 pr-6"
                  >
                    <section
                      class="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-[22px] border border-[#d9dee6] bg-white shadow-lg"
                    >
                      <div
                        class="flex h-16 shrink-0 items-center justify-between border-b border-[#e9ecf0] px-5"
                      >
                        <div class="flex items-center gap-3">
                          <span
                            class="grid size-9 place-items-center rounded-xl bg-[#eef6ff] text-accent"
                            ><Play :size="16" fill="currentColor"
                          /></span>
                          <div>
                            <h2
                              class="text-[14px] font-semibold text-[#252a33]"
                            >
                              Presentation preview
                            </h2>
                            <small
                              class="mt-0.5 block text-[11px] text-[#929aa7]"
                              >Your live preview starts automatically</small
                            >
                          </div>
                        </div>
                        <div class="flex items-center gap-2">
                          <UiButton
                            v-if="preview.terminal.value.length"
                            variant="icon"
                            size="icon"
                            aria-label="Show troubleshooting details"
                            @click="showTerminal = !showTerminal"
                          >
                            <TerminalSquare :size="16" /></UiButton
                          ><UiButton
                            v-if="preview.status.value === 'error'"
                            size="sm"
                            @click="startPreview"
                          >
                            <RefreshCw :size="15" />Try again
                          </UiButton>
                        </div>
                      </div>
                      <div
                        class="preview-grid relative min-h-0 flex-1 overflow-hidden"
                      >
                        <div
                          v-if="preview.url.value"
                          ref="previewShell"
                          class="flex size-full min-h-0 flex-col overflow-hidden"
                        >
                          <m.div
                            class="flex size-full min-h-0 flex-col overflow-hidden"
                            :initial="
                              prefersReducedMotion
                                ? { opacity: 0 }
                                : { opacity: 0, transform: 'scale(0.985)' }
                            "
                            :animate="{ opacity: 1, transform: 'scale(1)' }"
                            :transition="quickSurfaceTransition"
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
                                class="hidden min-w-0 items-center gap-2 px-2 text-[11px] font-medium sm:inline-flex"
                                :class="{
                                  'text-[#368567]':
                                    preview.status.value === 'ready',
                                  'text-[#aa5862]':
                                    preview.status.value === 'error',
                                }"
                                ><span
                                  class="size-1.5 shrink-0 rounded-full"
                                  :class="
                                    preview.status.value === 'ready'
                                      ? 'bg-[#4db78c]'
                                      : preview.status.value === 'error'
                                        ? 'bg-[#d77983]'
                                        : 'bg-[#a7aeb8]'
                                  "
                                ></span
                                ><span class="truncate">{{
                                  friendlyPreviewMessage
                                }}</span></span
                              >
                              <div
                                class="flex items-center gap-1 rounded-xl bg-[#f2f4f7] p-1"
                              >
                                <UiButton
                                  variant="ghost"
                                  size="compact"
                                  aria-label="Previous slide"
                                  @click="sendPreviewCommand('previous')"
                                >
                                  <ChevronLeft :size="16" />Previous
                                </UiButton>
                                <span
                                  class="h-4 w-px bg-[#d9dee5]"
                                  aria-hidden="true"
                                ></span>
                                <UiButton
                                  variant="ghost"
                                  size="compact"
                                  aria-label="Next slide"
                                  @click="sendPreviewCommand('next')"
                                >
                                  Next<ChevronRight :size="16" />
                                </UiButton>
                              </div>
                              <UiButton
                                variant="ghost"
                                size="compact"
                                class="px-2.5"
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
                              </UiButton>
                            </div>
                          </m.div>
                        </div>
                        <m.div
                          v-else
                          class="flex size-full min-h-[400px] flex-col items-center justify-center rounded-2xl border border-[#dfe4eb] bg-white/85 text-center backdrop-blur-sm"
                          :initial="
                            prefersReducedMotion
                              ? { opacity: 0 }
                              : { opacity: 0, transform: 'scale(0.985)' }
                          "
                          :animate="{ opacity: 1, transform: 'scale(1)' }"
                          :transition="quickSurfaceTransition"
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
                          <UiButton
                            v-if="preview.status.value === 'error'"
                            @click="startPreview"
                          >
                            <RefreshCw :size="16" />Try preview again
                          </UiButton>
                          <div
                            v-else-if="isPreviewBusy"
                            class="mt-3 h-1 w-[170px] overflow-hidden rounded-full bg-[#e2e7ee]"
                          >
                            <span
                              class="preview-progress block h-full w-[42%] rounded-full bg-accent motion-reduce:animate-pulse"
                            ></span>
                          </div>
                        </m.div>
                        <AnimatePresence :initial="false">
                          <m.div
                            v-if="showTerminal"
                            key="terminal"
                            class="absolute right-8 bottom-8 left-8 max-h-[45%] overflow-hidden rounded-2xl border border-[#283448] bg-[#071426]/95 text-white shadow-[0_20px_55px_rgba(7,20,38,.28)]"
                            :initial="
                              prefersReducedMotion
                                ? { opacity: 0 }
                                : {
                                    opacity: 0,
                                    transform: 'translateY(10px) scale(0.985)',
                                  }
                            "
                            :animate="{
                              opacity: 1,
                              transform: 'translateY(0px) scale(1)',
                            }"
                            :exit="
                              prefersReducedMotion
                                ? { opacity: 0 }
                                : {
                                    opacity: 0,
                                    transform: 'translateY(6px) scale(0.99)',
                                  }
                            "
                            :transition="quickSurfaceTransition"
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
                          </m.div>
                        </AnimatePresence>
                      </div>
                    </section>
                  </SplitterPanel>
                </SplitterGroup>
              </div>
            </m.section>
          </AnimatePresence>
        </main>
      </div>
    </LazyMotion>
  </MotionConfig>
</template>
