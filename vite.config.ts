import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import generateHandler from './api/generate'

function localGenerateApi(environment: Record<string, string>): Plugin {
  for (const name of ['LITELLM_API_KEY', 'LITELLM_BASE_URL', 'LITELLM_MODEL']) {
    if (environment[name]) process.env[name] = environment[name]
  }

  return {
    name: 'local-generate-api',
    configureServer(server) {
      server.middlewares.use('/api/generate', async (request, response, next) => {
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

        await generateHandler(localRequest as never, localResponse as never)
      })
    },
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [vue(), tailwindcss(), localGenerateApi(loadEnv(mode, process.cwd(), ''))],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    headers: {
      'Cross-Origin-Embedder-Policy': 'credentialless',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
  },
  preview: {
    headers: {
      'Cross-Origin-Embedder-Policy': 'credentialless',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
  },
}))
