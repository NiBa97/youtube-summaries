import type { Deck } from '../types'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '/api'

export type TranscriptSnippet = { text: string; start: number; duration: number }

export type TagSuggestion = { name: string; confidence: number }

export type Classification = {
  topic: string | null
  topic_confidence: number
  /** Already in the vocabulary. Safe to auto-apply above the threshold. */
  tags: TagSuggestion[]
  /** Not in the vocabulary. Always requires an explicit click. */
  new_tags: TagSuggestion[]
}

/** `tags` must be sorted most-used first - the ordering biases the model
 *  toward reuse, which is the whole point of sending it. */
export type Vocabulary = {
  topics: string[]
  tags: { name: string; count: number }[]
}

/** The sanitised comments the backend actually sent to the model. Persisted so
 *  the deck's community section stays reproducible - a re-scrape returns a
 *  different comment section. `author` is stored but never sent to the model. */
export type VideoComment = {
  text: string
  likes: number
  replies: number
  heart: boolean
  author: string
  published: string
}

export type SlidesResponse = {
  video_id: string
  deck: Deck
  duration_seconds: number
  language: string
  language_code: string
  is_generated: boolean
  /** true when no requested-language track existed and another one was used */
  language_fallback: boolean
  transcript: TranscriptSnippet[]
  classification: Classification | null
}

export type CommunityResponse = {
  video_id: string
  /** the deck sent in, with `community` and block `caveat`s filled in */
  deck: Deck
  /** empty when the comment section was disabled, thin, or had nothing to add */
  comments: VideoComment[]
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

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    let detail = `HTTP ${res.status}`
    try {
      const payload = await res.json()
      if (payload?.detail) detail = String(payload.detail)
    } catch {
      // body was not JSON
    }
    throw new Error(detail)
  }
  return res.json()
}

export async function postSlides(
  url: string,
  opts: {
    languages?: string[]
    channel?: string
    title?: string
    instructions?: string
    /** A deck of this video the reader rejected. Sent on a re-run so the model
     *  is told what has already been tried instead of landing on it again. */
    previous_deck?: Deck
    vocabulary?: Vocabulary
  } = {},
): Promise<SlidesResponse> {
  return post<SlidesResponse>('/slides', { url, ...opts })
}

export async function postClassify(input: {
  title: string
  tldr: string
  body: string
  vocabulary: Vocabulary
}): Promise<Classification> {
  return post<Classification>('/classify', input)
}

/**
 * Read a video's comments against its existing deck. Deliberately on demand:
 * the scrape reads YouTube's internals and costs seconds, and most comment
 * sections have nothing worth reporting, so it is paid for only when asked.
 * Returns the same deck with `community` and block `caveat`s filled in.
 */
export function postCommunity(url: string, deck: Deck): Promise<CommunityResponse> {
  return post<CommunityResponse>('/community', { url, deck })
}
