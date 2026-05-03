export type Status = 'unread' | 'reading' | 'read'

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
  stat?: SummaryStat
  quote?: SummaryQuote
  timeline?: SummaryTimelineItem[]
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
}

export type SlideKind = 'title' | 'keypoints' | 'stat' | 'quote' | 'timeline' | 'closer'

export type Slide =
  | { kind: 'title'; video: Video }
  | { kind: 'keypoints'; items: string[]; video: Video }
  | { kind: 'stat'; stat: SummaryStat; video: Video }
  | { kind: 'quote'; quote: SummaryQuote; video: Video }
  | { kind: 'timeline'; items: SummaryTimelineItem[]; video: Video }
  | { kind: 'closer'; video: Video }

export type RenderedSlide = Slide & { _idx: number; _total: number }

export type Filters = {
  q: string
  channelId: string | null
}
