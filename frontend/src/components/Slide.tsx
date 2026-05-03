import type { ReactElement } from 'react'
import type { Channel, RenderedSlide, Slide as SlideType, Video } from '../types'

const PALETTE = {
  bg: '#f4ede0',
  surface: '#faf6ec',
  ink: '#2a2419',
  muted: '#7a6f5e',
  accent: '#a85a2a',
  rule: 'rgba(42,36,25,.14)',
}

export const ASPECT = { w: 1280, h: 720 }

export function buildSlides(video: Video | null | undefined): SlideType[] {
  if (!video) return []
  const s = video.summary || {}
  const slides: SlideType[] = []
  slides.push({ kind: 'title', video })
  if (s.keypoints?.length) slides.push({ kind: 'keypoints', items: s.keypoints, video })
  if (s.stat) slides.push({ kind: 'stat', stat: s.stat, video })
  if (s.quote) slides.push({ kind: 'quote', quote: s.quote, video })
  if (s.timeline?.length) slides.push({ kind: 'timeline', items: s.timeline, video })
  slides.push({ kind: 'closer', video })
  return slides
}

function fmtDur(seconds: number) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

type Props = {
  slide: RenderedSlide
  channel: Channel | null
  scale?: number
}

export function Slide({ slide, channel, scale = 1 }: Props) {
  const dim = ASPECT
  const p = PALETTE

  const baseStyle = {
    width: dim.w,
    height: dim.h,
    background: p.surface,
    color: p.ink,
    fontFamily: '"Source Serif 4", "Source Serif Pro", Georgia, serif',
    transform: `scale(${scale})`,
    transformOrigin: 'top left' as const,
    position: 'relative' as const,
    overflow: 'hidden' as const,
  }

  const Header = () => (
    <div
      style={{
        position: 'absolute',
        top: 32,
        left: 40,
        right: 40,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        fontFamily: '"JetBrains Mono", ui-monospace, monospace',
        fontSize: 13,
        color: p.muted,
        letterSpacing: '.04em',
      }}
    >
      <span>{channel ? channel.name.toUpperCase() : 'ONE-SHOT'}</span>
      <span>{slide.video.title.length > 56 ? slide.video.title.slice(0, 53) + '…' : slide.video.title}</span>
    </div>
  )

  const Footer = ({ idx, total }: { idx: number; total: number }) => (
    <div
      style={{
        position: 'absolute',
        bottom: 28,
        left: 40,
        right: 40,
        display: 'flex',
        justifyContent: 'space-between',
        fontFamily: '"JetBrains Mono", ui-monospace, monospace',
        fontSize: 12,
        color: p.muted,
        letterSpacing: '.04em',
      }}
    >
      <span>{slide.video.tldr ? '— SUMMARY' : ''}</span>
      <span>
        {idx + 1} / {total}
      </span>
    </div>
  )

  let body: ReactElement | null = null
  if (slide.kind === 'title') {
    body = (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          padding: '120px 80px 100px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <div
          style={{
            fontFamily: '"JetBrains Mono", ui-monospace, monospace',
            fontSize: 13,
            color: p.accent,
            letterSpacing: '.12em',
          }}
        >
          VIDEO SUMMARY
        </div>
        <div>
          <div style={{ fontSize: 64, lineHeight: 1.05, fontWeight: 500, letterSpacing: '-.02em', textWrap: 'balance' }}>
            {slide.video.title}
          </div>
          {slide.video.tldr && (
            <div
              style={{
                marginTop: 36,
                fontSize: 22,
                lineHeight: 1.45,
                color: p.muted,
                maxWidth: 880,
                textWrap: 'pretty',
                fontStyle: 'italic',
              }}
            >
              {slide.video.tldr}
            </div>
          )}
        </div>
      </div>
    )
  } else if (slide.kind === 'keypoints') {
    body = (
      <div style={{ position: 'absolute', inset: 0, padding: '110px 80px 90px' }}>
        <div
          style={{
            fontFamily: '"JetBrains Mono", ui-monospace, monospace',
            fontSize: 12,
            color: p.accent,
            letterSpacing: '.14em',
            marginBottom: 28,
          }}
        >
          KEY POINTS
        </div>
        <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 28 }}>
          {slide.items.map((it, i) => (
            <li key={i} style={{ display: 'grid', gridTemplateColumns: '60px 1fr', gap: 24, alignItems: 'baseline' }}>
              <span
                style={{
                  fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                  fontSize: 14,
                  color: p.muted,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {String(i + 1).padStart(2, '0')}
              </span>
              <span style={{ fontSize: 26, lineHeight: 1.4, textWrap: 'pretty' }}>{it}</span>
            </li>
          ))}
        </ol>
      </div>
    )
  } else if (slide.kind === 'stat') {
    body = (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          padding: '120px 80px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'flex-start',
        }}
      >
        <div
          style={{
            fontFamily: '"JetBrains Mono", ui-monospace, monospace',
            fontSize: 12,
            color: p.accent,
            letterSpacing: '.14em',
            marginBottom: 24,
          }}
        >
          BY THE NUMBERS
        </div>
        <div style={{ fontSize: 220, lineHeight: 1, fontWeight: 500, letterSpacing: '-.04em', color: p.ink }}>
          {slide.stat.value}
        </div>
        <div style={{ marginTop: 32, fontSize: 28, color: p.muted, maxWidth: 740, lineHeight: 1.35 }}>{slide.stat.caption}</div>
      </div>
    )
  } else if (slide.kind === 'quote') {
    body = (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          padding: '120px 100px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        <div style={{ fontSize: 140, lineHeight: 0.6, color: p.accent, fontFamily: 'Georgia, serif', marginBottom: 8 }}>
          “
        </div>
        <div style={{ fontSize: 44, lineHeight: 1.3, fontStyle: 'italic', letterSpacing: '-.01em', textWrap: 'balance', maxWidth: 980 }}>
          {slide.quote.text}
        </div>
        <div
          style={{
            marginTop: 36,
            fontFamily: '"JetBrains Mono", ui-monospace, monospace',
            fontSize: 14,
            color: p.muted,
            letterSpacing: '.06em',
          }}
        >
          — {slide.quote.attrib}
        </div>
      </div>
    )
  } else if (slide.kind === 'timeline') {
    body = (
      <div style={{ position: 'absolute', inset: 0, padding: '110px 80px' }}>
        <div
          style={{
            fontFamily: '"JetBrains Mono", ui-monospace, monospace',
            fontSize: 12,
            color: p.accent,
            letterSpacing: '.14em',
            marginBottom: 36,
          }}
        >
          TIMELINE
        </div>
        <div style={{ position: 'relative', paddingLeft: 24 }}>
          <div style={{ position: 'absolute', left: 6, top: 8, bottom: 8, width: 1, background: p.rule }} />
          {slide.items.map((it, i) => (
            <div
              key={i}
              style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 24, marginBottom: 28, alignItems: 'baseline' }}
            >
              <div style={{ position: 'relative' }}>
                <div
                  style={{
                    position: 'absolute',
                    left: -22,
                    top: 8,
                    width: 9,
                    height: 9,
                    borderRadius: '50%',
                    background: p.accent,
                  }}
                />
                <span
                  style={{
                    fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                    fontSize: 16,
                    color: p.muted,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {it.year}
                </span>
              </div>
              <span style={{ fontSize: 22, lineHeight: 1.4 }}>{it.label}</span>
            </div>
          ))}
        </div>
      </div>
    )
  } else if (slide.kind === 'closer') {
    body = (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          padding: '120px 80px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <div
            style={{
              fontFamily: '"JetBrains Mono", ui-monospace, monospace',
              fontSize: 12,
              color: p.accent,
              letterSpacing: '.14em',
              marginBottom: 24,
            }}
          >
            WATCH THE FULL VIDEO
          </div>
          <div style={{ fontSize: 44, lineHeight: 1.2, letterSpacing: '-.015em', maxWidth: 900, textWrap: 'balance' }}>
            {slide.video.title}
          </div>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: 32,
            fontFamily: '"JetBrains Mono", ui-monospace, monospace',
            fontSize: 13,
            color: p.muted,
          }}
        >
          <div>
            <div style={{ color: p.accent, marginBottom: 6, letterSpacing: '.1em' }}>CHANNEL</div>
            <div style={{ fontSize: 16, color: p.ink }}>{channel ? channel.name : 'One-shot import'}</div>
          </div>
          <div>
            <div style={{ color: p.accent, marginBottom: 6, letterSpacing: '.1em' }}>RUNTIME</div>
            <div style={{ fontSize: 16, color: p.ink }}>{fmtDur(slide.video.duration)}</div>
          </div>
          <div>
            <div style={{ color: p.accent, marginBottom: 6, letterSpacing: '.1em' }}>TAGS</div>
            <div style={{ fontSize: 16, color: p.ink }}>{(slide.video.tags || []).join(' · ')}</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={baseStyle}>
      <Header />
      {body}
      <Footer idx={slide._idx} total={slide._total} />
    </div>
  )
}
