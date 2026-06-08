import { useEffect, useMemo, useState } from 'react'
import { listVideos } from './lib/pb'
import type { DeckBlock, Video } from './types'

const TARGET_TITLE = 'How to Spend Money Smarter for Greater Happiness'

function blockText(block: DeckBlock): string {
  if (block.type === 'claim') return block.body
  if (block.type === 'list') return block.items.join(' ')
  if (block.type === 'metric') return [block.label, block.body].filter(Boolean).join(' ')
  if (block.type === 'quote') return block.text
  return block.items.map((it) => `${it.marker}: ${it.text}`).join(' ')
}

function blockTitle(block: DeckBlock): string {
  if (block.type === 'metric') return `${block.value} ${block.label}`
  if (block.type === 'quote') return block.eyebrow || 'Quote'
  return block.title
}

function blockEyebrow(block: DeckBlock, index: number): string {
  return block.eyebrow || block.type.replace(/^./, (c) => c.toUpperCase()) || `Block ${index + 1}`
}

function faviconUrl(url: string): string {
  return `https://www.google.com/s2/favicons?domain_url=${encodeURIComponent(url)}&sz=32`
}

function hostLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function fmtTimestamp(seconds: number | null | undefined): string {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds)) return '--:--'
  const total = Math.max(0, Math.floor(seconds))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const sec = total % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  return `${m}:${String(sec).padStart(2, '0')}`
}

function shortBody(text: string, words = 28): string {
  const parts = text.split(/\s+/).filter(Boolean)
  if (parts.length <= words) return text
  return `${parts.slice(0, words).join(' ')}...`
}

function useSelectedVideo() {
  const [videos, setVideos] = useState<Video[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'paper')
    listVideos().then(setVideos).catch((e) => setError(e instanceof Error ? e.message : 'Failed to load videos'))
  }, [])

  const selected = useMemo(() => {
    const params = new URLSearchParams(window.location.search)
    const id = params.get('id')
    if (id) return videos.find((v) => v.id === id || v.youtubeId === id) || null
    return videos.find((v) => v.title.toLowerCase().includes(TARGET_TITLE.toLowerCase())) || videos[0] || null
  }, [videos])

  return { selected, videos, error }
}

export function VisualLab() {
  const { selected, videos, error } = useSelectedVideo()
  const blocks = selected?.deck?.blocks || []
  const [jumpStart, setJumpStart] = useState<number | null>(null)

  useEffect(() => {
    setJumpStart(null)
  }, [selected?.id])

  return (
    <main style={pageStyle}>
      <header style={topBarStyle}>
        <div>
          <div style={monoLabel}>VISUAL LAB</div>
          <h1 style={{ margin: '5px 0 0', fontFamily: 'var(--serif)', fontSize: 28, fontWeight: 500 }}>Deck data treatments</h1>
        </div>
        <a href="/" style={navLinkStyle}>Back to app</a>
      </header>

      {error && <div style={noticeStyle}>{error}</div>}
      {!selected && !error && <div style={noticeStyle}>Loading saved videos...</div>}

      {selected && (
        <>
          <section style={heroStyle}>
            <div style={monoLabel}>SOURCE RECORD</div>
            <h2 style={heroTitleStyle}>{selected.deck?.title || selected.title}</h2>
            <p style={heroTextStyle}>{selected.deck?.tldr || selected.tldr}</p>
            <div style={metaRowStyle}>
              <span>{blocks.length} blocks</span>
              <span>{selected.youtubeId}</span>
              <span>{videos.length} saved videos</span>
            </div>
          </section>

          <section style={playerShellStyle}>
            <div style={playerTextStyle}>
              <div style={monoLabel}>SOURCE VIDEO</div>
              <div style={{ marginTop: 6, fontFamily: 'var(--serif)', fontSize: 24, lineHeight: 1.12 }}>Click any Editorial Strip timestamp to jump the player.</div>
            </div>
            <div style={playerFrameStyle}>
              <iframe
                key={`${selected.youtubeId}-${jumpStart ?? 'start'}`}
                src={`https://www.youtube.com/embed/${selected.youtubeId}?rel=0&modestbranding=1${jumpStart !== null ? `&start=${Math.floor(jumpStart)}&autoplay=1` : ''}`}
                title={selected.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
              />
            </div>
          </section>

          <section style={gridStyle}>
            <Treatment title="Slim Notes" kicker="No deck, just a compact reading object">
              <SlimNotes video={selected} blocks={blocks} />
            </Treatment>
            <Treatment title="Decision Timeline" kicker="Sequential money rules as a vertical path">
              <DecisionTimeline blocks={blocks} />
            </Treatment>
            <Treatment title="Question Ladder" kicker="Five prompts as action checkpoints">
              <QuestionLadder blocks={blocks} />
            </Treatment>
            <Treatment title="Field Guide" kicker="Small cards for scanning and comparison">
              <FieldGuide blocks={blocks} />
            </Treatment>
            <Treatment title="Editorial Strip" kicker="Magazine-style sections in one long page">
              <EditorialStrip blocks={blocks} onJump={setJumpStart} />
            </Treatment>
            <Treatment title="Radar Summary" kicker="A visual index of emphasis by block type">
              <RadarSummary blocks={blocks} />
            </Treatment>
          </section>
        </>
      )}
    </main>
  )
}

function Treatment({ title, kicker, children }: { title: string; kicker: string; children: React.ReactNode }) {
  return (
    <article style={treatmentStyle}>
      <div style={treatmentHeadStyle}>
        <div>
          <div style={monoLabel}>{title}</div>
          <p style={{ margin: '5px 0 0', color: 'var(--muted)', fontSize: 13 }}>{kicker}</p>
        </div>
      </div>
      {children}
    </article>
  )
}

function SlimNotes({ video, blocks }: { video: Video; blocks: DeckBlock[] }) {
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <h3 style={sectionTitleStyle}>{video.deck?.title || video.title}</h3>
      <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 18, lineHeight: 1.45 }}>{video.deck?.tldr}</p>
      <div style={{ borderTop: '1px solid var(--rule-strong)', paddingTop: 12, display: 'grid', gap: 10 }}>
        {blocks.map((block, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '34px 1fr', gap: 12 }}>
            <div style={indexPillStyle}>{i + 1}</div>
            <div>
              <div style={{ fontWeight: 650, lineHeight: 1.25 }}>{blockTitle(block)}</div>
              <div style={{ color: 'var(--muted)', lineHeight: 1.42, marginTop: 3 }}>{shortBody(blockText(block), 24)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function DecisionTimeline({ blocks }: { blocks: DeckBlock[] }) {
  return (
    <div style={{ position: 'relative', paddingLeft: 28 }}>
      <div style={{ position: 'absolute', left: 8, top: 6, bottom: 8, width: 2, background: 'var(--rule-strong)' }} />
      {blocks.map((block, i) => (
        <div key={i} style={{ position: 'relative', paddingBottom: i === blocks.length - 1 ? 0 : 20 }}>
          <div style={timelineDotStyle}>{i + 1}</div>
          <div style={{ ...monoLabel, marginBottom: 5 }}>{blockEyebrow(block, i)}</div>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 22, lineHeight: 1.15 }}>{blockTitle(block)}</div>
          <p style={{ margin: '7px 0 0', color: 'var(--muted)', lineHeight: 1.45 }}>{shortBody(blockText(block), 22)}</p>
        </div>
      ))}
    </div>
  )
}

function QuestionLadder({ blocks }: { blocks: DeckBlock[] }) {
  const list = blocks.find((b): b is Extract<DeckBlock, { type: 'list' }> => b.type === 'list')
  const items = list?.items || blocks.map(blockTitle)
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {items.map((item, i) => (
        <div key={i} style={ladderRowStyle}>
          <div style={{ ...indexPillStyle, background: i < 3 ? 'var(--accent)' : 'var(--surface-2)', color: i < 3 ? '#fff' : 'var(--ink)' }}>{i + 1}</div>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 20, lineHeight: 1.22 }}>{item}</div>
        </div>
      ))}
      <div style={{ marginTop: 8, padding: '12px 14px', background: 'var(--surface-2)', borderRadius: 8, lineHeight: 1.45 }}>
        <strong>Interaction idea:</strong> each row could become a purchase-scoring checkbox, not a slide.
      </div>
    </div>
  )
}

function FieldGuide({ blocks }: { blocks: DeckBlock[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
      {blocks.map((block, i) => (
        <div key={i} style={fieldCardStyle}>
          <div style={monoLabel}>{blockEyebrow(block, i)}</div>
          <div style={{ marginTop: 8, fontWeight: 700, lineHeight: 1.22 }}>{blockTitle(block)}</div>
          <div style={{ marginTop: 8, color: 'var(--muted)', lineHeight: 1.35, fontSize: 13 }}>{shortBody(blockText(block), 18)}</div>
        </div>
      ))}
    </div>
  )
}

function EditorialStrip({ blocks, onJump }: { blocks: DeckBlock[]; onJump: (seconds: number) => void }) {
  return (
    <div style={{ display: 'grid', gap: 0, border: '1px solid var(--rule-strong)' }}>
      {blocks.map((block, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '128px 1fr', gap: 18, padding: '16px 0', borderTop: i === 0 ? 0 : '1px solid var(--rule)' }}>
          <div style={{ paddingLeft: 14 }}>
            <div style={editorialMetaStyle}>
              <span>{String(i + 1).padStart(2, '0')}</span>
              {typeof block.source_start === 'number' ? (
                <button type="button" onClick={() => onJump(block.source_start!)} style={timestampButtonStyle} title={`Jump to ${fmtTimestamp(block.source_start)}`}>
                  {fmtTimestamp(block.source_start)}
                </button>
              ) : (
                <span style={timestampStyle}>{fmtTimestamp(block.source_start)}</span>
              )}
            </div>
            <div style={{ marginTop: 5, color: 'var(--accent)', fontFamily: 'var(--mono)', fontSize: 10 }}>{block.type}</div>
          </div>
          <div style={{ paddingRight: 16 }}>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 24, lineHeight: 1.12 }}>{blockTitle(block)}</div>
            <p style={{ margin: '8px 0 0', lineHeight: 1.48, color: 'var(--muted)' }}>{blockText(block)}</p>
            {block.links?.length ? <SourceLinks links={block.links} /> : null}
          </div>
        </div>
      ))}
    </div>
  )
}

function SourceLinks({ links }: { links: NonNullable<DeckBlock['links']> }) {
  return (
    <div style={sourceLinksStyle}>
      <div style={{ ...monoLabel, color: 'var(--muted)', fontSize: 10 }}>Read more</div>
      <div style={{ display: 'grid', gap: 7, marginTop: 8 }}>
        {links.map((link, i) => (
          <a key={`${link.url}-${i}`} href={link.url} target="_blank" rel="noreferrer" style={sourceLinkStyle}>
            <img src={faviconUrl(link.url)} alt="" width={16} height={16} style={{ borderRadius: 3, flexShrink: 0 }} />
            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{link.title}</span>
            <span style={{ color: 'var(--muted)', flexShrink: 0 }}>{link.publisher || hostLabel(link.url)}</span>
          </a>
        ))}
      </div>
    </div>
  )
}

function RadarSummary({ blocks }: { blocks: DeckBlock[] }) {
  const counts = blocks.reduce<Record<string, number>>((acc, block) => {
    acc[block.type] = (acc[block.type] || 0) + 1
    return acc
  }, {})
  const types = ['claim', 'list', 'metric', 'quote', 'timeline']
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {types.map((type) => {
        const count = counts[type] || 0
        return (
          <div key={type} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 28px', gap: 10, alignItems: 'center' }}>
            <div style={{ ...monoLabel, color: count ? 'var(--accent)' : 'var(--muted)' }}>{type}</div>
            <div style={{ height: 9, borderRadius: 99, background: 'var(--surface-2)', overflow: 'hidden' }}>
              <div style={{ width: `${Math.max(4, (count / Math.max(1, blocks.length)) * 100)}%`, height: '100%', background: count ? 'var(--accent)' : 'transparent' }} />
            </div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 12, textAlign: 'right' }}>{count}</div>
          </div>
        )
      })}
      <div style={{ marginTop: 8, fontFamily: 'var(--serif)', fontSize: 25, lineHeight: 1.18 }}>
        This deck is mostly argument blocks, with one reusable decision list.
      </div>
    </div>
  )
}

const pageStyle: React.CSSProperties = {
  height: '100vh',
  overflow: 'auto',
  background: 'var(--bg)',
  color: 'var(--ink)',
  padding: '24px clamp(16px, 3vw, 44px) 44px',
}

const topBarStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 16,
  marginBottom: 18,
}

const navLinkStyle: React.CSSProperties = {
  color: 'var(--accent)',
  textDecoration: 'none',
  fontFamily: 'var(--mono)',
  fontSize: 12,
  letterSpacing: '.08em',
}

const heroStyle: React.CSSProperties = {
  borderTop: '1px solid var(--rule-strong)',
  borderBottom: '1px solid var(--rule-strong)',
  padding: '28px 0',
  marginBottom: 22,
}

const heroTitleStyle: React.CSSProperties = {
  margin: '8px 0 0',
  fontFamily: 'var(--serif)',
  fontSize: 'clamp(34px, 5vw, 68px)',
  lineHeight: 1.02,
  fontWeight: 500,
  maxWidth: 980,
}

const heroTextStyle: React.CSSProperties = {
  margin: '18px 0 0',
  maxWidth: 820,
  fontSize: 18,
  lineHeight: 1.5,
  color: 'var(--muted)',
}

const metaRowStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
  marginTop: 18,
  fontFamily: 'var(--mono)',
  fontSize: 11,
  color: 'var(--muted)',
  letterSpacing: '.06em',
}

const playerShellStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(220px, 360px) minmax(320px, 1fr)',
  gap: 18,
  alignItems: 'center',
  marginBottom: 18,
}

const playerTextStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--rule)',
  borderRadius: 8,
  padding: 18,
}

const playerFrameStyle: React.CSSProperties = {
  position: 'relative',
  aspectRatio: '16 / 9',
  background: '#000',
  borderRadius: 8,
  overflow: 'hidden',
  minHeight: 220,
}

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
  gap: 18,
  alignItems: 'start',
}

const treatmentStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--rule)',
  borderRadius: 8,
  padding: 18,
  minHeight: 280,
}

const treatmentHeadStyle: React.CSSProperties = {
  paddingBottom: 14,
  marginBottom: 14,
  borderBottom: '1px solid var(--rule)',
}

const monoLabel: React.CSSProperties = {
  fontFamily: 'var(--mono)',
  fontSize: 11,
  letterSpacing: '.1em',
  color: 'var(--accent)',
  textTransform: 'uppercase',
}

const noticeStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--rule)',
  borderRadius: 8,
  padding: 16,
}

const sectionTitleStyle: React.CSSProperties = {
  margin: 0,
  fontFamily: 'var(--serif)',
  fontSize: 30,
  lineHeight: 1.08,
  fontWeight: 500,
}

const indexPillStyle: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 99,
  display: 'grid',
  placeItems: 'center',
  background: 'var(--surface-2)',
  fontFamily: 'var(--mono)',
  fontSize: 11,
  fontWeight: 700,
}

const timelineDotStyle: React.CSSProperties = {
  position: 'absolute',
  left: -28,
  top: 0,
  width: 18,
  height: 18,
  borderRadius: 99,
  display: 'grid',
  placeItems: 'center',
  background: 'var(--accent)',
  color: '#fff',
  fontFamily: 'var(--mono)',
  fontSize: 10,
}

const ladderRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '34px 1fr',
  gap: 12,
  alignItems: 'center',
  padding: '11px 12px',
  border: '1px solid var(--rule)',
  borderRadius: 8,
}

const fieldCardStyle: React.CSSProperties = {
  minHeight: 150,
  border: '1px solid var(--rule)',
  borderRadius: 8,
  padding: 14,
  background: 'var(--bg)',
}


const editorialMetaStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  gap: 8,
  fontFamily: 'var(--mono)',
  fontSize: 11,
  letterSpacing: '.08em',
  color: 'var(--accent)',
  textTransform: 'uppercase',
}

const timestampStyle: React.CSSProperties = {
  color: 'var(--muted)',
  fontVariantNumeric: 'tabular-nums',
  letterSpacing: 0,
}


const timestampButtonStyle: React.CSSProperties = {
  appearance: 'none',
  border: 0,
  padding: 0,
  background: 'transparent',
  color: 'var(--muted)',
  cursor: 'pointer',
  fontFamily: 'var(--mono)',
  fontSize: 11,
  fontVariantNumeric: 'tabular-nums',
  letterSpacing: 0,
  textDecoration: 'underline',
  textUnderlineOffset: 3,
}


const sourceLinksStyle: React.CSSProperties = {
  marginTop: 12,
  paddingTop: 10,
  borderTop: '1px solid var(--rule)',
}

const sourceLinkStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '16px minmax(0, 1fr) auto',
  alignItems: 'center',
  gap: 8,
  color: 'var(--ink)',
  textDecoration: 'none',
  fontFamily: 'var(--mono)',
  fontSize: 11,
  lineHeight: 1.2,
}
