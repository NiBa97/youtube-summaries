import { Btn } from './atoms'

type Props = {
  count: number
  title: string
  tagNames: string[]
  tagMode: 'all' | 'any'
  onClear?: () => void
}

export function ListToolbar({ count, title, tagNames, tagMode, onClear }: Props) {
  return (
    <div
      style={{
        padding: '12px 18px',
        borderBottom: '1px solid var(--rule)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        background: 'var(--bg)',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 500, letterSpacing: '-.01em' }}>
          {title}
        </div>
        <div
          style={{
            fontFamily: 'var(--mono)',
            fontSize: 10.5,
            color: 'var(--muted)',
            letterSpacing: '.04em',
            marginTop: 2,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {count} {count === 1 ? 'VIDEO' : 'VIDEOS'}
          {tagNames.length > 0 && ` · ${tagNames.join(tagMode === 'all' ? ' + ' : ' / ')}`}
        </div>
      </div>
      <div style={{ flex: 1 }} />
      {onClear && (
        <Btn onClick={onClear} kind="ghost" size="sm" icon="close">
          Clear
        </Btn>
      )}
    </div>
  )
}
