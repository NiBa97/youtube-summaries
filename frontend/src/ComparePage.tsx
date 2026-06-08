import { useEffect, useMemo, useState } from 'react'
import type { DeckBlock } from './types'

const TARGET_VIDEO_ID = 'w39A92UzTDY'

type TranscriptSnippet = { text: string; start: number; duration: number }
type RawRecord = {
  id: string
  title: string
  video_id: string
  url: string
  deck?: { title?: string; tldr?: string; blocks?: DeckBlock[] }
  transcript?: TranscriptSnippet[]
}

type TruthPoint = {
  n: number
  start: number
  title: string
  text: string
  theme: string
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

const themeRules: Array<[string, RegExp]> = [
  ['People', /people|jerk|toxic|surround|friend|relative|respect|reputation|love|everyone/i],
  ['Work', /work|resume|portfolio|talent|action|planning|responsibility|shots|questions|smartest/i],
  ['Mindset', /luck|spotlight|certainty|curiosity|positive|cynic|confidence|humble|main character/i],
  ['Money', /spend|money|frugal|overhead|interest|compound|retire/i],
  ['Health', /break|sleep|exercise|read|move|body/i],
]

function classify(text: string): string {
  return themeRules.find(([, rx]) => rx.test(text))?.[0] || 'Life'
}

function fmtTimestamp(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const sec = total % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  return `${m}:${String(sec).padStart(2, '0')}`
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

function extractTruths(transcript: TranscriptSnippet[]): TruthPoint[] {
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
      const startRx = new RegExp(`^(${expected}|${Object.entries(numberWords).filter(([, value]) => value === expected).map(([word]) => word.replace('-', '[-\\s]')).join('|')})[,.]?\\s+`, 'i')
      const startMatch = text.match(startRx)
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
    const bodySnippets = transcript.slice(marker.index + 1, next?.index).map((s) => s.text)
    const nextText = next ? transcript[next.index]?.text || '' : ''
    const nextMarker = nextText.match(/\bNumber\s+/i)
    const nextPrefix = nextMarker ? nextText.slice(0, nextMarker.index).trim() : ''
    const text = `${marker.firstText} ${bodySnippets.join(' ')} ${nextPrefix}`.replace(/\s+/g, ' ').trim()
    const title = cleanTitle(text)
    return { n: marker.n, start: marker.start, title, text, theme: classify(text) }
  })
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

function useComparisonRecord() {
  const [record, setRecord] = useState<RawRecord | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'paper')
    fetch('/pb/api/collections/videos/records?perPage=100&sort=-created')
      .then((res) => {
        if (!res.ok) throw new Error(`PocketBase HTTP ${res.status}`)
        return res.json()
      })
      .then((body) => {
        const found = body.items?.find((item: RawRecord) => item.video_id === TARGET_VIDEO_ID || item.url?.includes(TARGET_VIDEO_ID))
        if (!found) throw new Error(`No saved video found for ${TARGET_VIDEO_ID}`)
        setRecord(found)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load comparison record'))
  }, [])

  return { record, error }
}

export function ComparePage() {
  const { record, error } = useComparisonRecord()
  const points = useMemo(() => extractTruths(record?.transcript || []), [record])
  const clusters = useMemo(() => {
    return points.reduce<Record<string, TruthPoint[]>>((acc, point) => {
      acc[point.theme] ||= []
      acc[point.theme].push(point)
      return acc
    }, {})
  }, [points])

  return (
    <main style={pageStyle}>
      <header style={topBarStyle}>
        <div>
          <div style={monoLabel}>PROMPT COMPARISON</div>
          <h1 style={{ margin: '5px 0 0', fontFamily: 'var(--serif)', fontSize: 30, fontWeight: 500 }}>Summary format lab</h1>
        </div>
        <a href="/" style={navLinkStyle}>Back to app</a>
      </header>

      {error && <div style={noticeStyle}>{error}</div>}
      {!record && !error && <div style={noticeStyle}>Loading comparison data...</div>}

      {record && (
        <>
          <section style={heroStyle}>
            <div style={monoLabel}>SOURCE VIDEO</div>
            <h2 style={heroTitleStyle}>{record.title}</h2>
            <p style={heroTextStyle}>
              The current generated deck compresses a reference-style “40 truths” video into {record.deck?.blocks?.length || 0} synthesis blocks. This page compares formats that preserve different kinds of usefulness.
            </p>
            <div style={metaRowStyle}>
              <span>{points.length} extracted points</span>
              <span>{record.video_id}</span>
              <span>{record.transcript?.length || 0} transcript snippets</span>
            </div>
          </section>

          <section style={compareGridStyle}>
            <FormatCard title="Current Result" prompt="Synthesize into a short editorial deck.">
              <CurrentDeck blocks={record.deck?.blocks || []} />
            </FormatCard>

            <FormatCard title="Collapsible 40-Point Reference" prompt="Preserve every numbered point. Make details expandable.">
              <FortyPointReference points={points} />
            </FormatCard>

            <FormatCard title="Theme Clusters" prompt="Group points by use case without losing the original numbering.">
              <ThemeClusters clusters={clusters} />
            </FormatCard>

            <FormatCard title="Action Checklist" prompt="Convert advice into concrete review prompts.">
              <ActionChecklist points={points} />
            </FormatCard>

            <FormatCard title="Chronological Timeline" prompt="Keep the talk order and show pacing/timestamps.">
              <ChronologicalTimeline points={points} />
            </FormatCard>

            <FormatCard title="Calmer Editorial Digest" prompt="Summarize generously. Avoid scolding, intensifiers, or aggressive framing.">
              <CalmDigest points={points} />
            </FormatCard>
          </section>
        </>
      )}
    </main>
  )
}

function FormatCard({ title, prompt, children }: { title: string; prompt: string; children: React.ReactNode }) {
  return (
    <article style={cardStyle}>
      <div style={cardHeaderStyle}>
        <div style={monoLabel}>{title}</div>
        <p style={{ margin: '6px 0 0', color: 'var(--muted)', lineHeight: 1.4 }}>{prompt}</p>
      </div>
      {children}
    </article>
  )
}

function CurrentDeck({ blocks }: { blocks: DeckBlock[] }) {
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {blocks.map((block, i) => (
        <div key={i} style={currentBlockStyle}>
          <div style={monoLabel}>{String(i + 1).padStart(2, '0')} / {block.type}</div>
          <h3 style={smallTitleStyle}>{blockTitle(block)}</h3>
          <p style={bodyStyle}>{blockText(block)}</p>
        </div>
      ))}
    </div>
  )
}

function FortyPointReference({ points }: { points: TruthPoint[] }) {
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {points.map((point) => (
        <details key={point.n} style={detailsStyle}>
          <summary style={summaryStyle}>
            <span style={numberStyle}>{String(point.n).padStart(2, '0')}</span>
            <span style={timestampStyle}>{fmtTimestamp(point.start)}</span>
            <span>{point.title}</span>
          </summary>
          <p style={{ ...bodyStyle, margin: '10px 0 0 74px' }}>{point.text}</p>
        </details>
      ))}
    </div>
  )
}

function ThemeClusters({ clusters }: { clusters: Record<string, TruthPoint[]> }) {
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {Object.entries(clusters).map(([theme, points]) => (
        <section key={theme} style={clusterStyle}>
          <div style={monoLabel}>{theme} / {points.length}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
            {points.map((point) => <span key={point.n} style={pillStyle}>{point.n}</span>)}
          </div>
          <ul style={{ margin: '12px 0 0', paddingLeft: 18, lineHeight: 1.45 }}>
            {points.slice(0, 5).map((point) => <li key={point.n}>{point.title}</li>)}
          </ul>
        </section>
      ))}
    </div>
  )
}

function ActionChecklist({ points }: { points: TruthPoint[] }) {
  return (
    <div style={{ display: 'grid', gap: 9 }}>
      {points.slice(0, 18).map((point) => (
        <label key={point.n} style={checkRowStyle}>
          <input type="checkbox" />
          <span><strong>{point.n}.</strong> {point.title.replace(/^(don't|do)\s+/i, '')}</span>
        </label>
      ))}
      <div style={subtleBoxStyle}>Checklist view intentionally samples the first 18. A production prompt could prioritize the most actionable 12.</div>
    </div>
  )
}

function ChronologicalTimeline({ points }: { points: TruthPoint[] }) {
  return (
    <div style={{ position: 'relative', paddingLeft: 28 }}>
      <div style={{ position: 'absolute', left: 8, top: 6, bottom: 8, width: 2, background: 'var(--rule-strong)' }} />
      {points.map((point) => (
        <div key={point.n} style={{ position: 'relative', paddingBottom: 13 }}>
          <div style={dotStyle}>{point.n}</div>
          <div style={{ ...monoLabel, marginBottom: 4 }}>{fmtTimestamp(point.start)} / {point.theme}</div>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 19, lineHeight: 1.18 }}>{point.title}</div>
        </div>
      ))}
    </div>
  )
}

function CalmDigest({ points }: { points: TruthPoint[] }) {
  const grouped = ['People', 'Work', 'Mindset', 'Money', 'Health'].map((theme) => ({ theme, points: points.filter((p) => p.theme === theme) }))
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 20, lineHeight: 1.45 }}>
        A gentler summary would frame the talk as a field guide: build with care, choose people deliberately, keep your body and money steady, and remember that a meaningful life is not optimized by ambition alone.
      </p>
      {grouped.filter((g) => g.points.length).map(({ theme, points }) => (
        <div key={theme}>
          <div style={monoLabel}>{theme}</div>
          <p style={{ ...bodyStyle, marginTop: 6 }}>{points.slice(0, 4).map((p) => p.title).join(' ')}</p>
        </div>
      ))}
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

const topBarStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: 18 }
const navLinkStyle: React.CSSProperties = { color: 'var(--accent)', textDecoration: 'none', fontFamily: 'var(--mono)', fontSize: 12, letterSpacing: '.08em' }
const monoLabel: React.CSSProperties = { fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.1em', color: 'var(--accent)', textTransform: 'uppercase' }
const noticeStyle: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--rule)', borderRadius: 8, padding: 16 }
const heroStyle: React.CSSProperties = { borderTop: '1px solid var(--rule-strong)', borderBottom: '1px solid var(--rule-strong)', padding: '28px 0', marginBottom: 22 }
const heroTitleStyle: React.CSSProperties = { margin: '8px 0 0', fontFamily: 'var(--serif)', fontSize: 'clamp(34px, 5vw, 68px)', lineHeight: 1.02, fontWeight: 500, maxWidth: 980 }
const heroTextStyle: React.CSSProperties = { margin: '18px 0 0', maxWidth: 820, fontSize: 18, lineHeight: 1.5, color: 'var(--muted)' }
const metaRowStyle: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 18, fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)', letterSpacing: '.06em' }
const compareGridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 18, alignItems: 'start' }
const cardStyle: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--rule)', borderRadius: 8, padding: 18, minHeight: 280 }
const cardHeaderStyle: React.CSSProperties = { paddingBottom: 14, marginBottom: 14, borderBottom: '1px solid var(--rule)' }
const currentBlockStyle: React.CSSProperties = { padding: 12, border: '1px solid var(--rule)', borderRadius: 8, background: 'var(--bg)' }
const smallTitleStyle: React.CSSProperties = { margin: '8px 0 0', fontFamily: 'var(--serif)', fontSize: 22, lineHeight: 1.12, fontWeight: 500 }
const bodyStyle: React.CSSProperties = { margin: '8px 0 0', lineHeight: 1.48, color: 'var(--muted)' }
const detailsStyle: React.CSSProperties = { border: '1px solid var(--rule)', borderRadius: 8, padding: '10px 12px', background: 'var(--bg)' }
const summaryStyle: React.CSSProperties = { cursor: 'pointer', display: 'grid', gridTemplateColumns: '30px 48px 1fr', gap: 10, alignItems: 'baseline', lineHeight: 1.25 }
const numberStyle: React.CSSProperties = { fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }
const timestampStyle: React.CSSProperties = { fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }
const clusterStyle: React.CSSProperties = { padding: 12, border: '1px solid var(--rule)', borderRadius: 8, background: 'var(--bg)' }
const pillStyle: React.CSSProperties = { minWidth: 25, height: 25, borderRadius: 99, display: 'grid', placeItems: 'center', background: 'var(--surface-2)', fontFamily: 'var(--mono)', fontSize: 11 }
const checkRowStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: '18px 1fr', gap: 10, alignItems: 'start', lineHeight: 1.35, padding: 9, border: '1px solid var(--rule)', borderRadius: 8 }
const subtleBoxStyle: React.CSSProperties = { padding: 12, background: 'var(--surface-2)', borderRadius: 8, color: 'var(--muted)', lineHeight: 1.45 }
const dotStyle: React.CSSProperties = { position: 'absolute', left: -28, top: 0, width: 18, height: 18, borderRadius: 99, display: 'grid', placeItems: 'center', background: 'var(--accent)', color: '#fff', fontFamily: 'var(--mono)', fontSize: 9 }
