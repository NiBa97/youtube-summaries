import type { MouseEvent, ReactNode } from 'react'
import { Icon, type IconName } from './Icon'
import type { Channel, Status } from '../types'

export function ChannelDot({ channel, size = 22 }: { channel: Channel | null; size?: number }) {
  if (!channel) {
    return (
      <div
        title="One-shot"
        style={{
          width: size,
          height: size,
          borderRadius: 4,
          background: 'repeating-linear-gradient(45deg,var(--rule),var(--rule) 2px,transparent 2px,transparent 5px)',
          border: '1px dashed var(--rule)',
          flexShrink: 0,
        }}
      />
    )
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 4,
        background: channel.color,
        color: '#fff',
        display: 'grid',
        placeItems: 'center',
        fontFamily: 'var(--mono)',
        fontSize: size * 0.5,
        fontWeight: 600,
        letterSpacing: '-.02em',
        flexShrink: 0,
      }}
    >
      {channel.name[0]}
    </div>
  )
}

export function StatusDot({ status }: { status: Status }) {
  const colors: Record<Status, string> = { unread: 'var(--accent)', reading: '#d4a82a', read: 'transparent' }
  const border: Record<Status, string> = { unread: 'transparent', reading: 'transparent', read: 'var(--rule-strong)' }
  return (
    <div
      title={status}
      style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: colors[status],
        border: `1.5px solid ${border[status]}`,
        flexShrink: 0,
      }}
    />
  )
}

type BtnProps = {
  children?: ReactNode
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void
  kind?: 'ghost' | 'primary' | 'accent' | 'outline'
  size?: 'sm' | 'md'
  icon?: IconName
  title?: string
  active?: boolean
  disabled?: boolean
}

export function Btn({ children, onClick, kind = 'ghost', size = 'md', icon, title, active, disabled }: BtnProps) {
  const base = {
    appearance: 'none' as const,
    border: 0,
    font: 'inherit',
    cursor: 'pointer',
    display: 'inline-flex' as const,
    alignItems: 'center' as const,
    gap: 6,
    padding: size === 'sm' ? '4px 8px' : '6px 12px',
    fontSize: size === 'sm' ? 12 : 13,
    borderRadius: 6,
    lineHeight: 1.2,
    fontFamily: 'var(--sans)',
    transition: 'background .12s, color .12s',
  }
  const variants = {
    ghost:   { background: active ? 'var(--surface-2)' : 'transparent', color: 'var(--ink)' },
    primary: { background: 'var(--ink)', color: 'var(--bg)' },
    accent:  { background: 'var(--accent)', color: '#fff' },
    outline: { background: 'transparent', color: 'var(--ink)', border: '1px solid var(--rule-strong)' },
  } as const
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      style={{ ...base, ...variants[kind], opacity: disabled ? 0.5 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}
      onMouseEnter={(e) => {
        if (disabled) return
        if (kind === 'ghost' && !active) e.currentTarget.style.background = 'var(--surface-2)'
      }}
      onMouseLeave={(e) => {
        if (disabled) return
        if (kind === 'ghost' && !active) e.currentTarget.style.background = 'transparent'
      }}
    >
      {icon && <Icon name={icon} size={size === 'sm' ? 12 : 14} />}
      {children}
    </button>
  )
}

export function PillTag({
  children,
  active,
  onClick,
  accent,
}: {
  children: string
  active?: boolean
  onClick?: (tag: string) => void
  accent?: boolean
}) {
  const handle = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    onClick?.(children)
  }
  return (
    <button
      onClick={handle}
      style={{
        appearance: 'none',
        border: 0,
        padding: '3px 8px',
        borderRadius: 999,
        background: active ? 'var(--accent)' : 'var(--surface-2)',
        color: active ? '#fff' : accent ? 'var(--accent)' : 'var(--ink)',
        fontFamily: 'var(--mono)',
        fontSize: 10.5,
        letterSpacing: '.02em',
        cursor: 'pointer',
        lineHeight: 1.4,
        whiteSpace: 'nowrap',
        fontWeight: 500,
        transition: 'background .12s, color .12s',
      }}
    >
      #{children}
    </button>
  )
}
