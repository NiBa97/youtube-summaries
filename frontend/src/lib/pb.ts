import PocketBase, { type RecordModel } from 'pocketbase'
import type { Deck, Summary, TranscriptSnippet, Video } from '../types'

const PB_URL = import.meta.env.VITE_PB_URL || '/pb'

export const pb = new PocketBase(PB_URL)
pb.autoCancellation(false)

function transcriptSnippets(transcript: unknown): TranscriptSnippet[] {
  if (!Array.isArray(transcript)) return []
  return transcript.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const snippet = item as { text?: unknown; start?: unknown; duration?: unknown }
    if (typeof snippet.text !== 'string' || typeof snippet.start !== 'number' || typeof snippet.duration !== 'number') return []
    return [{ text: snippet.text, start: snippet.start, duration: snippet.duration }]
  })
}

function transcriptDurationSeconds(transcript: unknown): number {
  if (!Array.isArray(transcript)) return 0
  let end = 0
  for (const item of transcript) {
    if (!item || typeof item !== 'object') continue
    const snippet = item as { start?: unknown; duration?: unknown }
    if (typeof snippet.start === 'number' && typeof snippet.duration === 'number') {
      end = Math.max(end, snippet.start + snippet.duration)
    }
  }
  return Math.ceil(end)
}

function summaryFromDeck(deck: Deck | null): Summary {
  if (!deck) return {}
  if (deck.summary) return deck.summary

  const keypoints: string[] = []
  for (const block of deck.blocks || []) {
    if (block.type === 'claim') keypoints.push(block.title)
    if (block.type === 'list') keypoints.push(...block.items)
  }
  return { keypoints: keypoints.slice(0, 5) }
}

export type VideoRecord = RecordModel & {
  url: string
  video_id: string
  title: string
  status: 'pending' | 'transcribed' | 'slides_ready' | 'error'
  deck?: Deck | null
  transcript?: unknown
  error?: string
}

export function recordToVideo(r: VideoRecord): Video {
  const deck = (r.deck && typeof r.deck === 'object' ? r.deck : null) as Deck | null
  const transcript = transcriptSnippets(r.transcript)
  return {
    id: r.id,
    channelId: null,
    oneshot: true,
    addedBy: 'user',
    title: deck?.title || r.title || 'Untitled video',
    duration: transcriptDurationSeconds(transcript),
    publishedAt: r.created,
    addedAt: r.created,
    youtubeId: r.video_id,
    sourceUrl: r.url,
    status: 'unread',
    starred: false,
    tags: [],
    readingTime: 0,
    tldr: deck?.tldr,
    summary: summaryFromDeck(deck),
    deck,
    transcript,
  }
}

export async function listVideos(): Promise<Video[]> {
  const records = await pb.collection('videos').getFullList<VideoRecord>({ sort: '-created' })
  return records.map(recordToVideo)
}

export async function createVideo(input: {
  url: string
  video_id: string
  title: string
  deck: Deck
  transcript: unknown
}): Promise<Video> {
  const payload = { ...input, status: 'slides_ready' as const }
  let existing: VideoRecord | null = null
  try {
    existing = await pb
      .collection('videos')
      .getFirstListItem<VideoRecord>(`video_id="${input.video_id}"`)
  } catch {
    existing = null
  }
  const rec = existing
    ? await pb.collection('videos').update<VideoRecord>(existing.id, payload)
    : await pb.collection('videos').create<VideoRecord>(payload)
  return recordToVideo(rec)
}
