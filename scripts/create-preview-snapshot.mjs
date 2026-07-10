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
  ports: [3030],
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

  console.log('Warming Slidev and Vite caches…')
  await sandbox.runCommand({
    cmd: 'npm',
    args: ['run', 'dev', '--', '--port', '3030'],
    cwd: sandbox.cwd,
    detached: true,
    timeoutMs: 10 * 60_000,
  })
  const warmupScript = `
    const base = 'http://127.0.0.1:3030';
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
    for (let attempt = 0; attempt < 40; attempt++) {
      try {
        const html = await fetch(base).then(response => {
          if (!response.ok) throw new Error(String(response.status));
          return response.text();
        });
        const entry = html.match(/src=["']([^"']+)["']/)?.[1];
        const paths = [entry, '/@slidev/configs', '/@slidev/setups/root', '/node_modules/@slidev/client/setup/routes.ts'].filter(Boolean);
        for (const path of paths) await fetch(new URL(path, base)).then(response => {
          if (!response.ok) throw new Error(String(response.status));
          return response.arrayBuffer();
        });
        break;
      } catch (error) {
        if (attempt === 39) throw error;
        await wait(250);
      }
    }
  `
  const warmup = await sandbox.runCommand({ cmd: 'node', args: ['--input-type=module', '-e', warmupScript], cwd: sandbox.cwd })
  if (warmup.exitCode !== 0) throw new Error(await warmup.stderr())

  const snapshot = await sandbox.snapshot({ expiration: 0 })
  console.log(`\nSnapshot ready: ${snapshot.snapshotId}`)
  console.log('Set VERCEL_SANDBOX_SNAPSHOT_ID to this value in every Vercel environment.')
} catch (error) {
  await sandbox.delete().catch(() => undefined)
  throw error
}
