import type { Channel, DeckBlock, TranscriptSnippet, Video } from '../types'

type DetailPoint = {
  n?: number
  start: number
  title: string
  text: string
}

const numberWords: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
  twenty: 20, 'twenty one': 21, 'twenty-one': 21, 'twenty two': 22, 'twenty-two': 22, 'twenty three': 23, 'twenty-three': 23,
  'twenty four': 24, 'twenty-four': 24, 'twenty five': 25, 'twenty-five': 25, 'twenty six': 26, 'twenty-six': 26,
  'twenty seven': 27, 'twenty-seven': 27, 'twenty eight': 28, 'twenty-eight': 28, 'twenty nine': 29, 'twenty-nine': 29,
  thirty: 30, 'thirty one': 31, 'thirty-one': 31, 'thirty two': 32, 'thirty-two': 32, 'thirty three': 33, 'thirty-three': 33,
  'thirty four': 34, 'thirty-four': 34, 'thirty five': 35, 'thirty-five': 35, 'thirty six': 36, 'thirty-six': 36,
  'thirty seven': 37, 'thirty-seven': 37, 'thirty eight': 38, 'thirty-eight': 38, 'thirty nine': 39, 'thirty-nine': 39, forty: 40,
}

function parseNumberToken(token: string): number | null {
  const normalized = token.toLowerCase().replace(/[.,]/g, '').trim()
  if (/^\d+$/.test(normalized)) return Number(normalized)
  return numberWords[normalized] || null
}

function cleanTitle(text: string): string {
  const first = text.replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s+/)[0] || text
  return first.replace(/^(,|\.|:|-)+\s*/, '').trim()
}

function numberedPoints(transcript: TranscriptSnippet[]): DetailPoint[] {
  const markers: Array<{ n: number; index: number; start: number; firstText: string }> = []
  let expected = 1
  const markerRx = /\bNumber\s+((?:twenty|thirty)(?:[-\s](?:one|two|three|four|five|six|seven|eight|nine))?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|forty|\d{1,2})[,.]?/i

  transcript.forEach((snippet, index) => {
    const text = snippet.text.replace(/\s+/g, ' ').trim()
    const direct = text.match(markerRx)
    let n: number | null = null
    let after = ''

    if (direct?.[1]) {
      n = parseNumberToken(direct[1])
      after = text.slice((direct.index || 0) + direct[0].length).trim()
    }

    if (n !== expected) {
      const words = Object.entries(numberWords).filter(([, value]) => value === expected).map(([word]) => word.replace('-', '[-\\s]')).join('|')
      const startMatch = text.match(new RegExp(`^(${expected}|${words})[,.]?\\s+`, 'i'))
      if (startMatch) {
        n = expected
        after = text.slice(startMatch[0].length).trim()
      }
    }

    if (n === expected) {
      markers.push({ n, index, start: snippet.start, firstText: after })
      expected += 1
    }
  })

  return markers.map((marker, i) => {
    const next = markers[i + 1]
    const bodySnippets = transcript.slice(marker.index + 1, next?.index).map((item) => item.text)
    const nextText = next ? transcript[next.index]?.text || '' : ''
    const nextMarker = nextText.match(/\bNumber\s+/i)
    const nextPrefix = nextMarker ? nextText.slice(0, nextMarker.index).trim() : ''
    const text = `${marker.firstText} ${bodySnippets.join(' ')} ${nextPrefix}`.replace(/\s+/g, ' ').trim()
    return { n: marker.n, start: marker.start, title: cleanTitle(text), text }
  })
}

function nearbyTranscriptDetails(transcript: TranscriptSnippet[], start: number | null | undefined): DetailPoint[] {
  if (typeof start !== 'number') return []
  return transcript
    .filter((snippet) => snippet.start >= start - 4 && snippet.start <= start + 55)
    .slice(0, 8)
    .map((snippet) => ({ start: snippet.start, title: snippet.text, text: snippet.text }))
}

function detailsForBlock(block: DeckBlock, index: number, blocks: DeckBlock[], transcript: TranscriptSnippet[]): DetailPoint[] {
  const numbered = numberedPoints(transcript)
  if (numbered.length >= 8) {
    const blockStart = typeof block.source_start === 'number' ? block.source_start : 0
    const nextStart = blocks.slice(index + 1).find((candidate) => typeof candidate.source_start === 'number')?.source_start
    const related = numbered.filter((point) => point.start >= blockStart && (typeof nextStart !== 'number' || point.start < nextStart))
    if (related.length) return related
  }
  return nearbyTranscriptDetails(transcript, block.source_start)
}

type Props = {
  video: Video | null
  channel: Channel | null
  onJump?: (seconds: number) => void
}

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

function blocksFor(video: Video): DeckBlock[] {
  return video.deck?.blocks?.length ? video.deck.blocks : legacyBlocks(video)
}

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

function fmtTimestamp(seconds: number | null | undefined): string {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds)) return '--:--'
  const total = Math.max(0, Math.floor(seconds))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const sec = total % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  return `${m}:${String(sec).padStart(2, '0')}`
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

export function DeckPanel({ video, channel, onJump }: Props) {
  if (!video) {
    return <EmptyDeck />
  }

  const blocks = blocksFor(video)
  const transcript = video.transcript || []
  if (blocks.length === 0) {
    return <EmptyDeck />
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)', minHeight: 0 }}>
      <div style={headerStyle}>
        <div>
          <div style={monoMutedStyle}>EDITORIAL STRIP</div>
          <div style={{ marginTop: 3, fontFamily: 'var(--serif)', fontSize: 15, color: 'var(--ink)' }}>
            {video.deck?.title || video.title}
          </div>
        </div>
        <div style={{ ...monoMutedStyle, fontVariantNumeric: 'tabular-nums' }}>{blocks.length} SECTIONS</div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '18px 22px 28px' }}>
        {video.deck?.tldr && <p style={tldrStyle}>{video.deck.tldr}</p>}
        <div style={stripStyle}>
          {blocks.map((block, i) => (
            <section key={i} style={{ ...rowStyle, borderTop: i === 0 ? 0 : '1px solid var(--rule)' }}>
              <div style={metaColStyle}>
                <div style={editorialMetaStyle}>
                  <span>{String(i + 1).padStart(2, '0')}</span>
                  {typeof block.source_start === 'number' ? (
                    <button
                      type="button"
                      onClick={() => onJump?.(block.source_start!)}
                      style={timestampButtonStyle}
                      title={`Jump to ${fmtTimestamp(block.source_start)}`}
                    >
                      {fmtTimestamp(block.source_start)}
                    </button>
                  ) : (
                    <span style={timestampStyle}>{fmtTimestamp(block.source_start)}</span>
                  )}
                </div>
                <div style={typeStyle}>{block.type}</div>
                {channel && <div style={{ ...typeStyle, color: 'var(--muted)' }}>{channel.name}</div>}
              </div>

              <div style={{ minWidth: 0 }}>
                <h3 style={sectionTitleStyle}>{blockTitle(block)}</h3>
                <p style={bodyStyle}>{blockText(block)}</p>
                <DetailLayer details={detailsForBlock(block, i, blocks, transcript)} onJump={onJump} />
                {block.links?.length ? <SourceLinks links={block.links} /> : null}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}

function EmptyDeck() {
  return (
    <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: 'var(--muted)', fontFamily: 'var(--serif)', fontSize: 16, background: 'var(--bg)', textAlign: 'center', padding: 40 }}>
      <div>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.1em', marginBottom: 12 }}>NO NOTES</div>
        <div style={{ maxWidth: 320 }}>Add a video to generate its editorial summary, or pick one from the list.</div>
      </div>
    </div>
  )
}

function DetailLayer({ details, onJump }: { details: DetailPoint[]; onJump?: (seconds: number) => void }) {
  if (details.length === 0) return null
  return (
    <details style={detailLayerStyle}>
      <summary style={detailSummaryStyle}>More detail / {details.length} reference {details.length === 1 ? 'point' : 'points'}</summary>
      <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
        {details.map((detail, i) => (
          <div key={`${detail.start}-${i}`} style={detailRowStyle}>
            <button type="button" onClick={() => onJump?.(detail.start)} style={detailTimestampStyle}>
              {detail.n ? String(detail.n).padStart(2, '0') + ' / ' : ''}{fmtTimestamp(detail.start)}
            </button>
            <div>
              <div style={{ color: 'var(--ink)', lineHeight: 1.3 }}>{detail.title}</div>
              {detail.text !== detail.title && <div style={{ marginTop: 4, color: 'var(--muted)', lineHeight: 1.4 }}>{detail.text}</div>}
            </div>
          </div>
        ))}
      </div>
    </details>
  )
}

function SourceLinks({ links }: { links: NonNullable<DeckBlock['links']> }) {
  return (
    <div style={sourceLinksStyle}>
      <div style={{ ...monoMutedStyle, fontSize: 10 }}>READ MORE</div>
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

const headerStyle: React.CSSProperties = {
  padding: '14px 22px',
  borderBottom: '1px solid var(--rule)',
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: 16,
}

const monoMutedStyle: React.CSSProperties = {
  fontFamily: 'var(--mono)',
  fontSize: 10.5,
  color: 'var(--muted)',
  letterSpacing: '.1em',
  textTransform: 'uppercase',
}

const tldrStyle: React.CSSProperties = {
  margin: '0 0 16px',
  maxWidth: 760,
  fontFamily: 'var(--serif)',
  fontSize: 19,
  lineHeight: 1.42,
  color: 'var(--ink)',
}

const stripStyle: React.CSSProperties = {
  display: 'grid',
  gap: 0,
  border: '1px solid var(--rule-strong)',
  background: 'var(--surface)',
}

const rowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '128px minmax(0, 1fr)',
  gap: 18,
  padding: '18px 16px 18px 0',
}

const metaColStyle: React.CSSProperties = {
  paddingLeft: 14,
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

const typeStyle: React.CSSProperties = {
  marginTop: 5,
  color: 'var(--accent)',
  fontFamily: 'var(--mono)',
  fontSize: 10,
  letterSpacing: '.06em',
  textTransform: 'uppercase',
}

const sectionTitleStyle: React.CSSProperties = {
  margin: 0,
  fontFamily: 'var(--serif)',
  fontSize: 25,
  fontWeight: 500,
  lineHeight: 1.12,
  color: 'var(--ink)',
}

const bodyStyle: React.CSSProperties = {
  margin: '8px 0 0',
  lineHeight: 1.48,
  color: 'var(--muted)',
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


const detailLayerStyle: React.CSSProperties = {
  marginTop: 12,
  paddingTop: 10,
  borderTop: '1px solid var(--rule)',
}

const detailSummaryStyle: React.CSSProperties = {
  cursor: 'pointer',
  fontFamily: 'var(--mono)',
  fontSize: 10.5,
  letterSpacing: '.08em',
  color: 'var(--accent)',
  textTransform: 'uppercase',
}

const detailRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '72px minmax(0, 1fr)',
  gap: 10,
  alignItems: 'baseline',
  padding: '8px 0',
  borderTop: '1px solid var(--rule)',
}

const detailTimestampStyle: React.CSSProperties = {
  appearance: 'none',
  border: 0,
  padding: 0,
  background: 'transparent',
  color: 'var(--accent)',
  cursor: 'pointer',
  fontFamily: 'var(--mono)',
  fontSize: 10.5,
  textAlign: 'left',
  fontVariantNumeric: 'tabular-nums',
}
