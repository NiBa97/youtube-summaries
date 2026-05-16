import type { ReactElement } from 'react'
import type { Channel, RenderedSlide, SlideAspect, SlidePalette, Slide as SlideType, Video } from '../types'

const PALETTES: Record<SlidePalette, {
  bg: string
  surface: string
  ink: string
  muted: string
  accent: string
  rule: string
}> = {
  paper: {
    bg: '#f4ede0',
    surface: '#faf6ec',
    ink: '#2a2419',
    muted: '#7a6f5e',
    accent: '#a85a2a',
    rule: 'rgba(42,36,25,.14)',
  },
  dark: {
    bg: '#15171a',
    surface: '#1c1f23',
    ink: '#e8e6e1',
    muted: '#8a8680',
    accent: '#d97757',
    rule: 'rgba(232,230,225,.12)',
  },
  sepia: {
    bg: '#e8dcc4',
    surface: '#efe5d0',
    ink: '#3a2e1e',
    muted: '#7d6a4e',
    accent: '#8c4a1e',
    rule: 'rgba(58,46,30,.16)',
  },
}

export const ASPECTS: Record<SlideAspect, { w: number; h: number }> = {
  '16:9': { w: 1280, h: 720 },
  '4:3': { w: 1024, h: 768 },
  '1:1': { w: 800, h: 800 },
}

export const ASPECT = ASPECTS['16:9']

const FONT_SERIF = 'var(--serif)'
const FONT_MONO = 'var(--mono)'

export function buildSlides(video: Video | null | undefined): SlideType[] {
  if (!video) return []
  const s = video.summary || {}
  const slides: SlideType[] = []
  slides.push({ kind: 'title', video })
  if (s.keypoints?.length) slides.push({ kind: 'keypoints', items: s.keypoints, video })
  if (s.stat) slides.push({ kind: 'stat', stat: s.stat, video })
  if (s.quote) slides.push({ kind: 'quote', quote: s.quote, video })
  if (s.timeline?.length && s.timeline.length >= 3) slides.push({ kind: 'timeline', items: s.timeline, video })
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
  palette?: SlidePalette
  aspect?: SlideAspect
}

export function Slide({ slide, channel, scale = 1, palette = 'paper', aspect = '16:9' }: Props) {
  const dim = ASPECTS[aspect]
  const p = PALETTES[palette]

  const baseStyle = {
    width: dim.w,
    height: dim.h,
    background: p.surface,
    color: p.ink,
    fontFamily: FONT_SERIF,
    transform: `scale(${scale})`,
    transformOrigin: 'top left' as const,
    position: 'relative' as const,
    overflow: 'hidden' as const,
  }

  const truncated =
    slide.video.title.length > 56 ? slide.video.title.slice(0, 53) + '…' : slide.video.title

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
        fontFamily: FONT_MONO,
        fontSize: 13,
        color: p.muted,
        letterSpacing: '.04em',
        textTransform: 'uppercase' as const,
      }}
    >
      <span>{channel ? channel.name.toUpperCase() : 'ONE-SHOT'}</span>
      <span>{truncated}</span>
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
        fontFamily: FONT_MONO,
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
            fontFamily: FONT_MONO,
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
            fontFamily: FONT_MONO,
            fontSize: 12,
            color: p.accent,
            letterSpacing: '.14em',
            marginBottom: 28,
          }}
        >
          KEY POINTS
        </div>
        <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 28, maxWidth: 960 }}>
          {slide.items.slice(0, 5).map((it, i) => (
            <li key={i} style={{ display: 'grid', gridTemplateColumns: '60px 1fr', gap: 24, alignItems: 'baseline' }}>
              <span
                style={{
                  fontFamily: FONT_MONO,
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
            fontFamily: FONT_MONO,
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
            fontFamily: FONT_MONO,
            fontSize: 14,
            color: p.muted,
            letterSpacing: '.06em',
            textTransform: 'uppercase' as const,
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
            fontFamily: FONT_MONO,
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
          {slide.items.slice(0, 6).map((it, i) => (
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
                    fontFamily: FONT_MONO,
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
              fontFamily: FONT_MONO,
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
            fontFamily: FONT_MONO,
            fontSize: 13,
            color: p.muted,
          }}
        >
          <div>
            <div style={{ color: p.accent, marginBottom: 6, letterSpacing: '.1em' }}>CHANNEL</div>
            <div style={{ fontSize: 16, color: p.ink, fontFamily: FONT_SERIF }}>{channel ? channel.name : 'One-shot import'}</div>
          </div>
          <div>
            <div style={{ color: p.accent, marginBottom: 6, letterSpacing: '.1em' }}>RUNTIME</div>
            <div style={{ fontSize: 16, color: p.ink, fontFamily: FONT_SERIF }}>{fmtDur(slide.video.duration)}</div>
          </div>
          <div>
            <div style={{ color: p.accent, marginBottom: 6, letterSpacing: '.1em' }}>TAGS</div>
            <div style={{ fontSize: 16, color: p.ink, fontFamily: FONT_SERIF }}>{(slide.video.tags || []).join(' · ') || '—'}</div>
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
