import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { getLinkPreview, type LinkPreview } from '../lib/api'
import { faviconUrl, hostLabel, parseRichText } from '../lib/richtext'

const OPEN_DELAY_MS = 280
const CLOSE_DELAY_MS = 160
const CARD_WIDTH = 330

type PreviewState =
  | { status: 'loading' }
  | { status: 'ready'; preview: LinkPreview }
  | { status: 'error' }

/** Anchor that unfurls a hover preview card fetched through the backend. */
export function SmartLink({
  url,
  children,
  style,
}: {
  url: string
  children: React.ReactNode
  style?: React.CSSProperties
}) {
  const anchorRef = useRef<HTMLAnchorElement | null>(null)
  const openTimer = useRef<number | undefined>(undefined)
  const closeTimer = useRef<number | undefined>(undefined)
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<{ top: number; left: number; above: boolean } | null>(null)
  const [state, setState] = useState<PreviewState | null>(null)

  const clearTimers = () => {
    window.clearTimeout(openTimer.current)
    window.clearTimeout(closeTimer.current)
  }

  useEffect(() => clearTimers, [])

  const show = useCallback(() => {
    const rect = anchorRef.current?.getBoundingClientRect()
    if (!rect) return
    const above = rect.bottom + 220 > window.innerHeight && rect.top > 240
    setPosition({
      top: above ? rect.top - 10 : rect.bottom + 10,
      left: Math.min(Math.max(12, rect.left), Math.max(12, window.innerWidth - CARD_WIDTH - 12)),
      above,
    })
    setOpen(true)
    setState((current) => current ?? { status: 'loading' })

    getLinkPreview(url)
      .then((preview) => setState({ status: 'ready', preview }))
      .catch(() => setState({ status: 'error' }))
  }, [url])

  const onEnter = () => {
    clearTimers()
    openTimer.current = window.setTimeout(show, OPEN_DELAY_MS)
  }

  const onLeave = () => {
    clearTimers()
    closeTimer.current = window.setTimeout(() => setOpen(false), CLOSE_DELAY_MS)
  }

  return (
    <>
      <a
        ref={anchorRef}
        href={url}
        target="_blank"
        rel="noreferrer"
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
        onFocus={show}
        onBlur={() => setOpen(false)}
        style={{ color: 'var(--accent)', textDecoration: 'none', borderBottom: '1px solid color-mix(in srgb, var(--accent) 35%, transparent)', ...style }}
      >
        {children}
      </a>
      {open && position
        ? createPortal(
            <PreviewCard
              url={url}
              state={state}
              position={position}
              onMouseEnter={clearTimers}
              onMouseLeave={onLeave}
            />,
            document.body,
          )
        : null}
    </>
  )
}

function PreviewCard({
  url,
  state,
  position,
  onMouseEnter,
  onMouseLeave,
}: {
  url: string
  state: PreviewState | null
  position: { top: number; left: number; above: boolean }
  onMouseEnter: () => void
  onMouseLeave: () => void
}) {
  const preview = state?.status === 'ready' ? state.preview : null
  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        transform: position.above ? 'translateY(-100%)' : undefined,
        width: CARD_WIDTH,
        zIndex: 200,
        background: 'var(--surface)',
        color: 'var(--ink)',
        border: '1px solid var(--rule-strong)',
        borderRadius: 10,
        boxShadow: '0 18px 44px rgba(0,0,0,.22)',
        overflow: 'hidden',
        fontFamily: 'var(--sans)',
        pointerEvents: 'auto',
      }}
    >
      {preview?.image && (
        <img
          src={preview.image}
          alt=""
          style={{ width: '100%', height: 132, objectFit: 'cover', display: 'block', borderBottom: '1px solid var(--rule)' }}
          onError={(e) => {
            e.currentTarget.style.display = 'none'
          }}
        />
      )}
      <div style={{ padding: '10px 12px', display: 'grid', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
          <img src={faviconUrl(url)} alt="" width={14} height={14} style={{ borderRadius: 3, flexShrink: 0 }} />
          <span
            style={{
              fontFamily: 'var(--mono)',
              fontSize: 10,
              letterSpacing: '.08em',
              textTransform: 'uppercase',
              color: 'var(--muted)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {preview?.site || hostLabel(url)}
          </span>
        </div>

        {state?.status === 'loading' && (
          <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>Loading preview…</div>
        )}
        {state?.status === 'error' && (
          <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>
            No preview available. Opens {hostLabel(url)} in a new tab.
          </div>
        )}
        {preview && (
          <>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 14.5, lineHeight: 1.32 }}>
              {preview.title || hostLabel(url)}
            </div>
            {preview.description && (
              <div style={{ fontSize: 12.5, lineHeight: 1.45, color: 'var(--muted)' }}>{preview.description}</div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

/** Renders deck prose, turning inline markdown links into hover-preview anchors. */
export function RichText({ text }: { text: string }) {
  const segments = parseRichText(text)
  return (
    <>
      {segments.map((segment, i) => {
        if (segment.kind === 'text') return <span key={i}>{segment.text}</span>
        if (segment.kind === 'link') {
          return (
            <SmartLink key={i} url={segment.url}>
              {segment.label}
            </SmartLink>
          )
        }
        return (
          <SmartLink
            key={i}
            url={segment.url}
            style={{ borderBottom: 0, fontSize: '.82em', verticalAlign: 'super', marginLeft: 2, textDecoration: 'none' }}
          >
            ↗
          </SmartLink>
        )
      })}
    </>
  )
}
