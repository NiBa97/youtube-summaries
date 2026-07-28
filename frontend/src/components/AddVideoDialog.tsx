import { useEffect, useRef, useState } from 'react'
import type { Video } from '../types'
import { Icon } from './Icon'
import { Btn } from './atoms'
import { postSlides } from '../lib/api'
import { createVideo } from '../lib/pb'

type Props = {
  open: boolean
  onClose: () => void
  onAdd: (video: Video) => void
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

export function AddVideoDialog({ open, onClose, onAdd }: Props) {
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [instructions, setInstructions] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (open) {
      setUrl('')
      setTitle('')
      setInstructions('')
      setError(null)
      setNotice(null)
      setBusy(false)
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

  const submit = async () => {
    if (busy || notice) return
    const id = parseYouTubeId(url)
    if (!id) {
      setError('Could not parse a YouTube video ID from that URL.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const sourceUrl = normalizeYouTubeSource(url, id)
      const userTitle = title.trim()
      const userInstructions = instructions.trim()
      const resp = await postSlides(sourceUrl, {
        title: userTitle || undefined,
        instructions: userInstructions || undefined,
      })
      const finalTitle = userTitle || resp.deck?.title || `YouTube ${id}`
      const video = await createVideo({
        url: sourceUrl,
        video_id: resp.video_id,
        title: finalTitle,
        deck: resp.deck,
        transcript: resp.transcript,
        instructions: userInstructions,
      })
      onAdd(video)
      if (resp.language_fallback) {
        // Video is saved; keep the dialog up so the language caveat is seen.
        setNotice(
          `Added. This video has no English subtitles, so the ${resp.language} track was used ` +
            `and the summary was translated — expect it to be less precise than usual.`,
        )
      } else {
        onClose()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate slides')
    } finally {
      setBusy(false)
    }
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
          maxWidth: 480,
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
            <div style={{ fontFamily: 'var(--serif)', fontSize: 16, fontWeight: 500 }}>Add video</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--muted)', letterSpacing: '.06em' }}>
              ONE-SHOT IMPORT
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
          <Field label="YOUTUBE URL OR ID">
            <input
              ref={inputRef}
              value={url}
              onChange={(e) => {
                setUrl(e.target.value)
                setError(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit()
              }}
              placeholder="https://www.youtube.com/watch?v=..."
              style={inputStyle}
            />
          </Field>
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
          <Field label="CUSTOM INSTRUCTION (OPTIONAL)">
            <textarea
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
              Steers what the summary covers. {instructions.length}/1000
            </span>
          </Field>

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
              ? 'Fetching transcript and generating slides… can take 10–30s.'
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
          {notice ? (
            <Btn onClick={onClose} kind="accent">
              Done
            </Btn>
          ) : (
            <>
              <Btn onClick={onClose} kind="ghost">
                Cancel
              </Btn>
              <Btn onClick={submit} kind="accent" icon="plus">
                {busy ? 'Generating…' : 'Add video'}
              </Btn>
            </>
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
