type Props = {
  count: number
}

export function ListToolbar({ count }: Props) {
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
      <div>
        <div style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 500, letterSpacing: '-.01em' }}>
          All videos
        </div>
        <div
          style={{
            fontFamily: 'var(--mono)',
            fontSize: 10.5,
            color: 'var(--muted)',
            letterSpacing: '.04em',
            marginTop: 2,
          }}
        >
          {count} {count === 1 ? 'VIDEO' : 'VIDEOS'}
        </div>
      </div>
    </div>
  )
}
