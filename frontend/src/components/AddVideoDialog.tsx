import { useEffect, useRef, useState } from 'react'
import type { Video } from '../types'
import { Icon } from './Icon'
import { Btn } from './atoms'

type Props = {
  open: boolean
  onClose: () => void
  onAdd: (video: Video) => void
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
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (open) {
      setUrl('')
      setTitle('')
      setError(null)
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

  const submit = () => {
    const id = parseYouTubeId(url)
    if (!id) {
      setError('Could not parse a YouTube video ID from that URL.')
      return
    }
    const finalTitle = title.trim() || 'Untitled video'
    const now = new Date().toISOString()
    const video: Video = {
      id: `u-${Date.now()}`,
      channelId: null,
      oneshot: true,
      addedBy: 'user',
      title: finalTitle,
      duration: 0,
      publishedAt: now,
      addedAt: now,
      youtubeId: id,
      sourceUrl: url.trim(),
      status: 'unread',
      starred: false,
      tags: [],
      readingTime: 0,
      summary: {},
    }
    onAdd(video)
    onClose()
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
            Frontend-only stub. Backend summary generation lands later — for now the new entry shows up in the list and the player loads the YouTube embed.
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
          <Btn onClick={submit} kind="accent" icon="plus">
            Add video
          </Btn>
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
