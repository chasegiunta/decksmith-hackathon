import type { DeckConfig, ProjectFiles } from '@/types/deck'

const slideStyles = `
:root { --deck-accent: #65d8a6; }
.slidev-layout { font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
.slidev-layout h1 { color: var(--deck-accent); letter-spacing: -0.04em; }
.slidev-layout li { margin-block: .65rem; }
.deck-airy { font-size: 1.18rem; }
.deck-airy li { margin-block: 1rem; }
.deck-balanced { font-size: 1rem; }
.deck-dense { font-size: .86rem; }
.deck-dense li { margin-block: .35rem; }
.source-ref { position: absolute; right: 2rem; bottom: 1.4rem; font-size: .58rem; opacity: .48; }
`.trim()

export function createProjectFiles(
  markdown: string,
  config: DeckConfig,
  assets: Record<string, Uint8Array> = {},
): ProjectFiles {
  const files: ProjectFiles = {
    'slides.md': markdown,
    'package.json': JSON.stringify({
      name: 'generated-slidev-deck',
      private: true,
      type: 'module',
      scripts: { dev: 'slidev --bind 0.0.0.0', build: 'slidev build', export: 'slidev export' },
      dependencies: {
        '@slidev/cli': '^52.17.0',
        '@slidev/theme-apple-basic': 'latest',
        '@slidev/theme-default': 'latest',
        '@slidev/theme-seriph': 'latest',
        vue: '^3.5.39',
      },
    }, null, 2),
    'vite.config.ts': `import { defineConfig } from 'vite'\n\nexport default defineConfig({\n  server: { host: '0.0.0.0', allowedHosts: true },\n})\n`,
    'styles/index.css': slideStyles,
    'README.md': `# ${config.title || 'Slidev deck'}\n\nGenerated with Decksmith.\n\n## Run locally\n\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n\nOpen the local URL printed by Slidev. Edit \`slides.md\` to change the deck.\n`,
  }

  for (const [name, content] of Object.entries(assets)) files[`public/assets/${name}`] = content
  if (Object.keys(assets).length === 0) files['public/assets/.gitkeep'] = ''
  return files
}
