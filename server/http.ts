import type { VercelRequest } from '@vercel/node'

export function requestBody(request: VercelRequest): Record<string, unknown> {
  let body: unknown
  try {
    body = typeof request.body === 'string' ? JSON.parse(request.body) as unknown : request.body as unknown
  } catch {
    throw new Error('The request was invalid.')
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('The request was invalid.')
  return body as Record<string, unknown>
}

export function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : 'The preview service could not complete the request.'
}
