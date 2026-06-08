export type Status = 'unread' | 'reading' | 'read'
export type TranscriptSnippet = { text: string; start: number; duration: number }

export type Channel = {
  id: string
  name: string
  handle: string
  color: string
  topics: string[]
  followers: string
  cadence: string
}

export type SummaryStat = { value: string; caption: string }
export type SummaryQuote = { text: string; attrib: string }
export type SummaryTimelineItem = { year: string; label: string }

export type Summary = {
  keypoints?: string[]
  stat?: SummaryStat | null
  quote?: SummaryQuote | null
  timeline?: SummaryTimelineItem[] | null
}

export type TimelineBlockItem = { marker: string; text: string }
export type BlockLink = { title: string; url: string; publisher?: string | null }
type BlockSource = { source_start?: number | null; links?: BlockLink[] | null }
export type ClaimBlock = BlockSource & { type: 'claim'; eyebrow?: string | null; title: string; body: string }
export type ListBlock = BlockSource & { type: 'list'; eyebrow?: string | null; title: string; items: string[] }
export type MetricBlock = BlockSource & { type: 'metric'; eyebrow?: string | null; value: string; label: string; body?: string | null }
export type QuoteBlock = BlockSource & { type: 'quote'; eyebrow?: string | null; text: string; attribution: string }
export type TimelineBlock = BlockSource & { type: 'timeline'; eyebrow?: string | null; title: string; items: TimelineBlockItem[] }
export type DeckBlock = ClaimBlock | ListBlock | MetricBlock | QuoteBlock | TimelineBlock

export type Deck = {
  title: string
  tldr: string
  blocks: DeckBlock[]
  summary?: Summary
}

export type Video = {
  id: string
  channelId: string | null
  oneshot: boolean
  addedBy?: string
  title: string
  duration: number
  publishedAt: string
  addedAt: string
  youtubeId: string
  status: Status
  starred: boolean
  tags: string[]
  readingTime: number
  sourceUrl?: string
  tldr?: string
  summary: Summary
  deck?: Deck | null
  transcript?: TranscriptSnippet[]
}

export type SlideKind = 'title' | 'block' | 'closer'

export type Slide =
  | { kind: 'title'; video: Video }
  | { kind: 'block'; block: DeckBlock; video: Video }
  | { kind: 'closer'; video: Video }

export type RenderedSlide = Slide & { _idx: number; _total: number }

export type Filters = {
  q: string
  channelId: string | null
}
