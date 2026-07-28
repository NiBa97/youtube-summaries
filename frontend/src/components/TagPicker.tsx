import { useMemo, useState } from 'react'
import type { Tag } from '../types'
import type { Classification } from '../lib/api'
import { normalizeTag } from '../lib/tags'
import { TopicDot } from './atoms'

export type PickerValue = {
  topicId: string | null
  tagNames: string[]
}

type Props = {
  tags: Tag[]
  value: PickerValue
  onChange: (v: PickerValue) => void
  /** When present, the AI's proposals are shown first and carry confidence. */
  classification?: Classification | null
  compact?: boolean
}

export function TagPicker({ tags, value, onChange, classification, compact }: Props) {
  const [draft, setDraft] = useState('')

  const topics = useMemo(
    () => tags.filter((t) => t.kind === 'topic').sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || a.name.localeCompare(b.name)),
    [tags],
  )
  const existing = useMemo(() => tags.filter((t) => t.kind === 'tag'), [tags])

  const selectedNorms = useMemo(() => new Set(value.tagNames.map(normalizeTag)), [value.tagNames])
  const confidenceByNorm = useMemo(() => {
    const map = new Map<string, { conf: number; isNew: boolean }>()
    for (const s of classification?.tags || []) map.set(normalizeTag(s.name), { conf: s.confidence, isNew: false })
    for (const s of classification?.new_tags || []) map.set(normalizeTag(s.name), { conf: s.confidence, isNew: true })
    return map
  }, [classification])

  const toggle = (name: string) => {
    const norm = normalizeTag(name)
    if (!norm) return
    onChange(
      selectedNorms.has(norm)
        ? { ...value, tagNames: value.tagNames.filter((n) => normalizeTag(n) !== norm) }
        : { ...value, tagNames: [...value.tagNames, name] },
    )
  }

  const addDraft = () => {
    const name = draft.trim()
    if (!name) return
    // Typing a name that already exists (in any casing or separator style)
    // selects that tag rather than creating a twin.
    const hit = existing.find((t) => t.norm === normalizeTag(name))
    toggle(hit ? hit.name : name.toLowerCase())
    setDraft('')
  }

  // Order: AI suggestions first (they are why this screen exists), then the rest
  // of the vocabulary, then anything typed by hand that does not exist yet.
  const rows = useMemo(() => {
    const seen = new Set<string>()
    const out: { name: string; conf?: number; isNew: boolean }[] = []
    for (const s of classification?.tags || []) {
      if (seen.has(normalizeTag(s.name))) continue
      seen.add(normalizeTag(s.name))
      out.push({ name: s.name, conf: s.confidence, isNew: false })
    }
    for (const s of classification?.new_tags || []) {
      if (seen.has(normalizeTag(s.name))) continue
      seen.add(normalizeTag(s.name))
      out.push({ name: s.name, conf: s.confidence, isNew: true })
    }
    for (const name of value.tagNames) {
      if (seen.has(normalizeTag(name))) continue
      seen.add(normalizeTag(name))
      out.push({ name, isNew: !existing.some((t) => t.norm === normalizeTag(name)) })
    }
    for (const t of existing) {
      if (seen.has(t.norm)) continue
      seen.add(t.norm)
      out.push({ name: t.name, isNew: false })
    }
    return out
  }, [classification, existing, value.tagNames])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Section label="TOPIC" hint={classification?.topic ? `suggested: ${classification.topic}` : 'one shelf per video'}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {topics.length === 0 && (
            <span style={emptyStyle}>No topics defined yet — create them in Manage tags.</span>
          )}
          {topics.map((t) => {
            const on = value.topicId === t.id
            return (
              <button
                key={t.id}
                onClick={() => onChange({ ...value, topicId: on ? null : t.id })}
                style={{
                  ...chipStyle,
                  background: on ? 'var(--ink)' : 'transparent',
                  color: on ? 'var(--bg)' : 'var(--ink)',
                  borderColor: on ? 'var(--ink)' : 'var(--rule-strong)',
                  gap: 6,
                }}
              >
                <TopicDot topic={t} size={9} />
                {t.name}
              </button>
            )
          })}
        </div>
      </Section>

      <Section
        label="TAGS"
        hint={classification ? 'ai suggestions first · new tags need a click' : `${value.tagNames.length} selected`}
      >
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 5,
            maxHeight: compact ? 120 : 220,
            overflowY: 'auto',
          }}
        >
          {rows.map((row) => {
            const norm = normalizeTag(row.name)
            const on = selectedNorms.has(norm)
            const meta = confidenceByNorm.get(norm)
            const conf = row.conf ?? meta?.conf
            const isNew = row.isNew
            return (
              <button
                key={norm}
                onClick={() => toggle(row.name)}
                title={conf !== undefined ? `confidence ${(conf * 100).toFixed(0)}%` : undefined}
                style={{
                  ...chipStyle,
                  background: on ? 'var(--accent)' : 'transparent',
                  color: on ? '#fff' : isNew ? 'var(--accent)' : 'var(--ink)',
                  borderColor: on ? 'var(--accent)' : isNew ? 'var(--accent)' : 'var(--rule)',
                  borderStyle: isNew ? 'dashed' : 'solid',
                  gap: 5,
                }}
              >
                {row.name}
                {isNew && <span style={{ opacity: 0.75, fontSize: 9 }}>NEW</span>}
                {conf !== undefined && (
                  <span style={{ opacity: 0.6, fontVariantNumeric: 'tabular-nums' }}>{Math.round(conf * 100)}</span>
                )}
              </button>
            )
          })}
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addDraft()
              }
            }}
            placeholder="Add a tag…"
            style={{
              flex: 1,
              padding: '6px 9px',
              background: 'var(--bg)',
              border: '1px solid var(--rule-strong)',
              borderRadius: 6,
              outline: 'none',
              fontFamily: 'var(--mono)',
              fontSize: 11.5,
              color: 'var(--ink)',
            }}
          />
        </div>
      </Section>
    </div>
  )
}

function Section({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 8,
          marginBottom: 6,
          fontFamily: 'var(--mono)',
          fontSize: 10,
          letterSpacing: '.1em',
          color: 'var(--muted)',
        }}
      >
        {label}
        {hint && <span style={{ letterSpacing: 0, textTransform: 'none', opacity: 0.8 }}>{hint}</span>}
      </div>
      {children}
    </div>
  )
}

const chipStyle: React.CSSProperties = {
  appearance: 'none',
  borderWidth: 1,
  borderStyle: 'solid',
  borderRadius: 999,
  padding: '3px 9px',
  cursor: 'pointer',
  fontFamily: 'var(--mono)',
  fontSize: 10.5,
  lineHeight: 1.5,
  display: 'inline-flex',
  alignItems: 'center',
}

const emptyStyle: React.CSSProperties = {
  fontFamily: 'var(--sans)',
  fontSize: 12,
  color: 'var(--muted)',
}
