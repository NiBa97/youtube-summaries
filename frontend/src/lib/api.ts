import type { Deck } from '../types'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '/api'

export type TranscriptSnippet = { text: string; start: number; duration: number }

export type SlidesResponse = {
  video_id: string
  deck: Deck
  duration_seconds: number
  transcript: TranscriptSnippet[]
}

export async function postSlides(
  url: string,
  opts: { languages?: string[]; channel?: string; title?: string } = {},
): Promise<SlidesResponse> {
  const res = await fetch(`${BACKEND_URL}/slides`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, ...opts }),
  })
  if (!res.ok) {
    let detail = `HTTP ${res.status}`
    try {
      const body = await res.json()
      if (body?.detail) detail = String(body.detail)
    } catch {
      // body was not JSON
    }
    throw new Error(detail)
  }
  return res.json()
}
