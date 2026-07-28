import { type MouseEvent } from 'react'
import type { Tag, Video } from '../types'
import { PillTag, StatusDot, TopicDot } from './atoms'
import { VideoThumb } from './VideoThumb'
import { fmtRelative } from '../lib/format'

type Props = {
  videos: Video[]
  tagById: Map<string, Tag>
  selectedId: string | null
  onSelect: (id: string) => void
  onToggleStar: (id: string) => void
}

export function VideoList({ videos, tagById, selectedId, onSelect, onToggleStar }: Props) {
  if (videos.length === 0) {
    return (
      <div
        style={{
          padding: '60px 24px',
          color: 'var(--muted)',
          textAlign: 'center',
          fontFamily: 'var(--sans)',
          fontSize: 13,
        }}
      >
        No videos yet. Add one with the button below.
      </div>
    )
  }

  return (
    <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
      {videos.map((v) => (
        <RowItem
          key={v.id}
          v={v}
          topic={(v.topicId && tagById.get(v.topicId)) || null}
          isSelected={v.id === selectedId}
          onSelect={onSelect}
          onToggleStar={onToggleStar}
        />
      ))}
    </div>
  )
}

type ItemProps = {
  v: Video
  topic: Tag | null
  isSelected: boolean
  onSelect: (id: string) => void
  onToggleStar: (id: string) => void
}

function StarBtn({ v, onToggleStar }: { v: Video; onToggleStar: (id: string) => void }) {
  const stop = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    onToggleStar(v.id)
  }
  return (
    <button
      onClick={stop}
      style={{
        appearance: 'none',
        border: 0,
        background: 'transparent',
        cursor: 'pointer',
        padding: 4,
        color: v.starred ? 'var(--accent)' : 'var(--muted)',
        opacity: v.starred ? 1 : 0.55,
      }}
      title={v.starred ? 'Unstar' : 'Star'}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill={v.starred ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
        <path d="m12 3 2.6 5.5 6 .9-4.3 4.2 1 6L12 16.8 6.7 19.6l1-6L3.4 9.4l6-.9L12 3Z" />
      </svg>
    </button>
  )
}

function RowItem({ v, topic, isSelected, onSelect, onToggleStar }: ItemProps) {
  const thumbW = 116
  const thumbH = Math.round((thumbW * 9) / 16)
  return (
    <div
      onClick={() => onSelect(v.id)}
      style={{
        padding: '12px 12px',
        borderRadius: 8,
        cursor: 'pointer',
        background: isSelected ? 'var(--surface-2)' : 'transparent',
        display: 'grid',
        gridTemplateColumns: `8px ${thumbW}px 1fr auto`,
        gap: 12,
        alignItems: 'flex-start',
        borderLeft: isSelected ? '2px solid var(--accent)' : '2px solid transparent',
        transition: 'background .1s',
      }}
      onMouseEnter={(e) => {
        if (!isSelected) e.currentTarget.style.background = 'var(--surface-hover)'
      }}
      onMouseLeave={(e) => {
        if (!isSelected) e.currentTarget.style.background = 'transparent'
      }}
    >
      <div style={{ paddingTop: 6 }}>
        <StatusDot status={v.status} />
      </div>
      <VideoThumb video={v} tint={topic?.color} width={thumbW} height={thumbH} />
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 8,
            fontFamily: 'var(--mono)',
            fontSize: 10.5,
            color: 'var(--muted)',
            letterSpacing: '.04em',
            marginBottom: 4,
            textTransform: 'uppercase',
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0, overflow: 'hidden' }}>
            <TopicDot topic={topic} size={10} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {topic ? topic.name : 'unfiled'}
            </span>
          </span>
          <span>{fmtRelative(v.publishedAt)}</span>
        </div>
        <div
          style={{
            fontFamily: 'var(--serif)',
            fontSize: 15.5,
            lineHeight: 1.3,
            color: 'var(--ink)',
            fontWeight: v.status === 'unread' ? 500 : 400,
            textWrap: 'pretty',
            marginBottom: 6,
          }}
        >
          {v.title}
        </div>
        {v.tldr && (
          <div
            style={{
              fontFamily: 'var(--serif)',
              fontSize: 13,
              lineHeight: 1.4,
              color: 'var(--muted)',
              marginBottom: 8,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {v.tldr}
          </div>
        )}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          {(v.tags || []).slice(0, 4).map((t) => (
            <PillTag key={t}>{t}</PillTag>
          ))}
          <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--muted)', marginLeft: 'auto' }}>{v.readingTime}min read</span>
        </div>
      </div>
      <StarBtn v={v} onToggleStar={onToggleStar} />
    </div>
  )
}
