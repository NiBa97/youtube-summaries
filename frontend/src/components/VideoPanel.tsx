import type { Video } from '../types'

type Props = {
  video: Video | null
  start?: number | null
}

export function VideoPanel({ video, start = null }: Props) {
  if (!video) {
    return (
      <div
        style={{
          height: '100%',
          display: 'grid',
          placeItems: 'center',
          color: 'var(--muted)',
          fontFamily: 'var(--serif)',
          fontSize: 14,
          background: 'var(--bg)',
          padding: 24,
          textAlign: 'center',
        }}
      >
        No video selected
      </div>
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '14px 22px',
          borderBottom: '1px solid var(--rule)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          background: 'var(--bg)',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--muted)', letterSpacing: '.1em' }}>
            NOW PLAYING
          </div>
          <div
            style={{
              fontFamily: 'var(--serif)',
              fontSize: 14,
              marginTop: 2,
              color: 'var(--ink)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {video.title}
          </div>
        </div>
      </div>
      <div style={{ flex: 1, padding: '14px 22px', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <div
          style={{
            position: 'relative',
            background: '#000',
            borderRadius: 8,
            overflow: 'hidden',
            flex: 1,
            minHeight: 0,
          }}
        >
          <iframe
            key={`${video.id}-${start ?? 'start'}`}
            src={`https://www.youtube.com/embed/${video.youtubeId}?rel=0&modestbranding=1${start !== null ? `&start=${Math.floor(start)}&autoplay=1` : ''}`}
            title={video.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
          />
        </div>
      </div>
    </div>
  )
}
