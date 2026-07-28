import type { RecordModel } from 'pocketbase'
import { pb } from './pb'
import type { Tag, TagKind, Video } from '../types'
import type { Classification, Vocabulary } from './api'

export type TagRecord = RecordModel & {
  name: string
  norm: string
  kind: TagKind
  color?: string
  sort?: number
}

/**
 * Collapsed identity key: lowercase, whitespace/hyphen/underscore stripped.
 * `norm` is unique in Pocketbase, so this is what stops "Machine Learning",
 * "machine-learning" and "machine_learning" becoming three tags.
 * Mirrors `normalize_tag()` in backend/app/main.py - keep both in sync.
 */
export function normalizeTag(name: string): string {
  return name.trim().toLowerCase().replace(/[\s_-]+/g, '')
}

/** Topics get a colour so they can carry a dot in the list; tags stay neutral. */
export const TOPIC_COLORS = [
  '#a85a2a', '#3f6b46', '#8a6a1f', '#2e6f8e',
  '#6a4a8a', '#9a3b2f', '#4a7a7a', '#7a5a3a',
]

export function recordToTag(r: TagRecord): Tag {
  return {
    id: r.id,
    name: r.name,
    norm: r.norm,
    kind: r.kind === 'topic' ? 'topic' : 'tag',
    color: r.color || undefined,
    sort: typeof r.sort === 'number' ? r.sort : undefined,
  }
}

export async function listTags(): Promise<Tag[]> {
  const records = await pb.collection('tags').getFullList<TagRecord>({ sort: 'sort,name' })
  return records.map(recordToTag)
}

/**
 * What gets sent to the classifier. Tags are sorted most-used first because the
 * prompt tells the model to break ties toward the earlier entry - that ordering
 * is what makes the vocabulary converge instead of sprawl.
 */
export function buildVocabulary(tags: Tag[], videos: Video[]): Vocabulary {
  const counts: Record<string, number> = {}
  for (const v of videos) for (const id of v.tagIds) counts[id] = (counts[id] || 0) + 1
  return {
    topics: tags.filter((t) => t.kind === 'topic').map((t) => t.name),
    tags: tags
      .filter((t) => t.kind === 'tag')
      .map((t) => ({ name: t.name, count: counts[t.id] || 0 }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
  }
}

export async function createTag(input: { name: string; kind: TagKind; color?: string; sort?: number }): Promise<Tag> {
  const name = input.name.trim()
  const norm = normalizeTag(name)
  if (!norm) throw new Error('Tag name cannot be empty')
  const rec = await pb.collection('tags').create<TagRecord>({
    name,
    norm,
    kind: input.kind,
    color: input.color || '',
    sort: input.sort ?? 0,
  })
  return recordToTag(rec)
}

/**
 * Resolve names to tag records, creating what does not exist yet.
 * Matching is by norm, so a name that only differs in casing or separators
 * resolves to the tag already on file instead of minting a near-duplicate.
 */
export async function ensureTags(names: string[], known: Tag[], kind: TagKind = 'tag'): Promise<Tag[]> {
  const byNorm = new Map(known.map((t) => [t.norm, t]))
  const out: Tag[] = []
  const seen = new Set<string>()
  for (const raw of names) {
    const norm = normalizeTag(raw)
    if (!norm || seen.has(norm)) continue
    seen.add(norm)
    const hit = byNorm.get(norm)
    if (hit) {
      out.push(hit)
      continue
    }
    try {
      out.push(await createTag({ name: raw.trim(), kind }))
    } catch {
      // Lost a race against another create, or the norm index rejected it.
      // Re-read rather than fail the whole save.
      try {
        const rec = await pb.collection('tags').getFirstListItem<TagRecord>(`norm="${norm}"`)
        out.push(recordToTag(rec))
      } catch {
        // give up on this one tag only
      }
    }
  }
  return out
}

export async function renameTag(id: string, name: string): Promise<Tag> {
  const trimmed = name.trim()
  const rec = await pb.collection('tags').update<TagRecord>(id, {
    name: trimmed,
    norm: normalizeTag(trimmed),
  })
  return recordToTag(rec)
}

export async function setTagKind(id: string, kind: TagKind, color?: string): Promise<Tag> {
  const patch: Record<string, unknown> = { kind }
  if (kind === 'topic') patch.color = color || TOPIC_COLORS[0]
  const rec = await pb.collection('tags').update<TagRecord>(id, patch)
  return recordToTag(rec)
}

export async function setTagColor(id: string, color: string): Promise<Tag> {
  const rec = await pb.collection('tags').update<TagRecord>(id, { color })
  return recordToTag(rec)
}

/**
 * Pocketbase strips the id from every referencing record on delete
 * (cascadeDelete is false), so videos lose the tag but survive.
 */
export async function deleteTag(id: string): Promise<void> {
  await pb.collection('tags').delete(id)
}

/**
 * Confidence above which an *existing* tag is pre-selected for you.
 *
 * The asymmetry that sets this: applying a wrong existing tag is a small,
 * reversible error - one click to remove. Creating a redundant new tag is a
 * permanent, compounding error - it splits the vocabulary and every future
 * classification inherits the mess. So tag application is relaxed and tag
 * creation is gated hard: proposed new tags are never pre-selected, at any
 * confidence.
 */
export const AUTO_APPLY_THRESHOLD = 0.75

/** What the picker starts pre-selected with, given a classification. */
export function suggestedValue(
  c: Classification | null,
  tags: Tag[],
): { topicId: string | null; tagNames: string[] } {
  if (!c) return { topicId: null, tagNames: [] }
  const topic = tags.find((t) => t.kind === 'topic' && t.norm === normalizeTag(c.topic || ''))
  return {
    topicId: topic ? topic.id : null,
    tagNames: c.tags.filter((s) => s.confidence >= AUTO_APPLY_THRESHOLD).map((s) => s.name),
  }
}
