import { useMemo } from 'react'
import type { Channel, Filters, Video } from '../types'
import { Icon } from './Icon'
import { ChannelDot, Btn } from './atoms'

type Props = {
  channels: Channel[]
  videos: Video[]
  filters: Filters
  setFilters: (f: Filters | ((prev: Filters) => Filters)) => void
  onAddVideo: () => void
}

export function FilterRail({ channels, videos, filters, setFilters, onAddVideo }: Props) {
  const channelCounts = useMemo(() => {
    const map: Record<string, number> = {}
    videos.forEach((v) => {
      if (v.channelId) map[v.channelId] = (map[v.channelId] || 0) + 1
    })
    return map
  }, [videos])

  const setChannel = (id: string) =>
    setFilters((f) => ({ ...f, channelId: f.channelId === id ? null : id }))

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg)',
        borderRight: '1px solid var(--rule)',
      }}
    >
      <div style={{ padding: '18px 18px 14px', borderBottom: '1px solid var(--rule)' }}>
        <div
          style={{
            fontFamily: 'var(--serif)',
            fontSize: 18,
            fontWeight: 500,
            letterSpacing: '-.01em',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <div
            style={{
              width: 22,
              height: 22,
              borderRadius: 5,
              background: 'var(--accent)',
              display: 'grid',
              placeItems: 'center',
              color: '#fff',
              fontFamily: 'var(--mono)',
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            R
          </div>
          Reel Notes
        </div>
        <div
          style={{
            marginTop: 4,
            fontFamily: 'var(--mono)',
            fontSize: 10.5,
            color: 'var(--muted)',
            letterSpacing: '.06em',
          }}
        >
          PERSONAL VIDEO DIGEST
        </div>
      </div>

      <div style={{ padding: '14px 14px 8px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '7px 10px',
            background: 'var(--surface-2)',
            borderRadius: 7,
            border: '1px solid transparent',
          }}
        >
          <Icon name="search" size={13} color="var(--muted)" />
          <input
            value={filters.q}
            onChange={(e) => setFilters({ ...filters, q: e.target.value })}
            placeholder="Search summaries…"
            style={{
              flex: 1,
              border: 0,
              background: 'transparent',
              outline: 'none',
              font: 'inherit',
              fontFamily: 'var(--sans)',
              fontSize: 12.5,
              color: 'var(--ink)',
              minWidth: 0,
            }}
          />
        </div>
      </div>

      <div
        style={{
          padding: '14px 18px 6px',
          fontFamily: 'var(--mono)',
          fontSize: 10,
          color: 'var(--muted)',
          letterSpacing: '.1em',
        }}
      >
        SUBSCRIPTIONS
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 10px 10px' }}>
        {channels.map((c) => {
          const count = channelCounts[c.id] || 0
          const isActive = filters.channelId === c.id
          return (
            <div
              key={c.id}
              onClick={() => setChannel(c.id)}
              style={{
                padding: '5px 8px',
                borderRadius: 6,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 9,
                background: isActive ? 'var(--surface-2)' : 'transparent',
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.background = 'var(--surface-hover)'
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.background = 'transparent'
              }}
            >
              <ChannelDot channel={c} size={16} />
              <span
                style={{
                  flex: 1,
                  fontFamily: 'var(--sans)',
                  fontSize: 12.5,
                  color: 'var(--ink)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {c.name}
              </span>
              <span
                style={{
                  fontFamily: 'var(--mono)',
                  fontSize: 10.5,
                  color: 'var(--muted)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {count || ''}
              </span>
            </div>
          )
        })}
      </div>

      <div style={{ padding: 12, borderTop: '1px solid var(--rule)' }}>
        <Btn icon="plus" onClick={onAddVideo} kind="outline">
          Add video
        </Btn>
      </div>
    </div>
  )
}
