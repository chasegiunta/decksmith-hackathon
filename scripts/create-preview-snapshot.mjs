/* global console */
import { Sandbox } from '@vercel/sandbox'

const packageJson = JSON.stringify({
  name: 'decksmith-slidev-preview',
  private: true,
  type: 'module',
  scripts: { dev: 'slidev --bind 0.0.0.0' },
  dependencies: {
    '@slidev/cli': '^52.17.0',
    '@slidev/theme-apple-basic': 'latest',
    '@slidev/theme-default': 'latest',
    '@slidev/theme-seriph': 'latest',
    vue: '^3.5.39',
  },
}, null, 2)

const sandbox = await Sandbox.create({
  runtime: 'node24',
  timeout: 20 * 60_000,
  resources: { vcpus: 1 },
  persistent: false,
  networkPolicy: 'allow-all',
  tags: { app: 'decksmith', purpose: 'slidev-template' },
})

try {
  console.log('Preparing the reusable Slidev environment…')
  await sandbox.writeFiles([
    { path: 'package.json', content: packageJson },
    { path: 'slides.md', content: '# Decksmith preview' },
    { path: 'styles/index.css', content: '' },
    { path: 'vite.config.ts', content: "import { defineConfig } from 'vite'\nexport default defineConfig({ server: { host: '0.0.0.0', allowedHosts: true } })\n" },
  ])
  const install = await sandbox.runCommand({
    cmd: 'npm',
    args: ['install', '--no-audit', '--no-fund'],
    cwd: sandbox.cwd,
    timeoutMs: 10 * 60_000,
  })
  if (install.exitCode !== 0) throw new Error(await install.stderr())

  const snapshot = await sandbox.snapshot({ expiration: 0 })
  console.log(`\nSnapshot ready: ${snapshot.snapshotId}`)
  console.log('Set VERCEL_SANDBOX_SNAPSHOT_ID to this value in every Vercel environment.')
} catch (error) {
  await sandbox.delete().catch(() => undefined)
  throw error
}
