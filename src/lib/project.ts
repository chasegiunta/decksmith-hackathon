import type { DeckConfig, ProjectFiles } from '@/types/deck'

const slideStyles = `
@import '@fontsource/fraunces/latin-400.css';
@import '@fontsource/fraunces/latin-500.css';
@import '@fontsource/fraunces/latin-600.css';
@import '@fontsource/fraunces/latin-700.css';
@import '@fontsource/fraunces/latin-600-italic.css';
@import '@fontsource/hanken-grotesk/latin-400.css';
@import '@fontsource/hanken-grotesk/latin-500.css';
@import '@fontsource/hanken-grotesk/latin-600.css';
@import '@fontsource/hanken-grotesk/latin-700.css';
@import '@fontsource/hanken-grotesk/latin-800.css';
@import '@fontsource/plus-jakarta-sans/latin-400.css';
@import '@fontsource/plus-jakarta-sans/latin-500.css';
@import '@fontsource/plus-jakarta-sans/latin-600.css';
@import '@fontsource/plus-jakarta-sans/latin-700.css';
@import '@fontsource/plus-jakarta-sans/latin-800.css';
@import '@fontsource/archivo/latin-400.css';
@import '@fontsource/archivo/latin-500.css';
@import '@fontsource/archivo/latin-600.css';
@import '@fontsource/archivo/latin-700.css';
@import '@fontsource/archivo/latin-800.css';
@import '@fontsource/space-mono/latin-400.css';
@import '@fontsource/space-mono/latin-700.css';
@import '@fontsource/jetbrains-mono/latin-400.css';
@import '@fontsource/jetbrains-mono/latin-600.css';
@import '@fontsource/jetbrains-mono/latin-700.css';
@import '@fontsource/anton/latin-400.css';

.source-ref { position: absolute; right: var(--pad-x, 2rem); bottom: 1.2rem; font-family: var(--font-mono); font-size: .56rem; color: var(--fg-dim); opacity: .72; }
html.decksmith-embedded-preview #page-root nav { display: none !important; }
`.trim()

const previewBridge = `<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { useNav } from '@slidev/client'

const nav = useNav()

function onDecksmithMessage(event: MessageEvent) {
  if (event.source !== window.parent || !event.data || typeof event.data !== 'object') return
  const message = event.data as { type?: string; action?: string; slide?: number; fullscreen?: boolean }
  if (message.type === 'decksmith:navigate') {
    if (message.action === 'previous') void nav.prev()
    if (message.action === 'next') void nav.next()
    if (message.action === 'go' && Number.isInteger(message.slide)) void nav.go(message.slide as number)
  }
  if (message.type === 'decksmith:fullscreen' && typeof message.fullscreen === 'boolean') {
    document.documentElement.classList.toggle('decksmith-embedded-preview', !message.fullscreen)
  }
}

onMounted(() => {
  if (window.parent !== window) document.documentElement.classList.add('decksmith-embedded-preview')
  window.addEventListener('message', onDecksmithMessage)
})
onBeforeUnmount(() => {
  document.documentElement.classList.remove('decksmith-embedded-preview')
  window.removeEventListener('message', onDecksmithMessage)
})
</script>

<template></template>
`

export function createProjectFiles(
  markdown: string,
  config: DeckConfig,
  assets: Record<string, Uint8Array> = {},
): ProjectFiles {
  const files: ProjectFiles = {
    'slides.md': markdown,
    'package.json': JSON.stringify(
      {
        name: 'generated-slidev-deck',
        private: true,
        type: 'module',
        scripts: { dev: 'slidev --bind 0.0.0.0', build: 'slidev build', export: 'slidev export' },
        dependencies: {
          '@fontsource/anton': '^5.2.7',
          '@fontsource/archivo': '^5.2.8',
          '@fontsource/fraunces': '^5.2.9',
          '@fontsource/hanken-grotesk': '^5.2.8',
          '@fontsource/jetbrains-mono': '^5.2.8',
          '@fontsource/plus-jakarta-sans': '^5.2.8',
          '@fontsource/space-mono': '^5.2.9',
          '@slidev/cli': '^52.17.0',
          'playwright-chromium': '^1.61.1',
          'slidev-theme-tahta': '^0.13.2',
          echarts: '^6.1.0',
          vue: '^3.5.39',
        },
      },
      null,
      2,
    ),
    'vite.config.ts': `import { defineConfig } from 'vite'\n\nexport default defineConfig({\n  server: { host: '0.0.0.0', allowedHosts: true },\n})\n`,
    'global-top.vue': previewBridge,
    'styles/index.css': slideStyles,
    'README.md': `# ${config.title || 'Slidev deck'}\n\nGenerated with Decksmith.\n\n## Run locally\n\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n\nOpen the local URL printed by Slidev. Edit \`slides.md\` to change the deck.\n\n## Export\n\n\`\`\`bash\nnpm run export\n\`\`\`\n\nSlidev can export this presentation to PDF, PowerPoint, or PNG images.\n`,
  }

  for (const [name, content] of Object.entries(assets)) files[`public/assets/${name}`] = content
  if (Object.keys(assets).length === 0) files['public/assets/.gitkeep'] = ''
  return files
}
