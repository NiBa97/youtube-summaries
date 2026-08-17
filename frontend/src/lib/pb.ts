import PocketBase, { type RecordModel } from 'pocketbase'
import type { Deck, Status, Summary, TagSource, TranscriptSnippet, Video } from '../types'

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
  /** Write-only for now: stored for reproducibility, read via the PB admin UI.
   *  The reading UI gets its community section from `deck`. */
  comments?: unknown
  instructions?: string
  error?: string
  topic?: string
  tags?: string[]
  tag_source?: unknown
  read_status?: Status | ''
  starred?: boolean
}

const VIDEO_EXPAND = 'topic,tags'

function tagSource(value: unknown): TagSource {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const out: TagSource = {}
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (v === 'ai' || v === 'human') out[k] = v
  }
  return out
}

/** Names come from the expand so the list can render tags without holding the
 *  whole vocabulary; ids are what every filter and write actually uses. */
function expandedTagNames(r: VideoRecord): string[] {
  const expanded = (r.expand as Record<string, unknown> | undefined)?.tags
  if (!Array.isArray(expanded)) return []
  return expanded.map((t) => String((t as { name?: unknown }).name || '')).filter(Boolean)
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
    status: r.read_status || 'unread',
    starred: !!r.starred,
    topicId: r.topic || null,
    tagIds: Array.isArray(r.tags) ? r.tags : [],
    tags: expandedTagNames(r),
    tagSource: tagSource(r.tag_source),
    readingTime: 0,
    tldr: deck?.tldr,
    instructions: r.instructions || '',
    summary: summaryFromDeck(deck),
    deck,
    transcript,
  }
}

export async function listVideos(): Promise<Video[]> {
  const records = await pb
    .collection('videos')
    .getFullList<VideoRecord>({ sort: '-created', expand: VIDEO_EXPAND })
  return records.map(recordToVideo)
}

type VideoInput = {
  url: string
  video_id: string
  title: string
  deck: Deck
  transcript: unknown
  comments?: unknown
  instructions?: string
  topic?: string | null
  tags?: string[]
  tag_source?: TagSource
}

function videoPayload(input: VideoInput) {
  return {
    ...input,
    instructions: input.instructions ?? '',
    topic: input.topic || '',
    tags: input.tags || [],
    tag_source: input.tag_source || {},
    status: 'slides_ready' as const,
  }
}

export async function createVideo(input: VideoInput): Promise<Video> {
  // The dialog checks for a duplicate before it ever gets here, so this lookup
  // only catches a stale list (another tab, another device). Falling through to
  // a re-run beats failing on the unique `video_id` index.
  const existing = await pb
    .collection('videos')
    .getFirstListItem<VideoRecord>(`video_id="${input.video_id}"`)
    .catch(() => null)
  if (existing) return rerunVideo(existing.id, input)

  const rec = await pb
    .collection('videos')
    .create<VideoRecord>({ ...videoPayload(input), read_status: 'unread' as const }, { expand: VIDEO_EXPAND })
  return recordToVideo(rec)
}

/**
 * Replace an existing video's deck with a freshly generated one.
 *
 * Everything the reader owns survives: `read_status` and `starred` are never in
 * the payload, and the caller's `tags` come from a picker seeded with what was
 * already on the record. `comments` is cleared because it described the deck
 * that just got replaced - the community section went with it.
 */
export async function rerunVideo(id: string, input: VideoInput): Promise<Video> {
  const rec = await pb
    .collection('videos')
    .update<VideoRecord>(id, { ...videoPayload(input), comments: [] }, { expand: VIDEO_EXPAND })
  return recordToVideo(rec)
}

export async function updateVideo(
  id: string,
  patch: {
    topic?: string | null
    tags?: string[]
    tag_source?: TagSource
    read_status?: Status
    starred?: boolean
    deck?: Deck
    comments?: unknown
  },
): Promise<Video> {
  const body: Record<string, unknown> = { ...patch }
  if ('topic' in patch) body.topic = patch.topic || ''
  const rec = await pb.collection('videos').update<VideoRecord>(id, body, { expand: VIDEO_EXPAND })
  return recordToVideo(rec)
}

/**
 * Fold `fromId` into `intoId` across every video that carries it, then delete
 * the source tag. Provenance follows: if either side was human-attached on a
 * given video, the merged tag stays human.
 */
export async function mergeTagInto(fromId: string, intoId: string): Promise<void> {
  if (fromId === intoId) return
  const affected = await pb
    .collection('videos')
    .getFullList<VideoRecord>({ filter: `tags ~ "${fromId}" || topic = "${fromId}"` })

  for (const rec of affected) {
    const patch: Record<string, unknown> = {}
    const ids = Array.isArray(rec.tags) ? rec.tags : []
    if (ids.includes(fromId)) {
      patch.tags = Array.from(new Set(ids.map((t) => (t === fromId ? intoId : t))))
      const src = tagSource(rec.tag_source)
      const merged: TagSource = { ...src }
      const winner = src[fromId] === 'human' || src[intoId] === 'human' ? 'human' : 'ai'
      delete merged[fromId]
      merged[intoId] = winner
      patch.tag_source = merged
    }
    if (rec.topic === fromId) patch.topic = intoId
    if (Object.keys(patch).length > 0) await pb.collection('videos').update(rec.id, patch)
  }

  await pb.collection('tags').delete(fromId)
}

/** Videos referencing each tag id, for the tag manager's counts and orphan list. */
export async function tagUsage(): Promise<Record<string, number>> {
  const records = await pb.collection('videos').getFullList<VideoRecord>({ fields: 'id,topic,tags' })
  const counts: Record<string, number> = {}
  for (const r of records) {
    if (r.topic) counts[r.topic] = (counts[r.topic] || 0) + 1
    for (const t of Array.isArray(r.tags) ? r.tags : []) counts[t] = (counts[t] || 0) + 1
  }
  return counts
}
