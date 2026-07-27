export type RichSegment =
  | { kind: 'text'; text: string }
  | { kind: 'link'; label: string; url: string }
  | { kind: 'ref'; url: string }

const MARKDOWN_LINK = /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g
// Legacy decks inlined the raw URL in parens after the entity name.
const PARENTHESISED_URL = /\s*\((https?:\/\/[^\s)]+)\)/g
const BARE_URL = /https?:\/\/[^\s<>()]+[^\s<>().,;:!?]/g

type Match = { start: number; end: number; segment: RichSegment }

// Trailing proper-noun phrase: a capitalised word, then up to 7 more words that
// are capitalised or small connectors ("of", "the"). Matches "Pantlaza,
// Sun-Favored" in "The commander Pantlaza, Sun-Favored" but stops at
// "commander".
const CONNECTORS = 'of|the|and|a|to|in|for|on|with|de|van'
const ENTITY_TAIL = new RegExp(
  `(?:^|[\\s"“'(\\[])((?:[A-Z][\\w'’.\\-]*)(?:[,:]?\\s(?:[A-Z][\\w'’.\\-]*|${CONNECTORS}|\\d+)){0,7})$`,
)

/** Split trailing entity name off a text run, so a bare URL can label it. */
export function splitTrailingEntity(text: string): { before: string; label: string } | null {
  const match = ENTITY_TAIL.exec(text)
  if (!match) return null
  const label = match[1].trim()
  if (label.length < 2) return null
  return { before: text.slice(0, text.length - label.length), label }
}

/**
 * Legacy decks wrote "Card Name (https://…)". Promote the name itself to the
 * link so the whole phrase is hoverable, not just a trailing icon.
 */
function attachRefsToNames(segments: RichSegment[]): RichSegment[] {
  const out: RichSegment[] = []
  for (const segment of segments) {
    const previous = out[out.length - 1]
    if (segment.kind === 'ref' && previous?.kind === 'text') {
      const split = splitTrailingEntity(previous.text)
      if (split) {
        if (split.before) out[out.length - 1] = { kind: 'text', text: split.before }
        else out.pop()
        out.push({ kind: 'link', label: split.label, url: segment.url })
        continue
      }
    }
    out.push(segment)
  }
  return out
}

function collect(text: string, re: RegExp, toSegment: (m: RegExpExecArray) => RichSegment): Match[] {
  const out: Match[] = []
  re.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    out.push({ start: m.index, end: m.index + m[0].length, segment: toSegment(m) })
  }
  return out
}

/**
 * Split text into plain runs and links.
 *
 * - `[label](url)` becomes a labelled link.
 * - a trailing `(url)` becomes a bare reference marker, so old decks that
 *   pasted URLs into prose read as text plus a link icon instead of raw noise.
 * - a loose `url` in prose becomes a reference marker too.
 */
export function parseRichText(input: string): RichSegment[] {
  if (!input) return []

  const matches = [
    ...collect(input, MARKDOWN_LINK, (m) => ({ kind: 'link', label: m[1], url: m[2] })),
    ...collect(input, PARENTHESISED_URL, (m) => ({ kind: 'ref', url: m[1] })),
    ...collect(input, BARE_URL, (m) => ({ kind: 'ref', url: m[0] })),
  ].sort((a, b) => a.start - b.start || b.end - a.end)

  const segments: RichSegment[] = []
  let cursor = 0
  for (const match of matches) {
    if (match.start < cursor) continue // already consumed by an earlier, outer match
    if (match.start > cursor) segments.push({ kind: 'text', text: input.slice(cursor, match.start) })
    segments.push(match.segment)
    cursor = match.end
  }
  if (cursor < input.length) segments.push({ kind: 'text', text: input.slice(cursor) })

  return attachRefsToNames(segments.filter((s) => s.kind !== 'text' || s.text.length > 0))
}

/** Same text with every link reduced to its label — for excerpts and titles. */
export function stripRichText(input: string): string {
  return parseRichText(input)
    .map((s) => (s.kind === 'text' ? s.text : s.kind === 'link' ? s.label : ''))
    .join('')
    .replace(/\s+([.,;:!?])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

export function hostLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export function faviconUrl(url: string): string {
  return `https://www.google.com/s2/favicons?domain_url=${encodeURIComponent(url)}&sz=32`
}
