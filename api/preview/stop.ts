import type { VercelRequest, VercelResponse } from '@vercel/node'
import { errorMessage, requestBody } from '../../server/http.js'
import { stopPreview } from '../../server/preview.js'

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed.' })
  try {
    const body = requestBody(request)
    await stopPreview(body.session)
    return response.status(200).json({ stopped: true })
  } catch (error) {
    const message = errorMessage(error)
    const status = /invalid|expired/i.test(message) ? 400 : 502
    return response.status(status).json({ error: message })
  }
}
