import { useMemo, useState } from 'react'
import type { Tag, TagSource, Video } from '../types'
import { Btn, TopicDot } from './atoms'
import { TagPicker, type PickerValue } from './TagPicker'
import { postClassify, type Classification } from '../lib/api'
import { buildVocabulary, ensureTags, normalizeTag, suggestedValue } from '../lib/tags'
import { updateVideo } from '../lib/pb'

type Props = {
  video: Video
  tags: Tag[]
  videos: Video[]
  onSaved: (video: Video) => void
  onVocabularyChange: () => void
}

/**
 * Inline filing strip for an already-imported video: shows where it sits, and
 * opens the same picker the add flow uses. "Suggest" re-runs classification
 * against the current vocabulary, which is how videos imported before a topic
 * existed get filed later.
 */
export function VideoTagBar({ video, tags, videos, onSaved, onVocabularyChange }: Props) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [classification, setClassification] = useState<Classification | null>(null)
  const [picked, setPicked] = useState<PickerValue>({ topicId: null, tagNames: [] })

  const tagById = useMemo(() => new Map(tags.map((t) => [t.id, t])), [tags])
  const topic = video.topicId ? tagById.get(video.topicId) || null : null
  const current = useMemo<PickerValue>(
    () => ({
      topicId: video.topicId,
      tagNames: video.tagIds.map((id) => tagById.get(id)?.name).filter((n): n is string => !!n),
    }),
    [video.topicId, video.tagIds, tagById],
  )

  // Opening seeds the picker from what is currently filed. App remounts this
  // component per video (keyed on id), so switching videos resets it for free.
  const toggleOpen = () => {
    if (!open) setPicked(current)
    setOpen((o) => !o)
  }

  const suggest = async () => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const c = await postClassify({
        title: video.title,
        tldr: video.tldr || '',
        body: (video.deck?.blocks || []).map((b) => JSON.stringify(b)).join('\n').slice(0, 20000),
        vocabulary: buildVocabulary(tags, videos),
      })
      setClassification(c)
      const s = suggestedValue(c, tags)
      // Suggestions are added to what is already there, never a replacement -
      // a re-classification must not silently drop tags you filed by hand.
      setPicked((p) => ({
        topicId: p.topicId || s.topicId,
        tagNames: Array.from(new Set([...p.tagNames, ...s.tagNames].map((n) => n))),
      }))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Classification failed')
    } finally {
      setBusy(false)
    }
  }

  const save = async () => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const resolved = await ensureTags(picked.tagNames, tags)
      const aiNorms = new Set(
        (classification ? suggestedValue(classification, tags).tagNames : []).map(normalizeTag),
      )
      const source: TagSource = { ...video.tagSource }
      const nextIds = resolved.map((t) => t.id)
      for (const t of resolved) {
        if (source[t.id]) continue
        source[t.id] = aiNorms.has(t.norm) ? 'ai' : 'human'
      }
      for (const id of Object.keys(source)) {
        if (!nextIds.includes(id) && id !== picked.topicId) delete source[id]
      }
      if (picked.topicId && !source[picked.topicId]) source[picked.topicId] = 'human'

      const saved = await updateVideo(video.id, {
        topic: picked.topicId,
        tags: nextIds,
        tag_source: source,
      })
      onVocabularyChange()
      onSaved(saved)
      setOpen(false)
      setClassification(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ borderBottom: '1px solid var(--rule)', background: 'var(--bg)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 18px', flexWrap: 'wrap' }}>
        <TopicDot topic={topic} size={11} />
        <span
          style={{
            fontFamily: 'var(--mono)',
            fontSize: 10.5,
            letterSpacing: '.06em',
            color: topic ? 'var(--ink)' : 'var(--muted)',
            textTransform: 'uppercase',
          }}
        >
          {topic ? topic.name : 'Unfiled'}
        </span>
        <span style={{ color: 'var(--rule-strong)' }}>·</span>
        {video.tags.length === 0 ? (
          <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--muted)' }}>no tags</span>
        ) : (
          video.tags.map((t) => (
            <span
              key={t}
              style={{
                fontFamily: 'var(--mono)',
                fontSize: 10.5,
                padding: '2px 7px',
                borderRadius: 999,
                background: 'var(--surface-2)',
                color: 'var(--ink)',
              }}
            >
              {t}
            </span>
          ))
        )}
        <div style={{ flex: 1 }} />
        <Btn onClick={toggleOpen} kind="ghost" size="sm" icon="tag" active={open}>
          {open ? 'Close' : 'Edit'}
        </Btn>
      </div>

      {open && (
        <div style={{ padding: '4px 18px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <TagPicker tags={tags} value={picked} onChange={setPicked} classification={classification} compact />
          {error && (
            <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--accent)' }}>{error}</div>
          )}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Btn onClick={suggest} kind="ghost" size="sm">
              {busy ? 'Working…' : 'Suggest'}
            </Btn>
            <Btn onClick={() => setOpen(false)} kind="ghost" size="sm">
              Cancel
            </Btn>
            <Btn onClick={save} kind="accent" size="sm" icon="check">
              Save
            </Btn>
          </div>
        </div>
      )}
    </div>
  )
}
