import type { CSSProperties, ReactElement } from 'react'
import type { Channel, DeckBlock, RenderedSlide, Slide as SlideType, Video } from '../types'

const PALETTE = {
  bg: '#f4ede0',
  surface: '#faf6ec',
  ink: '#2a2419',
  muted: '#7a6f5e',
  accent: '#a85a2a',
  rule: 'rgba(42,36,25,.14)',
}

export const ASPECT = { w: 1280, h: 720 }

function legacyBlocks(video: Video): DeckBlock[] {
  const s = video.summary || {}
  const blocks: DeckBlock[] = []
  if (s.keypoints?.length) blocks.push({ type: 'list', eyebrow: 'Key points', title: 'What matters', items: s.keypoints })
  if (s.stat) blocks.push({ type: 'metric', eyebrow: 'By the numbers', value: s.stat.value, label: s.stat.caption })
  if (s.quote) blocks.push({ type: 'quote', eyebrow: 'Quote', text: s.quote.text, attribution: s.quote.attrib })
  if (s.timeline?.length) {
    blocks.push({
      type: 'timeline',
      eyebrow: 'Timeline',
      title: 'Chronology',
      items: s.timeline.map((it) => ({ marker: it.year, text: it.label })),
    })
  }
  return blocks
}

export function buildSlides(video: Video | null | undefined): SlideType[] {
  if (!video) return []
  const blocks = video.deck?.blocks?.length ? video.deck.blocks : legacyBlocks(video)
  const slides: SlideType[] = [{ kind: 'title', video }]
  slides.push(...blocks.map((block) => ({ kind: 'block' as const, block, video })))
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

  const baseStyle: CSSProperties = {
    width: dim.w,
    height: dim.h,
    background: p.surface,
    color: p.ink,
    fontFamily: '"Source Serif 4", "Source Serif Pro", Georgia, serif',
    transform: `scale(${scale})`,
    transformOrigin: 'top left',
    position: 'relative',
    overflow: 'hidden',
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
      <span>{slide.video.title.length > 56 ? slide.video.title.slice(0, 53) + '...' : slide.video.title}</span>
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
      <span>{slide.video.tldr ? '- SUMMARY' : ''}</span>
      <span>{idx + 1} / {total}</span>
    </div>
  )

  const BlockFrame = ({ eyebrow, title, children }: { eyebrow?: string | null; title?: string; children: ReactElement }) => (
    <div style={{ position: 'absolute', inset: 0, padding: '112px 84px 92px' }}>
      <div
        style={{
          fontFamily: '"JetBrains Mono", ui-monospace, monospace',
          fontSize: 12,
          color: p.accent,
          letterSpacing: '.14em',
          textTransform: 'uppercase',
          marginBottom: 22,
        }}
      >
        {eyebrow || 'NOTE'}
      </div>
      {title && (
        <div style={{ fontSize: 42, lineHeight: 1.12, fontWeight: 500, letterSpacing: '-.015em', maxWidth: 920, marginBottom: 32 }}>
          {title}
        </div>
      )}
      {children}
    </div>
  )

  let body: ReactElement | null = null
  if (slide.kind === 'title') {
    body = (
      <div style={{ position: 'absolute', inset: 0, padding: '120px 80px 100px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div style={{ fontFamily: '"JetBrains Mono", ui-monospace, monospace', fontSize: 13, color: p.accent, letterSpacing: '.12em' }}>
          VIDEO SUMMARY
        </div>
        <div>
          <div style={{ fontSize: 64, lineHeight: 1.05, fontWeight: 500, letterSpacing: '-.02em', textWrap: 'balance' }}>
            {slide.video.title}
          </div>
          {slide.video.tldr && (
            <div style={{ marginTop: 36, fontSize: 22, lineHeight: 1.45, color: p.muted, maxWidth: 880, textWrap: 'pretty', fontStyle: 'italic' }}>
              {slide.video.tldr}
            </div>
          )}
        </div>
      </div>
    )
  } else if (slide.kind === 'block') {
    const block = slide.block
    if (block.type === 'claim') {
      body = (
        <BlockFrame eyebrow={block.eyebrow} title={block.title}>
          <div style={{ fontSize: 29, lineHeight: 1.38, color: p.ink, maxWidth: 940, textWrap: 'pretty' }}>{block.body}</div>
        </BlockFrame>
      )
    } else if (block.type === 'list') {
      body = (
        <BlockFrame eyebrow={block.eyebrow || 'Key points'} title={block.title}>
          <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 22, maxWidth: 980 }}>
            {block.items.map((it, i) => (
              <li key={i} style={{ display: 'grid', gridTemplateColumns: '58px 1fr', gap: 24, alignItems: 'baseline' }}>
                <span style={{ fontFamily: '"JetBrains Mono", ui-monospace, monospace', fontSize: 14, color: p.muted, fontVariantNumeric: 'tabular-nums' }}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span style={{ fontSize: 25, lineHeight: 1.38, textWrap: 'pretty' }}>{it}</span>
              </li>
            ))}
          </ol>
        </BlockFrame>
      )
    } else if (block.type === 'metric') {
      body = (
        <BlockFrame eyebrow={block.eyebrow || 'By the numbers'}>
          <div>
            <div style={{ fontSize: 180, lineHeight: .9, fontWeight: 500, letterSpacing: '-.04em' }}>{block.value}</div>
            <div style={{ marginTop: 28, fontSize: 34, lineHeight: 1.18, maxWidth: 760 }}>{block.label}</div>
            {block.body && <div style={{ marginTop: 24, fontSize: 23, lineHeight: 1.42, color: p.muted, maxWidth: 820 }}>{block.body}</div>}
          </div>
        </BlockFrame>
      )
    } else if (block.type === 'quote') {
      body = (
        <BlockFrame eyebrow={block.eyebrow || 'Quote'}>
          <div>
            <div style={{ fontSize: 54, lineHeight: 1.22, fontStyle: 'italic', letterSpacing: '-.01em', maxWidth: 1000, textWrap: 'balance' }}>
              "{block.text}"
            </div>
            <div style={{ marginTop: 34, fontFamily: '"JetBrains Mono", ui-monospace, monospace', fontSize: 14, color: p.muted, letterSpacing: '.06em' }}>
              - {block.attribution}
            </div>
          </div>
        </BlockFrame>
      )
    } else if (block.type === 'timeline') {
      body = (
        <BlockFrame eyebrow={block.eyebrow || 'Timeline'} title={block.title}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 19, maxWidth: 980 }}>
            {block.items.map((it, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: 26, paddingTop: i === 0 ? 0 : 19, borderTop: i === 0 ? 'none' : `1px solid ${p.rule}` }}>
                <div style={{ fontFamily: '"JetBrains Mono", ui-monospace, monospace', fontSize: 16, color: p.accent, fontVariantNumeric: 'tabular-nums' }}>{it.marker}</div>
                <div style={{ fontSize: 24, lineHeight: 1.32 }}>{it.text}</div>
              </div>
            ))}
          </div>
        </BlockFrame>
      )
    }
  } else if (slide.kind === 'closer') {
    body = (
      <div style={{ position: 'absolute', inset: 0, padding: '120px 80px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontFamily: '"JetBrains Mono", ui-monospace, monospace', fontSize: 12, color: p.accent, letterSpacing: '.14em', marginBottom: 24 }}>
            WATCH THE FULL VIDEO
          </div>
          <div style={{ fontSize: 44, lineHeight: 1.2, letterSpacing: '-.015em', maxWidth: 900, textWrap: 'balance' }}>{slide.video.title}</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 32, fontFamily: '"JetBrains Mono", ui-monospace, monospace', fontSize: 13, color: p.muted }}>
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
            <div style={{ fontSize: 16, color: p.ink }}>{(slide.video.tags || []).join(' / ')}</div>
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
