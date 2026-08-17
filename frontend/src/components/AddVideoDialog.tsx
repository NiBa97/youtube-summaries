import { useEffect, useRef, useState } from 'react'
import type { Tag, TagSource, Video } from '../types'
import { Icon } from './Icon'
import { Btn } from './atoms'
import { postSlides, type SlidesResponse } from '../lib/api'
import { createVideo, rerunVideo } from '../lib/pb'
import { AUTO_APPLY_THRESHOLD, buildVocabulary, ensureTags, normalizeTag, suggestedValue } from '../lib/tags'
import { TagPicker, type PickerValue } from './TagPicker'

type Props = {
  open: boolean
  onClose: () => void
  onAdd: (video: Video) => void
  onOpenExisting: (id: string) => void
  tags: Tag[]
  videos: Video[]
  onVocabularyChange: () => void
}

function normalizeYouTubeSource(input: string, id: string): string {
  const trimmed = input.trim()
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return "https://www.youtube.com/watch?v=" + id
  return trimmed
}

function parseYouTubeId(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed
  try {
    const url = new URL(trimmed)
    if (url.hostname === 'youtu.be') return url.pathname.slice(1).split('/')[0] || null
    if (url.hostname.endsWith('youtube.com')) {
      const v = url.searchParams.get('v')
      if (v) return v
      const m = url.pathname.match(/\/(embed|shorts|v)\/([a-zA-Z0-9_-]{11})/)
      if (m) return m[2]
    }
  } catch {
    return null
  }
  return null
}

export function AddVideoDialog({ open, onClose, onAdd, onOpenExisting, tags, videos, onVocabularyChange }: Props) {
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [instructions, setInstructions] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<SlidesResponse | null>(null)
  const [picked, setPicked] = useState<PickerValue>({ topicId: null, tagNames: [] })
  /** Norms the classifier proposed and pre-selected, so provenance can be
   *  recorded honestly: anything else on the final list was your call. */
  const [aiNorms, setAiNorms] = useState<Set<string>>(new Set())
  /** The library video this run replaces. Set only by an explicit click on
   *  "Re-summarise", never inferred - a paste that happens to be a duplicate
   *  must not silently overwrite a deck you already read and tagged. */
  const [rerunOf, setRerunOf] = useState<Video | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const instructionsRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    if (open) {
      setUrl('')
      setTitle('')
      setInstructions('')
      setError(null)
      setNotice(null)
      setBusy(false)
      setResult(null)
      setPicked({ topicId: null, tagNames: [] })
      setAiNorms(new Set())
      setRerunOf(null)
      setTimeout(() => inputRef.current?.focus(), 30)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const sourceUrl = () => {
    const id = parseYouTubeId(url)
    return id ? normalizeYouTubeSource(url, id) : null
  }

  // Matched in memory against the list the app already holds: no round trip, so
  // the warning lands while you are still looking at the box you pasted into.
  const parsedId = parseYouTubeId(url)
  const duplicate = parsedId ? videos.find((v) => v.youtubeId === parsedId) || null : null
  // The choice is pending until you make it. No fetch, no write.
  const awaitingChoice = !!duplicate && !rerunOf

  const startRerun = (video: Video) => {
    setRerunOf(video)
    // Start from what the deck was generated with, so refining an instruction is
    // an edit rather than a re-type - and keep the title you gave it.
    setInstructions(video.instructions || '')
    setTitle(video.title)
    setTimeout(() => instructionsRef.current?.focus(), 30)
  }

  // Phase 1: fetch transcript, build the deck, classify against the vocabulary.
  // Nothing is written yet - the suggestions are a proposal, not a decision.
  const fetchDeck = async () => {
    if (busy) return
    const id = parseYouTubeId(url)
    if (!id) {
      setError('Could not parse a YouTube video ID from that URL.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const userTitle = title.trim()
      const resp = await postSlides(normalizeYouTubeSource(url, id), {
        title: userTitle || undefined,
        instructions: instructions.trim() || undefined,
        previous_deck: rerunOf?.deck || undefined,
        vocabulary: buildVocabulary(tags, videos),
      })
      const initial = suggestedValue(resp.classification, tags)
      // On a re-run the filing you already did is the starting point; the
      // classifier's suggestions are added to it, never a replacement for it.
      const seeded: PickerValue = rerunOf
        ? {
            topicId: rerunOf.topicId || initial.topicId,
            tagNames: [...new Set([...rerunOf.tags, ...initial.tagNames])],
          }
        : initial
      setResult(resp)
      setPicked(seeded)
      setAiNorms(new Set(initial.tagNames.map(normalizeTag)))
      if (resp.language_fallback) {
        // Surfaced on the review screen, before anything is written, so the
        // caveat can still change your mind about keeping the video.
        setNotice(
          `This video has no English subtitles, so the ${resp.language} track was used ` +
            `and the summary was translated — expect it to be less precise than usual.`,
        )
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate slides')
    } finally {
      setBusy(false)
    }
  }

  // Phase 2: resolve the picked names to tag records (creating only what you
  // explicitly kept) and write the video.
  const save = async () => {
    if (busy || !result) return
    const src = sourceUrl()
    if (!src) return
    setBusy(true)
    setError(null)
    try {
      const resolved = await ensureTags(picked.tagNames, tags)
      // A tag that was already on the record keeps the provenance it had: a
      // re-run must not relabel your hand-filing as the model's work.
      const prior = rerunOf?.tagSource || {}
      const tagSource: TagSource = {}
      for (const t of resolved) tagSource[t.id] = prior[t.id] || (aiNorms.has(t.norm) ? 'ai' : 'human')
      const suggestedTopic = suggestedValue(result.classification, tags).topicId
      if (picked.topicId) {
        tagSource[picked.topicId] =
          prior[picked.topicId] || (picked.topicId === suggestedTopic ? 'ai' : 'human')
      }

      const input = {
        url: src,
        video_id: result.video_id,
        title: title.trim() || result.deck?.title || `YouTube ${result.video_id}`,
        deck: result.deck,
        transcript: result.transcript,
        instructions: instructions.trim(),
        topic: picked.topicId,
        tags: resolved.map((t) => t.id),
        tag_source: tagSource,
      }
      const video = rerunOf ? await rerunVideo(rerunOf.id, input) : await createVideo(input)
      onVocabularyChange()
      onAdd(video)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save video')
    } finally {
      setBusy(false)
    }
  }

  const submit = () => {
    if (awaitingChoice) return
    return result ? save() : fetchDeck()
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(20,15,8,.45)',
        backdropFilter: 'blur(2px)',
        display: 'grid',
        placeItems: 'center',
        zIndex: 100,
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: result ? 560 : 480,
          background: 'var(--surface)',
          color: 'var(--ink)',
          borderRadius: 12,
          boxShadow: '0 24px 64px rgba(0,0,0,.25), 0 1px 0 rgba(0,0,0,.05)',
          border: '1px solid var(--rule)',
          overflow: 'hidden',
          fontFamily: 'var(--sans)',
        }}
      >
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--rule)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              background: 'var(--surface-2)',
              display: 'grid',
              placeItems: 'center',
              color: 'var(--accent)',
            }}
          >
            <Icon name="plus" size={14} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 16, fontWeight: 500 }}>
              {result ? 'File it' : rerunOf ? 'Re-summarise' : 'Add video'}
            </div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--muted)', letterSpacing: '.06em' }}>
              {result ? 'STEP 2 · TOPIC & TAGS' : rerunOf ? 'STEP 1 · SECOND PASS' : 'STEP 1 · ONE-SHOT IMPORT'}
            </div>
          </div>
          <button
            onClick={onClose}
            title="Close"
            style={{
              appearance: 'none',
              border: 0,
              background: 'transparent',
              cursor: 'pointer',
              color: 'var(--muted)',
              padding: 4,
              borderRadius: 4,
            }}
          >
            <Icon name="close" size={14} />
          </button>
        </div>

        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {!result && (
            <>
              <Field label="YOUTUBE URL OR ID">
                <input
                  ref={inputRef}
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value)
                    setError(null)
                    // Editing the URL away from the video you chose to re-run
                    // cancels the re-run rather than retargeting it, and drops
                    // the fields it prefilled - they described the old video.
                    if (rerunOf && parseYouTubeId(e.target.value) !== rerunOf.youtubeId) {
                      setRerunOf(null)
                      setTitle('')
                      setInstructions('')
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') submit()
                  }}
                  placeholder="https://www.youtube.com/watch?v=..."
                  style={inputStyle}
                />
              </Field>

              {duplicate && (
                <div
                  style={{
                    border: '1px solid var(--rule-strong)',
                    borderRadius: 8,
                    padding: '10px 12px',
                    background: 'var(--surface-2)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)', letterSpacing: '.1em' }}>
                    ALREADY IN YOUR LIBRARY
                  </div>
                  <div style={{ fontFamily: 'var(--serif)', fontSize: 13.5, lineHeight: 1.35 }}>
                    {duplicate.title}
                  </div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--muted)' }}>
                    Added {new Date(duplicate.addedAt).toLocaleDateString()} · {duplicate.status}
                    {duplicate.instructions ? ' · has custom instruction' : ''}
                  </div>
                  {awaitingChoice ? (
                    <div style={{ display: 'flex', gap: 8, paddingTop: 2 }}>
                      <Btn onClick={() => onOpenExisting(duplicate.id)} kind="outline" size="sm" icon="check">
                        Open it
                      </Btn>
                      <Btn onClick={() => startRerun(duplicate)} kind="ghost" size="sm" icon="plus">
                        Re-summarise
                      </Btn>
                    </div>
                  ) : (
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--muted)', lineHeight: 1.5 }}>
                      Its deck will be replaced. Read state, star and tags are kept.
                    </div>
                  )}
                </div>
              )}

              <Field label="TITLE (OPTIONAL)">
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') submit()
                  }}
                  placeholder="Leave blank to fill in later"
                  style={inputStyle}
                />
              </Field>
              <Field label={rerunOf ? 'WHAT THE FIRST PASS MISSED' : 'CUSTOM INSTRUCTION (OPTIONAL)'}>
                <textarea
                  ref={instructionsRef}
                  value={instructions}
                  maxLength={1000}
                  rows={3}
                  onChange={(e) => setInstructions(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit()
                  }}
                  placeholder="e.g. Name every Magic: The Gathering card mentioned"
                  style={{ ...inputStyle, resize: 'vertical', minHeight: 62, lineHeight: 1.45 }}
                />
                <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)', letterSpacing: '.04em' }}>
                  {rerunOf
                    ? `The old deck is sent along with this, so the model knows what it already tried. ${instructions.length}/1000`
                    : `Steers what the summary covers. ${instructions.length}/1000`}
                </span>
              </Field>
            </>
          )}

          {result && (
            <>
              <div>
                <div style={{ fontFamily: 'var(--serif)', fontSize: 15, lineHeight: 1.3, marginBottom: 4 }}>
                  {title.trim() || result.deck?.title}
                </div>
                <div style={{ fontFamily: 'var(--serif)', fontSize: 12.5, lineHeight: 1.45, color: 'var(--muted)' }}>
                  {result.deck?.tldr}
                </div>
              </div>
              {notice && (
                <div
                  style={{
                    fontFamily: 'var(--mono)',
                    fontSize: 11,
                    color: 'var(--ink)',
                    background: 'var(--surface-2)',
                    border: '1px solid var(--rule)',
                    padding: '8px 10px',
                    borderRadius: 6,
                    lineHeight: 1.5,
                  }}
                >
                  {notice}
                </div>
              )}
              <div style={{ height: 1, background: 'var(--rule)' }} />
              <TagPicker
                tags={tags}
                value={picked}
                onChange={setPicked}
                classification={result.classification}
                compact
              />
            </>
          )}

          {error && (
            <div
              style={{
                fontFamily: 'var(--mono)',
                fontSize: 11,
                color: 'var(--accent)',
                background: 'rgba(168,90,42,.08)',
                padding: '8px 10px',
                borderRadius: 6,
              }}
            >
              {error}
            </div>
          )}

          <div style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--muted)', letterSpacing: '.04em', lineHeight: 1.5 }}>
            {busy
              ? result
                ? 'Saving…'
                : 'Fetching transcript, generating slides and classifying… can take 10–30s.'
              : result
                ? `Existing tags above ${Math.round(AUTO_APPLY_THRESHOLD * 100)}% are pre-selected. Dashed chips are new tags — they are only created if you keep them.`
                : awaitingChoice
                  ? 'This video is already summarised. Open it, or re-summarise it with a new instruction.'
                  : rerunOf
                    ? 'Runs the whole pipeline again with the old deck as context, then overwrites its summary.'
                    : 'Submits URL to backend → transcript + Gemini slide deck → saved to Pocketbase.'}
          </div>
        </div>

        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--rule)',
            display: 'flex',
            gap: 8,
            justifyContent: 'flex-end',
            background: 'var(--bg)',
          }}
        >
          <Btn onClick={onClose} kind="ghost">
            Cancel
          </Btn>
          {/* Nothing to submit while the duplicate choice is open: the primary
              action would otherwise be "silently overwrite what you already read". */}
          {!awaitingChoice && (
            <Btn onClick={submit} kind="accent" icon={result ? 'check' : 'plus'}>
              {busy
                ? result
                  ? 'Saving…'
                  : 'Generating…'
                : result
                  ? rerunOf
                    ? 'Replace summary'
                    : 'Save to library'
                  : rerunOf
                    ? 'Re-summarise'
                    : 'Fetch & classify'}
            </Btn>
          )}
        </div>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 11px',
  background: 'var(--bg)',
  border: '1px solid var(--rule-strong)',
  borderRadius: 7,
  outline: 'none',
  font: 'inherit',
  fontFamily: 'var(--sans)',
  fontSize: 13,
  color: 'var(--ink)',
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span
        style={{
          fontFamily: 'var(--mono)',
          fontSize: 10,
          color: 'var(--muted)',
          letterSpacing: '.1em',
        }}
      >
        {label}
      </span>
      {children}
    </label>
  )
}
