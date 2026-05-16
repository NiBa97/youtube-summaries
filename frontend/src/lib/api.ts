import type { Summary } from '../types'

const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL as string | undefined) || '/api'

export type TranscriptSnippet = { text: string; start: number; duration: number }

export type SlidesResponse = {
  video_id: string
  title: string
  tldr: string
  channel: string
  duration: number
  summary: Summary
  transcript: TranscriptSnippet[]
}

export async function generateSlides(url: string, opts?: { title?: string; channel?: string }): Promise<SlidesResponse> {
  const res = await fetch(`${BACKEND_URL}/slides`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url,
      title: opts?.title || undefined,
      channel: opts?.channel || undefined,
    }),
  })
  if (!res.ok) {
    let detail = ''
    try {
      const j = await res.json()
      detail = j?.detail || ''
    } catch {
      detail = await res.text()
    }
    throw new Error(detail || `Request failed (${res.status})`)
  }
  return (await res.json()) as SlidesResponse
}
