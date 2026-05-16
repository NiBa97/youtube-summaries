import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Channel, SlideAspect, SlidePalette, Video } from '../types'
import { ASPECTS, Slide, buildSlides } from './Slide'
import { Btn } from './atoms'

type Props = {
  video: Video | null
  channel: Channel | null
}

const PALETTE_OPTIONS: { id: SlidePalette; label: string }[] = [
  { id: 'paper', label: 'PAPER' },
  { id: 'dark', label: 'DARK' },
  { id: 'sepia', label: 'SEPIA' },
]

const ASPECT_OPTIONS: { id: SlideAspect; label: string }[] = [
  { id: '16:9', label: '16:9' },
  { id: '4:3', label: '4:3' },
  { id: '1:1', label: '1:1' },
]

export function DeckPanel({ video, channel }: Props) {
  const slides = useMemo(() => buildSlides(video), [video])
  const [idx, setIdx] = useState(0)
  const [palette, setPalette] = useState<SlidePalette>('paper')
  const [aspect, setAspect] = useState<SlideAspect>('16:9')
  useEffect(() => {
    setIdx(0)
  }, [video?.id])

  const dim = ASPECTS[aspect]
  const slideRef = useRef<HTMLDivElement | null>(null)
  const [scale, setScale] = useState(0.4)

  useLayoutEffect(() => {
    if (!slideRef.current) return
    const update = () => {
      const r = slideRef.current!.getBoundingClientRect()
      const sx = (r.width - 48) / dim.w
      const sy = (r.height - 24) / dim.h
      setScale(Math.max(0.1, Math.min(sx, sy, 1)))
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(slideRef.current)
    return () => ro.disconnect()
  }, [dim.w, dim.h])

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
      <div
        style={{
          padding: '10px 22px',
          borderBottom: '1px solid var(--rule)',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <div style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--muted)', letterSpacing: '.1em' }}>SUMMARY DECK</div>
        <div style={{ flex: 1 }} />
        <ChipGroup
          ariaLabel="Aspect"
          options={ASPECT_OPTIONS}
          value={aspect}
          onChange={(v) => setAspect(v as SlideAspect)}
        />
        <ChipGroup
          ariaLabel="Theme"
          options={PALETTE_OPTIONS}
          value={palette}
          onChange={(v) => setPalette(v as SlidePalette)}
        />
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
            width: dim.w * scale,
            height: dim.h * scale,
            boxShadow: '0 8px 32px rgba(0,0,0,.10), 0 1px 0 rgba(0,0,0,.04)',
            borderRadius: 6,
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <Slide slide={slide} channel={channel} scale={scale} palette={palette} aspect={aspect} />
        </div>
      </div>

      <Filmstrip slides={slides} idx={idx} setIdx={setIdx} palette={palette} aspect={aspect} channel={channel} />

      <div
        style={{
          padding: '10px 22px',
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

function ChipGroup<T extends string>({
  ariaLabel,
  options,
  value,
  onChange,
}: {
  ariaLabel: string
  options: { id: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div role="group" aria-label={ariaLabel} style={{ display: 'inline-flex', border: '1px solid var(--rule-strong)', borderRadius: 6, overflow: 'hidden' }}>
      {options.map((o) => {
        const active = o.id === value
        return (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            style={{
              appearance: 'none',
              border: 0,
              padding: '4px 9px',
              cursor: 'pointer',
              background: active ? 'var(--ink)' : 'transparent',
              color: active ? 'var(--bg)' : 'var(--muted)',
              fontFamily: 'var(--mono)',
              fontSize: 10.5,
              letterSpacing: '.06em',
              transition: 'background .12s, color .12s',
            }}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

function Filmstrip({
  slides,
  idx,
  setIdx,
  palette,
  aspect,
  channel,
}: {
  slides: ReturnType<typeof buildSlides>
  idx: number
  setIdx: (i: number) => void
  palette: SlidePalette
  aspect: SlideAspect
  channel: Channel | null
}) {
  const dim = ASPECTS[aspect]
  const THUMB_W = 88
  const thumbScale = THUMB_W / dim.w
  const thumbH = dim.h * thumbScale
  return (
    <div
      style={{
        padding: '8px 22px',
        borderTop: '1px solid var(--rule)',
        display: 'flex',
        gap: 6,
        overflowX: 'auto',
      }}
    >
      {slides.map((s, i) => (
        <button
          key={i}
          onClick={() => setIdx(i)}
          title={s.kind}
          style={{
            appearance: 'none',
            border: i === idx ? '2px solid var(--accent)' : '1px solid var(--rule-strong)',
            padding: 0,
            borderRadius: 5,
            overflow: 'hidden',
            cursor: 'pointer',
            background: 'var(--bg)',
            flexShrink: 0,
            width: THUMB_W,
            height: thumbH,
            position: 'relative',
          }}
        >
          <div style={{ width: dim.w, height: dim.h, transformOrigin: 'top left' }}>
            <Slide
              slide={{ ...s, _idx: i, _total: slides.length }}
              palette={palette}
              aspect={aspect}
              channel={channel}
              scale={thumbScale}
            />
          </div>
        </button>
      ))}
    </div>
  )
}
