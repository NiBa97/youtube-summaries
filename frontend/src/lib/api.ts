import type { Deck } from '../types'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '/api'

export type TranscriptSnippet = { text: string; start: number; duration: number }

export type SlidesResponse = {
  video_id: string
  deck: Deck
  duration_seconds: number
  transcript: TranscriptSnippet[]
}

export type LinkPreview = {
  url: string
  site: string
  title?: string | null
  description?: string | null
  image?: string | null
}

const previewCache = new Map<string, Promise<LinkPreview>>()

/** Unfurl a URL through the backend. Results are cached per session. */
export function getLinkPreview(url: string): Promise<LinkPreview> {
  const cached = previewCache.get(url)
  if (cached) return cached

  const pending = (async () => {
    const res = await fetch(`${BACKEND_URL}/link-preview?url=${encodeURIComponent(url)}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.json() as Promise<LinkPreview>
  })()
  previewCache.set(url, pending)
  pending.catch(() => previewCache.delete(url))
  return pending
}

export async function postSlides(
  url: string,
  opts: { languages?: string[]; channel?: string; title?: string; instructions?: string } = {},
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
