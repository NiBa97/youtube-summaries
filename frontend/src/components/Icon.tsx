import type { CSSProperties, ReactElement } from 'react'

type IconName =
  | 'search' | 'plus' | 'settings' | 'star' | 'play' | 'arrowRight' | 'arrowLeft'
  | 'close' | 'expand' | 'collapse' | 'check' | 'eye' | 'eyeOff' | 'annotate'
  | 'tag' | 'rss' | 'grid' | 'list' | 'minimal' | 'home' | 'pause' | 'sliders'
  | 'edit' | 'download' | 'inbox'

const PATHS: Record<IconName, ReactElement> = {
  search: <path d="M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14ZM21 21l-5-5" />,
  plus: <path d="M12 5v14M5 12h14" />,
  settings: <path d="M12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Zm9-1l-2-1-1-2 1-2-2-2-2 1-2-1-1-2h-3l-1 2-2 1-2-1-2 2 1 2-1 2-2 1v3l2 1 1 2-1 2 2 2 2-1 2 1 1 2h3l1-2 2-1 2 1 2-2-1-2 1-2 2-1v-3Z" />,
  star: <path d="m12 3 2.6 5.5 6 .9-4.3 4.2 1 6L12 16.8 6.7 19.6l1-6L3.4 9.4l6-.9L12 3Z" />,
  play: <path d="M6 4l14 8L6 20V4Z" />,
  arrowRight: <path d="M5 12h14M13 5l7 7-7 7" />,
  arrowLeft: <path d="M19 12H5M11 5l-7 7 7 7" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  expand: <path d="M4 9V4h5M20 15v5h-5M15 4h5v5M9 20H4v-5" />,
  collapse: <path d="M9 4v5H4M15 20v-5h5M20 9h-5V4M4 15h5v5" />,
  check: <path d="m4 12 5 5L20 6" />,
  eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></>,
  eyeOff: <path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.1A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a17.7 17.7 0 0 1-3.4 4.5M6.6 6.6C3.7 8.3 2 12 2 12s3.5 7 10 7c1.7 0 3.2-.4 4.5-1" />,
  annotate: <path d="M12 4l8 8-8 8H4v-8l8-8Z" />,
  tag: <path d="M3 12V4h8l10 10-8 8L3 12Zm5-5a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z" />,
  rss: <path d="M4 11a9 9 0 0 1 9 9M4 4a16 16 0 0 1 16 16M5 19a1 1 0 1 0 2 0 1 1 0 0 0-2 0Z" />,
  grid: <path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z" />,
  list: <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />,
  minimal: <path d="M3 8h18M3 16h18" />,
  home: <path d="M3 11l9-8 9 8v9a2 2 0 0 1-2 2h-4v-7H9v7H5a2 2 0 0 1-2-2v-9Z" />,
  pause: <path d="M6 4h4v16H6zM14 4h4v16h-4z" />,
  sliders: <path d="M4 6h11M19 6h1M4 12h5M13 12h7M4 18h13M21 18h-1M15 4v4M9 10v4M17 16v4" />,
  edit: <path d="m4 20 4-1 11-11-3-3L5 16l-1 4Z" />,
  download: <path d="M12 4v12m0 0l-5-5m5 5l5-5M4 20h16" />,
  inbox: <><path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z" /></>,
}

type IconProps = {
  name: IconName
  size?: number
  color?: string
  strokeWidth?: number
  style?: CSSProperties
}

export function Icon({ name, size = 16, color = 'currentColor', strokeWidth = 1.5, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: 'block', flexShrink: 0, ...style }}
    >
      {PATHS[name]}
    </svg>
  )
}

export type { IconName }
