import { createHmac, timingSafeEqual } from 'node:crypto'
import { Sandbox } from '@vercel/sandbox'

export const PREVIEW_PORT = 3030
const MAX_FILES = 120
const MAX_FILE_BYTES = 3_000_000
const DEFAULT_TIMEOUT_MINUTES = 40

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
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
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

  const liveFiles = files.filter(({ path }) => path === 'slides.md' || path.startsWith('styles/') || path.startsWith('public/'))
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

async function waitForPreview(url: string) {
  const deadline = Date.now() + 20_000
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { method: 'HEAD', redirect: 'manual' })
      if (response.ok) return
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
    resources: { vcpus: 1 },
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
  await sandbox.delete()
}
