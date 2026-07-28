import { useEffect, useMemo, useState } from 'react'
import type { ReactElement } from 'react'
import type { Video } from '../types'

type Props = {
  video: Video
  /** Topic colour, used for the generated placeholder when no thumbnail loads. */
  tint?: string
  width?: number | string
  height?: number
  rounded?: number
}

function youtubeThumbnailSources(videoId: string): string[] {
  if (!videoId) return []
  const encoded = encodeURIComponent(videoId)
  return [
    `https://i.ytimg.com/vi/${encoded}/maxresdefault.jpg`,
    `https://i.ytimg.com/vi/${encoded}/sddefault.jpg`,
    `https://i.ytimg.com/vi/${encoded}/hqdefault.jpg`,
    `https://i.ytimg.com/vi/${encoded}/mqdefault.jpg`,
  ]
}

export function VideoThumb({ video, tint, width = 96, height = 54, rounded = 6 }: Props) {
  const [thumbIndex, setThumbIndex] = useState(0)
  const thumbnailSources = useMemo(() => youtubeThumbnailSources(video.youtubeId), [video.youtubeId])
  const thumbnailSrc = thumbnailSources[thumbIndex]

  useEffect(() => {
    setThumbIndex(0)
  }, [video.youtubeId])

  const seed = useMemo(() => {
    let h = 0
    for (const c of video.id + video.title) h = (h * 31 + c.charCodeAt(0)) | 0
    return Math.abs(h)
  }, [video.id, video.title])
  const baseColor = tint || '#7a6f5e'
  const variant = seed % 5

  let composition: ReactElement
  if (variant === 0) {
    composition = (
      <>
        <rect width="100%" height="100%" fill={baseColor} />
        {[0, 1, 2, 3].map((i) => (
          <circle key={i} cx="20%" cy="80%" r={`${30 + i * 18}%`} fill="none" stroke="rgba(255,255,255,.18)" strokeWidth="2" />
        ))}
      </>
    )
  } else if (variant === 1) {
    composition = (
      <>
        <rect width="100%" height="100%" fill={baseColor} />
        <g opacity=".22">
          {Array.from({ length: 8 }).map((_, i) => (
            <rect key={i} x={`${-20 + i * 18}%`} y="-20%" width="6%" height="140%" fill="#fff" transform="rotate(20 50 50)" />
          ))}
        </g>
        <circle cx="78%" cy="30%" r="14%" fill="rgba(255,255,255,.35)" />
      </>
    )
  } else if (variant === 2) {
    composition = (
      <>
        <rect width="100%" height="100%" fill={baseColor} />
        {Array.from({ length: 5 * 3 }).map((_, i) => {
          const r = i % 5
          const c = Math.floor(i / 5)
          const opacity = ((seed >> i) & 3) * 0.12 + 0.05
          return <rect key={i} x={`${r * 20}%`} y={`${c * 33.3}%`} width="20%" height="33.3%" fill="#fff" opacity={opacity} />
        })}
      </>
    )
  } else if (variant === 3) {
    composition = (
      <>
        <rect width="100%" height="100%" fill={baseColor} />
        <text x="50%" y="62%" textAnchor="middle" fontFamily="Source Serif 4, Georgia, serif" fontSize="68" fontWeight="500" fill="rgba(255,255,255,.18)">
          {video.title[0]}
        </text>
      </>
    )
  } else {
    composition = (
      <>
        <rect width="100%" height="100%" fill={baseColor} />
        {[0, 1, 2, 3, 4].map((i) => (
          <path
            key={i}
            d={`M -10 ${30 + i * 18} Q 30 ${10 + i * 18 + ((seed >> i) & 7) * 2} 60 ${40 + i * 18 - ((seed >> (i + 2)) & 7) * 2} T 110 ${30 + i * 18}`}
            fill="none"
            stroke="rgba(255,255,255,.22)"
            strokeWidth="1.2"
          />
        ))}
      </>
    )
  }

  const dur = (() => {
    const m = Math.floor(video.duration / 60)
    const s = video.duration % 60
    if (video.duration >= 3600) {
      const h = Math.floor(video.duration / 3600)
      const mm = Math.floor((video.duration % 3600) / 60)
      return `${h}:${String(mm).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    }
    return `${m}:${String(s).padStart(2, '0')}`
  })()

  return (
    <div
      style={{
        position: 'relative',
        width,
        height,
        borderRadius: rounded,
        overflow: 'hidden',
        flexShrink: 0,
        background: baseColor,
        boxShadow: '0 0 0 1px rgba(0,0,0,.08) inset',
      }}
    >
      {thumbnailSrc ? (
        <img
          src={thumbnailSrc}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setThumbIndex((idx) => idx + 1)}
          style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <svg viewBox="0 0 100 56" preserveAspectRatio="none" width="100%" height="100%" style={{ display: 'block' }}>
          {composition}
        </svg>
      )}
      <div
        style={{
          position: 'absolute',
          bottom: 4,
          right: 4,
          background: 'rgba(0,0,0,.65)',
          color: '#fff',
          fontFamily: 'var(--mono)',
          fontSize: Math.max(8, height * 0.16),
          padding: '1px 5px',
          borderRadius: 3,
          lineHeight: 1.2,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {dur}
      </div>
      {video.oneshot && (
        <div
          style={{
            position: 'absolute',
            top: 4,
            left: 4,
            background: 'var(--accent)',
            color: '#fff',
            fontFamily: 'var(--mono)',
            fontSize: 8,
            letterSpacing: '.06em',
            padding: '1px 4px',
            borderRadius: 2,
            fontWeight: 600,
          }}
        >
          1·SHOT
        </div>
      )}
    </div>
  )
}
