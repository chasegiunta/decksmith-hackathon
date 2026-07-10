import type { VercelRequest, VercelResponse } from '@vercel/node'
import { errorMessage, requestBody } from '../../server/http.js'
import { updatePreview } from '../../server/preview.js'

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed.' })
  try {
    const body = requestBody(request)
    return response.status(200).json(await updatePreview(body.session, body.files))
  } catch (error) {
    const message = errorMessage(error)
    const status = /invalid|expired|too large/i.test(message) ? 400 : 502
    return response.status(status).json({ error: message })
  }
}
