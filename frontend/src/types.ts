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
type BlockSource = { source_start?: number | null; links?: BlockLink[] | null; caveat?: string | null }
export type ClaimBlock = BlockSource & { type: 'claim'; eyebrow?: string | null; title: string; body: string }
export type ListBlock = BlockSource & { type: 'list'; eyebrow?: string | null; title: string; items: string[] }
export type MetricBlock = BlockSource & { type: 'metric'; eyebrow?: string | null; value: string; label: string; body?: string | null }
export type QuoteBlock = BlockSource & { type: 'quote'; eyebrow?: string | null; text: string; attribution: string }
export type TimelineBlock = BlockSource & { type: 'timeline'; eyebrow?: string | null; title: string; items: TimelineBlockItem[] }
export type DeckBlock = ClaimBlock | ListBlock | MetricBlock | QuoteBlock | TimelineBlock

/** What the comment section adds, when it adds anything. Not a block type: it
 *  renders as one section after the blocks. */
export type CommunitySentiment = 'supportive' | 'mixed' | 'critical'
export type CommunityNote = { text: string; quote?: string | null }
export type Community = {
  sentiment: CommunitySentiment
  summary: string
  notes?: CommunityNote[]
}

export type Deck = {
  title: string
  tldr: string
  blocks: DeckBlock[]
  community?: Community | null
  summary?: Summary
}

/** Both tiers of the library vocabulary live in one collection, discriminated
 *  by `kind`, so promoting a tag to a Topic is a flag flip, not a data move. */
export type TagKind = 'topic' | 'tag'

export type Tag = {
  id: string
  name: string
  norm: string
  kind: TagKind
  color?: string
  sort?: number
}

/** tag record id -> who attached it. A bad auto-tagging run is one filter away
 *  from being reverted wholesale. */
export type TagSource = Record<string, 'ai' | 'human'>

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
  topicId: string | null
  tagIds: string[]
  tags: string[]
  tagSource: TagSource
  readingTime: number
  sourceUrl?: string
  tldr?: string
  /** The custom directive the deck was generated with, so a re-run can start
   *  from it instead of from a blank box. */
  instructions?: string
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
  topicId: string | null
  tagIds: string[]
  /** How multiple selected tags combine. 'all' narrows, 'any' widens. */
  tagMode: 'all' | 'any'
  unreadOnly: boolean
  starredOnly: boolean
}
