import { once } from 'node:events'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { errorMessage, requestBody } from '../../server/http.js'
import { exportPreview } from '../../server/preview.js'

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed.' })
  try {
    const body = requestBody(request)
    const artifact = await exportPreview(body.session, body.format)
    response.statusCode = 200
    response.setHeader('content-type', artifact.contentType)
    response.setHeader('content-disposition', `attachment; filename="decksmith-presentation.${artifact.extension}"`)
    response.setHeader('cache-control', 'private, no-store')
    for (let offset = 0; offset < artifact.buffer.byteLength; offset += 64 * 1024) {
      const canContinue = response.write(artifact.buffer.subarray(offset, offset + 64 * 1024))
      if (!canContinue) await once(response, 'drain')
    }
    return response.end()
  } catch (error) {
    const message = errorMessage(error)
    const status = /invalid|expired|not supported/i.test(message) ? 400 : 502
    return response.status(status).json({ error: message })
  }
}
