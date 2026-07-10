import { createHmac, timingSafeEqual } from 'node:crypto'
import { Sandbox } from '@vercel/sandbox'

export const PREVIEW_PORT = 3030
const MAX_FILES = 120
const MAX_FILE_BYTES = 3_000_000
const DEFAULT_TIMEOUT_MINUTES = 40
const MODULE_WARMUP_LIMIT = 220
const CRITICAL_MODULES = [
  '/@slidev/configs',
  '/@slidev/setups/root',
  '/node_modules/@slidev/client/setup/routes.ts',
  '/node_modules/@slidev/client/modules/v-mark.ts',
  '/node_modules/@slidev/client/modules/v-motion.ts',
  '/node_modules/@slidev/client/styles/index.ts',
]

export interface PreviewFileInput {
  path: string
  content: string
  encoding: 'utf8' | 'base64'
}

interface PreviewTokenPayload {
  sandbox: string
  expiresAt: number
}

function previewSecret(): string {
  const secret = process.env.PREVIEW_SESSION_SECRET
  if (!secret || secret.length < 32) throw new Error('Preview sessions are not configured.')
  return secret
}

function timeoutMilliseconds(): number {
  const configured = Number(process.env.PREVIEW_SANDBOX_TIMEOUT_MINUTES || DEFAULT_TIMEOUT_MINUTES)
  const minutes = Number.isFinite(configured) ? Math.min(45, Math.max(5, configured)) : DEFAULT_TIMEOUT_MINUTES
  return minutes * 60_000
}

function signature(encodedPayload: string): Buffer {
  return createHmac('sha256', previewSecret()).update(encodedPayload).digest()
}

export function createPreviewToken(payload: PreviewTokenPayload): string {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${encodedPayload}.${signature(encodedPayload).toString('base64url')}`
}

export function verifyPreviewToken(token: unknown): PreviewTokenPayload {
  if (typeof token !== 'string') throw new Error('The preview session is invalid.')
  const [encodedPayload, encodedSignature, extra] = token.split('.')
  if (!encodedPayload || !encodedSignature || extra) throw new Error('The preview session is invalid.')

  const supplied = Buffer.from(encodedSignature, 'base64url')
  const expected = signature(encodedPayload)
  if (
    supplied.toString('base64url') !== encodedSignature
    || supplied.length !== expected.length
    || !timingSafeEqual(supplied, expected)
  ) {
    throw new Error('The preview session is invalid.')
  }

  let payload: unknown
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as unknown
  } catch {
    throw new Error('The preview session is invalid.')
  }
  if (!payload || typeof payload !== 'object') throw new Error('The preview session is invalid.')
  const candidate = payload as Partial<PreviewTokenPayload>
  if (typeof candidate.sandbox !== 'string' || typeof candidate.expiresAt !== 'number') {
    throw new Error('The preview session is invalid.')
  }
  if (candidate.expiresAt <= Date.now()) throw new Error('The preview session has expired.')
  return candidate as PreviewTokenPayload
}

export function decodePreviewFiles(value: unknown): Array<{ path: string; content: string | Uint8Array }> {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_FILES) {
    throw new Error('The preview files are invalid.')
  }

  let totalBytes = 0
  return value.map((entry: unknown) => {
    if (!entry || typeof entry !== 'object') throw new Error('The preview files are invalid.')
    const file = entry as Partial<PreviewFileInput>
    if (
      typeof file.path !== 'string'
      || !/^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._/-]+$/.test(file.path)
      || typeof file.content !== 'string'
      || !['utf8', 'base64'].includes(file.encoding ?? '')
    ) throw new Error('The preview files are invalid.')

    const content = file.encoding === 'base64' ? Buffer.from(file.content, 'base64') : file.content
    totalBytes += typeof content === 'string' ? Buffer.byteLength(content) : content.byteLength
    if (totalBytes > MAX_FILE_BYTES) throw new Error('The preview project is too large.')
    return { path: file.path, content }
  })
}

async function writeProject(
  sandbox: Sandbox,
  files: Array<{ path: string; content: string | Uint8Array }>,
  initial: boolean,
) {
  if (initial) {
    await sandbox.runCommand('rm', ['-rf', 'public', 'styles'])
    await sandbox.writeFiles(files)
    return
  }

  const liveFiles = files.filter(({ path }) => path === 'slides.md' || path === 'global-top.vue' || path.startsWith('styles/') || path.startsWith('public/'))
  await sandbox.writeFiles(liveFiles)
}

async function startSlidev(sandbox: Sandbox) {
  await sandbox.runCommand({
    cmd: 'npm',
    args: ['run', 'dev', '--', '--port', String(PREVIEW_PORT)],
    cwd: sandbox.cwd,
    detached: true,
    timeoutMs: timeoutMilliseconds(),
  })
}

async function ensureSlidev(sandbox: Sandbox) {
  const running = await sandbox.runCommand('pgrep', ['-f', `slidev.*${PREVIEW_PORT}`])
  if (running.exitCode !== 0) await startSlidev(sandbox)
}

export function extractModuleUrls(source: string, sourceUrl: string): string[] {
  const origin = new URL(sourceUrl).origin
  const matches = new Set<string>()
  const patterns = [
    /\b(?:from|import)\s*(?:\(\s*)?['"]([^'"]+)['"]/g,
    /\b(?:src|href)=['"]([^'"]+)['"]/g,
  ]
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      try {
        const url = new URL(match[1] ?? '', sourceUrl)
        if (url.origin !== origin || !/^https?:$/.test(url.protocol)) continue
        if (/\.(?:png|jpe?g|gif|webp|svg|ico|woff2?|ttf|map)(?:\?|$)/i.test(url.pathname)) continue
        matches.add(url.toString())
      } catch {
        // Ignore non-URL import expressions and malformed optional assets.
      }
    }
  }
  return [...matches]
}

async function fetchWarmModule(url: string): Promise<string> {
  let lastStatus = 0
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { accept: 'text/html, application/javascript, text/css' } })
      lastStatus = response.status
      if (response.ok) return await response.text()
    } catch {
      // The port proxy can briefly lead the Vite process during cold startup.
    }
    await new Promise((resolve) => setTimeout(resolve, 200 * (attempt + 1)))
  }
  throw new Error(`Slidev module warmup failed with status ${lastStatus || 'unavailable'}.`)
}

async function warmModuleGraph(baseUrl: string) {
  const queue = [baseUrl, ...CRITICAL_MODULES.map((path) => new URL(path, baseUrl).toString())]
  const seen = new Set<string>()

  while (queue.length && seen.size < MODULE_WARMUP_LIMIT) {
    const batch = queue.splice(0, 4).filter((url) => !seen.has(url))
    batch.forEach((url) => seen.add(url))
    const results = await Promise.all(batch.map(async (url) => {
      try {
        return { source: await fetchWarmModule(url), url }
      } catch {
        return null
      }
    }))
    for (const result of results) {
      if (!result) continue
      for (const importedUrl of extractModuleUrls(result.source, result.url)) {
        if (!seen.has(importedUrl)) queue.push(importedUrl)
      }
    }
  }

  for (const path of CRITICAL_MODULES) await fetchWarmModule(new URL(path, baseUrl).toString())
}

async function waitForPreview(url: string) {
  const deadline = Date.now() + 20_000
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { redirect: 'manual' })
      if (response.ok) {
        await response.arrayBuffer()
        await warmModuleGraph(url)
        return
      }
    } catch {
      // The route exists before Slidev has finished binding to its port.
    }
    await new Promise((resolve) => setTimeout(resolve, 350))
  }
  throw new Error('Slidev did not become ready in time.')
}

export async function createPreview(filesValue: unknown) {
  const snapshotId = process.env.VERCEL_SANDBOX_SNAPSHOT_ID
  if (!snapshotId) throw new Error('The preview service has not been prepared yet.')
  const files = decodePreviewFiles(filesValue)
  const timeout = timeoutMilliseconds()
  const sandbox = await Sandbox.create({
    source: { type: 'snapshot', snapshotId },
    ports: [PREVIEW_PORT],
    timeout,
    persistent: false,
    resources: { vcpus: 2 },
    networkPolicy: 'deny-all',
    tags: { app: 'decksmith', purpose: 'slidev-preview' },
  })

  try {
    await writeProject(sandbox, files, true)
    await startSlidev(sandbox)
    const url = sandbox.domain(PREVIEW_PORT)
    await waitForPreview(url)
    const expiresAt = sandbox.expiresAt?.getTime() ?? Date.now() + timeout
    return { url, expiresAt, session: createPreviewToken({ sandbox: sandbox.name, expiresAt }) }
  } catch (error) {
    await sandbox.delete().catch(() => undefined)
    throw error
  }
}

export async function updatePreview(sessionValue: unknown, filesValue: unknown) {
  const session = verifyPreviewToken(sessionValue)
  const files = decodePreviewFiles(filesValue)
  const sandbox = await Sandbox.get({ name: session.sandbox })
  await writeProject(sandbox, files, false)
  await ensureSlidev(sandbox)
  const url = sandbox.domain(PREVIEW_PORT)
  await waitForPreview(url)
  return { url, expiresAt: session.expiresAt }
}

export async function stopPreview(sessionValue: unknown) {
  const session = verifyPreviewToken(sessionValue)
  const sandbox = await Sandbox.get({ name: session.sandbox })
  await sandbox.stop().catch(() => undefined)
  await sandbox.delete()
}
