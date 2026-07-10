import { readonly, ref } from 'vue'
import type { FileSystemTree, WebContainer, WebContainerProcess } from '@webcontainer/api'
import type { ProjectFiles } from '@/types/deck'
import { toWebContainerTree } from '@/lib/project'

export type PreviewStatus = 'idle' | 'booting' | 'installing' | 'starting' | 'ready' | 'error' | 'unsupported'

const status = ref<PreviewStatus>('idle')
const url = ref('')
const message = ref('Preview has not been started.')
const terminal = ref<string[]>([])
let container: WebContainer | undefined
let devProcess: WebContainerProcess | undefined
let bootPromise: Promise<void> | undefined

function previewErrorMessage(error: unknown): string {
  const fallback = 'WebContainer preview failed to start.'
  if (!(error instanceof Error)) return fallback
  if (/failed to fetch|cors|networkerror/i.test(error.message)) {
    return 'The WebContainer runtime was blocked while loading. Allow cross-site data for StackBlitz domains, disable strict browser shields for this site, then reload and try again.'
  }
  return error.message || fallback
}

function appendOutput(chunk: string) {
  const cleaned = chunk.split(String.fromCodePoint(27)).map((part) => part.replace(/^\[[0-9;]*m/, '')).join('')
  terminal.value = [...terminal.value, ...cleaned.split('\n').filter(Boolean)].slice(-40)
}

function watchOutput(process: WebContainerProcess) {
  void process.output.pipeTo(new WritableStream({ write: (chunk) => appendOutput(chunk) }))
}

export function webContainerSupportError(): string | null {
  if (typeof window === 'undefined') return 'Preview is only available in a browser.'
  if (!window.isSecureContext) return 'WebContainer preview requires HTTPS or localhost.'
  if (!window.crossOriginIsolated || typeof SharedArrayBuffer === 'undefined') {
    return 'This browser session is not cross-origin isolated. Reload the local Vite URL or use a supported Chromium browser.'
  }
  return null
}

async function boot(files: ProjectFiles): Promise<void> {
  const supportError = webContainerSupportError()
  if (supportError) {
    status.value = 'unsupported'
    message.value = supportError
    throw new Error(supportError)
  }

  status.value = 'booting'
  message.value = 'Booting a browser-native Node runtime…'
  terminal.value = []
  const { WebContainer } = await import('@webcontainer/api')
  container = await WebContainer.boot({ coep: 'credentialless', forwardPreviewErrors: 'exceptions-only' })
  container.on('server-ready', (_port, serverUrl) => {
    url.value = serverUrl
    status.value = 'ready'
    message.value = 'Live Slidev preview is ready.'
  })
  container.on('error', (error) => {
    status.value = 'error'
    message.value = error.message
  })

  await container.mount(toWebContainerTree(files) as FileSystemTree)
  status.value = 'installing'
  message.value = 'Installing Slidev inside the browser…'
  const install = await container.spawn('npm', ['install', '--no-audit', '--no-fund'])
  watchOutput(install)
  if (await install.exit !== 0) throw new Error('npm install failed inside the WebContainer. Open the log and try again.')

  status.value = 'starting'
  message.value = 'Starting the Slidev development server…'
  devProcess = await container.spawn('npm', ['run', 'dev', '--', '--port', '3030'])
  watchOutput(devProcess)
}

export function useWebContainer() {
  async function start(files: ProjectFiles): Promise<void> {
    if (status.value === 'ready' && container) {
      await update(files)
      return
    }
    if (!bootPromise) {
      bootPromise = boot(files).catch((error: unknown) => {
        status.value = status.value === 'unsupported' ? 'unsupported' : 'error'
        message.value = previewErrorMessage(error)
        bootPromise = undefined
        throw error
      })
    }
    await bootPromise
  }

  async function update(files: ProjectFiles): Promise<void> {
    if (!container || status.value !== 'ready') return
    message.value = 'Syncing edits to Slidev…'
    await container.mount(toWebContainerTree(files) as FileSystemTree)
    message.value = 'Live Slidev preview is ready.'
  }

  return {
    status: readonly(status),
    url: readonly(url),
    message: readonly(message),
    terminal: readonly(terminal),
    start,
    update,
  }
}
