import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Channel, Video } from '../types'
import { ASPECT, Slide, buildSlides } from './Slide'
import { Btn } from './atoms'

type Props = {
  video: Video | null
  channel: Channel | null
}

export function DeckPanel({ video, channel }: Props) {
  const slides = useMemo(() => buildSlides(video), [video])
  const [idx, setIdx] = useState(0)
  useEffect(() => {
    setIdx(0)
  }, [video?.id])

  const slideRef = useRef<HTMLDivElement | null>(null)
  const [scale, setScale] = useState(0.4)

  useLayoutEffect(() => {
    if (!slideRef.current) return
    const update = () => {
      const r = slideRef.current!.getBoundingClientRect()
      const sx = (r.width - 48) / ASPECT.w
      const sy = (r.height - 24) / ASPECT.h
      setScale(Math.max(0.1, Math.min(sx, sy, 1)))
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(slideRef.current)
    return () => ro.disconnect()
  }, [])

  if (!video || slides.length === 0) {
    return (
      <div
        style={{
          height: '100%',
          display: 'grid',
          placeItems: 'center',
          color: 'var(--muted)',
          fontFamily: 'var(--serif)',
          fontSize: 16,
          background: 'var(--bg)',
          textAlign: 'center',
          padding: 40,
        }}
      >
        <div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.1em', marginBottom: 12 }}>
            NO VIDEO SELECTED
          </div>
          <div style={{ maxWidth: 320 }}>Pick a video from the list to preview its summary deck.</div>
        </div>
      </div>
    )
  }

  const slide = { ...slides[idx], _idx: idx, _total: slides.length }

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg)',
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      <div style={{ padding: '14px 22px', borderBottom: '1px solid var(--rule)' }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--muted)', letterSpacing: '.1em' }}>SUMMARY DECK</div>
      </div>
      <div
        ref={slideRef}
        style={{
          flex: 1,
          padding: '12px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          minHeight: 0,
        }}
      >
        <div
          style={{
            width: ASPECT.w * scale,
            height: ASPECT.h * scale,
            boxShadow: '0 8px 32px rgba(0,0,0,.10), 0 1px 0 rgba(0,0,0,.04)',
            borderRadius: 6,
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <Slide slide={slide} channel={channel} scale={scale} />
        </div>
      </div>
      <div
        style={{
          padding: '12px 22px',
          borderTop: '1px solid var(--rule)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <Btn icon="arrowLeft" onClick={() => setIdx((i) => Math.max(0, i - 1))} title="Previous slide" />
        <div style={{ display: 'flex', gap: 4, flex: 1, justifyContent: 'center' }}>
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              style={{
                appearance: 'none',
                border: 0,
                padding: 0,
                width: i === idx ? 18 : 6,
                height: 6,
                borderRadius: 3,
                background: i === idx ? 'var(--accent)' : 'var(--rule-strong)',
                cursor: 'pointer',
                transition: 'width .2s, background .2s',
              }}
            />
          ))}
        </div>
        <span
          style={{
            fontFamily: 'var(--mono)',
            fontSize: 11,
            color: 'var(--muted)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {idx + 1} / {slides.length}
        </span>
        <Btn icon="arrowRight" onClick={() => setIdx((i) => Math.min(slides.length - 1, i + 1))} title="Next slide" />
      </div>
    </div>
  )
}
