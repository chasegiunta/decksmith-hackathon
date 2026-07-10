import type { VercelRequest, VercelResponse } from '@vercel/node'
import { errorMessage, requestBody } from '../../server/http.js'
import { createPreview } from '../../server/preview.js'

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed.' })
  try {
    const body = requestBody(request)
    return response.status(200).json(await createPreview(body.files))
  } catch (error) {
    const message = errorMessage(error)
    const status = /not been prepared|not configured/i.test(message) ? 503 : /invalid|too large/i.test(message) ? 400 : 502
    return response.status(status).json({ error: message })
  }
}
