import { useState } from 'react'

import type { Community, CommunitySentiment, DeckBlock, Tag, Video } from '../types'
import { postCommunity } from '../lib/api'
import { updateVideo } from '../lib/pb'
import { RichText, SmartLink } from './RichText'
import { faviconUrl, hostLabel, stripRichText } from '../lib/richtext'

type Props = {
  video: Video | null
  topic: Tag | null
  onJump?: (seconds: number) => void
  /** Called with the updated video after a comment check has been persisted. */
  onSaved?: (video: Video) => void
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

function blockText(block: Exclude<DeckBlock, { type: 'list' }>): string {
  if (block.type === 'claim') return block.body
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

export function DeckPanel({ video, topic, onJump, onSaved }: Props) {
  if (!video) {
    return <EmptyDeck />
  }

  const blocks = blocksFor(video)
  if (blocks.length === 0) {
    return <EmptyDeck />
  }
  const community = video.deck?.community || null

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
                {topic && <div style={{ ...typeStyle, color: 'var(--muted)' }}>{topic.name}</div>}
              </div>

              <div style={{ minWidth: 0 }}>
                <h3 style={sectionTitleStyle}>{stripRichText(blockTitle(block))}</h3>
                {block.type === 'list' ? (
                  <ul style={listStyle}>
                    {block.items.map((item, j) => (
                      <li key={j} style={listItemStyle}><RichText text={item} /></li>
                    ))}
                  </ul>
                ) : (
                  <p style={bodyStyle}><RichText text={blockText(block)} /></p>
                )}
                {block.caveat ? <BlockCaveat caveat={block.caveat} /> : null}
                {block.links?.length ? <SourceLinks links={block.links} /> : null}
              </div>
            </section>
          ))}
          {community && <CommunitySection community={community} index={blocks.length + 1} />}
        </div>
        {video.deck && <CommentCheck video={video} onSaved={onSaved} />}
      </div>
    </div>
  )
}

/** Fetching comments reads YouTube's internals and costs seconds, and most
 *  comment sections have nothing worth reporting - so it is a button, not part
 *  of importing a video. */
function CommentCheck({ video, onSaved }: { video: Video; onSaved?: (v: Video) => void }) {
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // A different video means a stale result; drop it rather than show it here.
  const [shownFor, setShownFor] = useState(video.id)
  if (shownFor !== video.id) {
    setShownFor(video.id)
    setNote(null)
    setError(null)
  }

  const run = async () => {
    if (busy || !video.deck) return
    setBusy(true)
    setNote(null)
    setError(null)
    try {
      // The backend accepts a bare 11-char id, which every record has even when
      // the original URL was never stored.
      const res = await postCommunity(video.sourceUrl || video.youtubeId, video.deck)
      const saved = await updateVideo(video.id, { deck: res.deck, comments: res.comments })
      onSaved?.(saved)
      if (!res.deck.community) {
        setNote(
          res.comments.length === 0
            ? 'No comments available for this video.'
            : 'Nothing in the comments adds to the deck.',
        )
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Comment check failed')
    } finally {
      setBusy(false)
    }
  }

  const label = video.deck?.community ? 'Re-check comments' : 'Check the comments'
  return (
    <div style={commentCheckStyle}>
      <button type="button" onClick={run} disabled={busy} style={commentCheckButtonStyle}>
        {busy ? 'Reading comments…' : label}
      </button>
      {note && <span style={commentCheckNoteStyle}>{note}</span>}
      {error && <span style={{ ...commentCheckNoteStyle, color: 'var(--accent)' }}>{error}</span>}
    </div>
  )
}

/** What commenters disputed about one block. The text self-attributes
 *  ("Commenters ..."), so it cannot be misread as the video's own claim. */
function BlockCaveat({ caveat }: { caveat: string }) {
  return (
    <div style={sourceLinksStyle}>
      <div style={{ ...monoMutedStyle, fontSize: 10, color: 'var(--accent)' }}>FROM THE COMMENTS</div>
      <p style={{ ...bodyStyle, marginTop: 8 }}><RichText text={caveat} /></p>
    </div>
  )
}

function CommunitySection({ community, index }: { community: Community; index: number }) {
  const notes = community.notes || []
  return (
    <section style={{ ...rowStyle, borderTop: '1px solid var(--rule)', background: 'var(--bg)' }}>
      <div style={metaColStyle}>
        <div style={editorialMetaStyle}>
          <span>{String(index).padStart(2, '0')}</span>
          {/* No --:-- placeholder: comments have no transcript moment, and the
              empty-timestamp glyph would read as broken data. */}
          <span style={sentimentDotStyle(community.sentiment)} />
        </div>
        <div style={typeStyle}>community</div>
        <div style={{ ...typeStyle, color: 'var(--muted)' }}>{community.sentiment.toUpperCase()}</div>
      </div>

      <div style={{ minWidth: 0 }}>
        <h3 style={sectionTitleStyle}>From the comments</h3>
        <p style={bodyStyle}><RichText text={community.summary} /></p>
        {notes.length > 0 && (
          <ul style={{ listStyle: 'none', padding: 0, margin: '12px 0 0', display: 'grid', gap: 12 }}>
            {notes.map((note, i) => (
              <li key={i}>
                <div style={{ ...bodyStyle, margin: 0 }}><RichText text={note.text} /></div>
                {note.quote && <blockquote style={communityQuoteStyle}>{note.quote}</blockquote>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

/** The palette has no green/red, so sentiment is encoded by fill rather than
 *  hue - and the word beside it carries the actual meaning. */
function sentimentDotStyle(sentiment: CommunitySentiment): React.CSSProperties {
  const base: React.CSSProperties = { width: 8, height: 8, borderRadius: '50%', display: 'inline-block' }
  if (sentiment === 'critical') return { ...base, background: 'var(--accent)' }
  if (sentiment === 'mixed') return { ...base, background: 'transparent', border: '1px solid var(--accent)' }
  return { ...base, background: 'var(--muted)' }
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

function SourceLinks({ links }: { links: NonNullable<DeckBlock['links']> }) {
  return (
    <div style={sourceLinksStyle}>
      <div style={{ ...monoMutedStyle, fontSize: 10 }}>READ MORE</div>
      <div style={{ display: 'grid', gap: 7, marginTop: 8 }}>
        {links.map((link, i) => (
          <SmartLink key={`${link.url}-${i}`} url={link.url} style={sourceLinkStyle}>
            <img src={faviconUrl(link.url)} alt="" width={16} height={16} style={{ borderRadius: 3, flexShrink: 0 }} />
            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{link.title}</span>
            <span style={{ color: 'var(--muted)', flexShrink: 0 }}>{link.publisher || hostLabel(link.url)}</span>
          </SmartLink>
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

const listStyle: React.CSSProperties = {
  ...bodyStyle,
  paddingLeft: 18,
  display: 'grid',
  gap: 6,
}

const listItemStyle: React.CSSProperties = {
  paddingLeft: 2,
}

const sourceLinksStyle: React.CSSProperties = {
  marginTop: 12,
  paddingTop: 10,
  borderTop: '1px solid var(--rule)',
}

const commentCheckStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  flexWrap: 'wrap',
  marginTop: 16,
}

const commentCheckButtonStyle: React.CSSProperties = {
  appearance: 'none',
  background: 'transparent',
  border: '1px solid var(--rule-strong)',
  borderRadius: 2,
  padding: '7px 12px',
  cursor: 'pointer',
  color: 'var(--muted)',
  fontFamily: 'var(--mono)',
  fontSize: 10.5,
  letterSpacing: '.08em',
  textTransform: 'uppercase',
}

const commentCheckNoteStyle: React.CSSProperties = {
  fontFamily: 'var(--mono)',
  fontSize: 10.5,
  letterSpacing: '.04em',
  color: 'var(--muted)',
}

const communityQuoteStyle: React.CSSProperties = {
  margin: '8px 0 0',
  paddingLeft: 12,
  borderLeft: '2px solid var(--rule-strong)',
  fontFamily: 'var(--serif)',
  fontStyle: 'italic',
  fontSize: 14,
  lineHeight: 1.5,
  color: 'var(--muted)',
}

const sourceLinkStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '16px minmax(0, 1fr) auto',
  alignItems: 'center',
  gap: 8,
  color: 'var(--ink)',
  textDecoration: 'none',
  borderBottom: 0,
  fontFamily: 'var(--mono)',
  fontSize: 11,
  lineHeight: 1.2,
}
