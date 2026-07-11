import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import generateHandler from './api/generate'
import previewExportHandler from './api/preview/export'
import previewStartHandler from './api/preview/start'
import previewStopHandler from './api/preview/stop'
import previewUpdateHandler from './api/preview/update'

type ApiHandler = (request: never, response: never) => Promise<unknown>

function localServerApi(environment: Record<string, string>): Plugin {
  for (const [name, value] of Object.entries(environment)) {
    if (/^(LITELLM_|PREVIEW_|VERCEL_)/.test(name) && value) process.env[name] = value
  }

  const routes: Array<[string, ApiHandler]> = [
    ['/api/generate', generateHandler],
    ['/api/preview/export', previewExportHandler],
    ['/api/preview/start', previewStartHandler],
    ['/api/preview/update', previewUpdateHandler],
    ['/api/preview/stop', previewStopHandler],
  ]

  return {
    name: 'local-server-api',
    configureServer(server) {
      for (const [path, handler] of routes) server.middlewares.use(path, async (request, response, next) => {
        if (request.url !== '/' || !request.method) return next()

        const chunks: Buffer[] = []
        for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
        const rawBody = Buffer.concat(chunks).toString('utf8')

        const localRequest = Object.assign(request, {
          body: rawBody,
          cookies: {},
          query: {},
        })
        const localResponse = Object.assign(response, {
          status(statusCode: number) {
            response.statusCode = statusCode
            return localResponse
          },
          json(payload: unknown) {
            response.setHeader('content-type', 'application/json; charset=utf-8')
            response.end(JSON.stringify(payload))
            return localResponse
          },
        })

        await handler(localRequest as never, localResponse as never)
      })
    },
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [vue(), tailwindcss(), localServerApi(loadEnv(mode, process.cwd(), ''))],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
}))
