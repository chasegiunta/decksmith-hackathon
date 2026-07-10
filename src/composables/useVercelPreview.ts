import { readonly, ref } from 'vue'
import type { ProjectFiles } from '@/types/deck'

export type PreviewStatus = 'idle' | 'creating' | 'starting' | 'syncing' | 'ready' | 'error'

interface PreviewResponse {
  url?: string
  session?: string
  expiresAt?: number
  error?: string
}

const status = ref<PreviewStatus>('idle')
const url = ref('')
const message = ref('Preview has not been started.')
const terminal = ref<string[]>([])
let session = ''
let startPromise: Promise<void> | undefined
let updateQueue = Promise.resolve()

function log(line: string) {
  terminal.value = [...terminal.value, line].slice(-40)
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192))
  }
  return btoa(binary)
}

export function serializeProjectFiles(files: ProjectFiles) {
  return Object.entries(files).map(([path, content]) => typeof content === 'string'
    ? { path, content, encoding: 'utf8' as const }
    : { path, content: bytesToBase64(content), encoding: 'base64' as const })
}

async function previewRequest(path: string, body: Record<string, unknown>, keepalive = false): Promise<PreviewResponse> {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    keepalive,
  })
  const result = await response.json().catch(() => ({})) as PreviewResponse
  if (!response.ok) throw new Error(result.error || 'The presentation preview could not be reached.')
  return result
}

async function create(files: ProjectFiles) {
  status.value = 'creating'
  message.value = 'Preparing a private presentation workspace…'
  terminal.value = []
  log('Creating a secure preview workspace…')

  const result = await previewRequest('/api/preview/start', { files: serializeProjectFiles(files) })
  if (!result.url || !result.session) throw new Error('The preview service returned an incomplete response.')
  status.value = 'starting'
  message.value = 'Opening your presentation…'
  log('Slidev is ready. Opening the live preview…')
  session = result.session
  url.value = result.url
  status.value = 'ready'
  message.value = 'Live Slidev preview is ready.'
}

export function useVercelPreview() {
  async function start(files: ProjectFiles): Promise<void> {
    if (status.value === 'ready' && session) return update(files)
    if (session) await stop()
    if (!startPromise) {
      startPromise = create(files).catch((error: unknown) => {
        status.value = 'error'
        message.value = error instanceof Error ? error.message : 'The presentation preview could not start.'
        log(message.value)
        throw error
      }).finally(() => { startPromise = undefined })
    }
    await startPromise
  }

  async function update(files: ProjectFiles): Promise<void> {
    if (!session || !['ready', 'syncing'].includes(status.value)) return
    updateQueue = updateQueue.catch(() => undefined).then(async () => {
      status.value = 'syncing'
      message.value = 'Saving your latest changes…'
      const result = await previewRequest('/api/preview/update', { session, files: serializeProjectFiles(files) })
      if (result.url) url.value = result.url
      status.value = 'ready'
      message.value = 'Live Slidev preview is ready.'
    }).catch((error: unknown) => {
      status.value = 'error'
      message.value = error instanceof Error ? error.message : 'The preview could not be updated.'
      log(message.value)
    })
    await updateQueue
  }

  async function stop(keepalive = false): Promise<void> {
    const activeSession = session
    session = ''
    url.value = ''
    status.value = 'idle'
    message.value = 'Preview has not been started.'
    if (!activeSession) return
    await previewRequest('/api/preview/stop', { session: activeSession }, keepalive).catch(() => undefined)
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', () => { void stop(true) }, { once: true })
  }

  return {
    status: readonly(status),
    url: readonly(url),
    message: readonly(message),
    terminal: readonly(terminal),
    start,
    update,
    stop,
  }
}
