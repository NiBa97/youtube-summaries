import { useMemo, useState } from 'react'
import type { Tag, Video } from '../types'
import { Icon } from './Icon'
import { Btn, TopicDot } from './atoms'
import { mergeTagInto } from '../lib/pb'
import { TOPIC_COLORS, createTag, deleteTag, normalizeTag, renameTag, setTagColor, setTagKind } from '../lib/tags'

type Props = {
  onClose: () => void
  tags: Tag[]
  videos: Video[]
  onChanged: () => Promise<void> | void
}

/**
 * Vocabulary hygiene. Without this the tag list only ever grows, and a growing
 * tag list is the failure mode that turns tagging back into the one-long-list
 * problem it was meant to solve.
 *
 * Promotion is a `kind` flip, not a migration - a tag that has quietly become
 * one of your main subjects moves up to the Topic tier in place, keeping every
 * video already attached to it.
 */
export function TagManagerDialog({ onClose, tags, videos, onChanged }: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')
  const [mergingId, setMergingId] = useState<string | null>(null)
  const [newTopic, setNewTopic] = useState('')

  const counts = useMemo(() => {
    const map: Record<string, number> = {}
    for (const v of videos) {
      if (v.topicId) map[v.topicId] = (map[v.topicId] || 0) + 1
      for (const id of v.tagIds) map[id] = (map[id] || 0) + 1
    }
    return map
  }, [videos])

  const topics = useMemo(
    () => tags.filter((t) => t.kind === 'topic').sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || a.name.localeCompare(b.name)),
    [tags],
  )
  const plain = useMemo(
    () => tags.filter((t) => t.kind === 'tag').sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0) || a.name.localeCompare(b.name)),
    [tags, counts],
  )
  const orphans = useMemo(() => tags.filter((t) => t.kind === 'tag' && !counts[t.id]), [tags, counts])

  const run = async (fn: () => Promise<void>) => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await fn()
      await onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Operation failed')
    } finally {
      setBusy(false)
    }
  }

  const commitRename = (tag: Tag) => {
    const name = draftName.trim()
    setEditingId(null)
    if (!name || name === tag.name) return
    const clash = tags.find((t) => t.id !== tag.id && t.norm === normalizeTag(name))
    if (clash) {
      setError(`"${name}" already exists as "${clash.name}". Merge into it instead of renaming.`)
      return
    }
    void run(async () => {
      await renameTag(tag.id, name)
    })
  }

  const addTopic = () => {
    const name = newTopic.trim()
    if (!name) return
    if (tags.some((t) => t.norm === normalizeTag(name))) {
      setError(`"${name}" already exists. Promote the existing tag instead.`)
      return
    }
    setNewTopic('')
    void run(async () => {
      await createTag({ name, kind: 'topic', color: TOPIC_COLORS[topics.length % TOPIC_COLORS.length], sort: topics.length })
    })
  }

  const remove = (tag: Tag) => {
    const n = counts[tag.id] || 0
    const warning =
      n > 0
        ? `Delete "${tag.name}"? It is still on ${n} video${n === 1 ? '' : 's'} and will be removed from ${n === 1 ? 'it' : 'them'}. This cannot be undone.`
        : `Delete unused tag "${tag.name}"? This cannot be undone.`
    if (!window.confirm(warning)) return
    void run(async () => {
      await deleteTag(tag.id)
    })
  }

  const merge = (from: Tag, intoId: string) => {
    const into = tags.find((t) => t.id === intoId)
    setMergingId(null)
    if (!into) return
    if (!window.confirm(`Merge "${from.name}" into "${into.name}"? Every video tagged "${from.name}" gets "${into.name}", and "${from.name}" is deleted.`)) return
    void run(async () => {
      await mergeTagInto(from.id, into.id)
    })
  }

  const pruneOrphans = () => {
    if (orphans.length === 0) return
    if (!window.confirm(`Delete ${orphans.length} unused tag${orphans.length === 1 ? '' : 's'}? This cannot be undone.`)) return
    void run(async () => {
      for (const t of orphans) await deleteTag(t.id)
    })
  }

  const row = (tag: Tag) => {
    const n = counts[tag.id] || 0
    const isTopic = tag.kind === 'topic'
    return (
      <div key={tag.id} style={rowStyle}>
        {isTopic ? (
          <input
            type="color"
            value={tag.color || TOPIC_COLORS[0]}
            onChange={(e) => void run(async () => { await setTagColor(tag.id, e.target.value) })}
            title="Topic colour"
            style={{ width: 16, height: 16, padding: 0, border: 0, background: 'transparent', cursor: 'pointer' }}
          />
        ) : (
          <TopicDot topic={null} size={13} />
        )}

        {editingId === tag.id ? (
          <input
            autoFocus
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onBlur={() => commitRename(tag)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename(tag)
              if (e.key === 'Escape') setEditingId(null)
            }}
            style={{ ...nameStyle, border: '1px solid var(--rule-strong)', borderRadius: 5, padding: '2px 6px', background: 'var(--bg)', outline: 'none' }}
          />
        ) : (
          <span style={nameStyle}>{tag.name}</span>
        )}

        {mergingId === tag.id ? (
          <select
            autoFocus
            defaultValue=""
            onChange={(e) => e.target.value && merge(tag, e.target.value)}
            onBlur={() => setMergingId(null)}
            style={{ fontFamily: 'var(--mono)', fontSize: 11, padding: '2px 4px', maxWidth: 160 }}
          >
            <option value="">merge into…</option>
            {tags
              .filter((t) => t.id !== tag.id && t.kind === tag.kind)
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
          </select>
        ) : (
          <>
            <span style={countStyle}>{n}</span>
            <IconBtn
              title="Rename"
              icon="edit"
              onClick={() => {
                setDraftName(tag.name)
                setEditingId(tag.id)
              }}
            />
            <IconBtn title="Merge into another" icon="collapse" onClick={() => setMergingId(tag.id)} />
            <IconBtn
              title={isTopic ? 'Demote to tag' : 'Promote to topic'}
              icon={isTopic ? 'download' : 'star'}
              onClick={() =>
                void run(async () => {
                  await setTagKind(tag.id, isTopic ? 'tag' : 'topic', TOPIC_COLORS[topics.length % TOPIC_COLORS.length])
                })
              }
            />
            <IconBtn title="Delete" icon="close" onClick={() => remove(tag)} />
          </>
        )}
      </div>
    )
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(20,15,8,.45)',
        backdropFilter: 'blur(2px)',
        display: 'grid',
        placeItems: 'center',
        zIndex: 100,
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 560,
          maxHeight: '86vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--surface)',
          color: 'var(--ink)',
          borderRadius: 12,
          boxShadow: '0 24px 64px rgba(0,0,0,.25)',
          border: '1px solid var(--rule)',
          overflow: 'hidden',
          fontFamily: 'var(--sans)',
        }}
      >
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--rule)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              background: 'var(--surface-2)',
              display: 'grid',
              placeItems: 'center',
              color: 'var(--accent)',
            }}
          >
            <Icon name="tag" size={14} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 16, fontWeight: 500 }}>Manage tags</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--muted)', letterSpacing: '.06em' }}>
              {topics.length} TOPICS · {plain.length} TAGS
            </div>
          </div>
          <button onClick={onClose} title="Close" style={{ appearance: 'none', border: 0, background: 'transparent', cursor: 'pointer', color: 'var(--muted)', padding: 4 }}>
            <Icon name="close" size={14} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 20px' }}>
          <Label>TOPICS — the shelves. One per video.</Label>
          {topics.map(row)}
          <div style={{ display: 'flex', gap: 6, margin: '8px 0 4px' }}>
            <input
              value={newTopic}
              onChange={(e) => setNewTopic(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') addTopic()
              }}
              placeholder="New topic…"
              style={{
                flex: 1,
                padding: '6px 9px',
                background: 'var(--bg)',
                border: '1px solid var(--rule-strong)',
                borderRadius: 6,
                outline: 'none',
                fontFamily: 'var(--sans)',
                fontSize: 12.5,
                color: 'var(--ink)',
              }}
            />
            <Btn onClick={addTopic} kind="outline" size="sm" icon="plus">
              Add
            </Btn>
          </div>

          <Label>TAGS — the facets. Many per video.</Label>
          {plain.length === 0 && <div style={{ fontSize: 12, color: 'var(--muted)', padding: '2px 0 6px' }}>No tags yet.</div>}
          {plain.map(row)}
        </div>

        {error && (
          <div style={{ padding: '8px 20px', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--accent)', background: 'rgba(168,90,42,.08)' }}>
            {error}
          </div>
        )}

        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--rule)', display: 'flex', gap: 8, alignItems: 'center', background: 'var(--bg)' }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--muted)' }}>
            {busy ? 'working…' : `${orphans.length} unused`}
          </span>
          <div style={{ flex: 1 }} />
          {orphans.length > 0 && (
            <Btn onClick={pruneOrphans} kind="ghost" size="sm">
              Prune unused
            </Btn>
          )}
          <Btn onClick={onClose} kind="outline" size="sm">
            Done
          </Btn>
        </div>
      </div>
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '.08em', color: 'var(--muted)', margin: '10px 0 6px' }}>
      {children}
    </div>
  )
}

function IconBtn({ title, icon, onClick }: { title: string; icon: 'edit' | 'collapse' | 'star' | 'download' | 'close'; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{ appearance: 'none', border: 0, background: 'transparent', cursor: 'pointer', color: 'var(--muted)', padding: 3, borderRadius: 4, lineHeight: 0 }}
      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--ink)')}
      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--muted)')}
    >
      <Icon name={icon} size={12} />
    </button>
  )
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '4px 2px',
  borderBottom: '1px solid var(--rule)',
}

const nameStyle: React.CSSProperties = {
  flex: 1,
  fontFamily: 'var(--sans)',
  fontSize: 12.5,
  color: 'var(--ink)',
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const countStyle: React.CSSProperties = {
  fontFamily: 'var(--mono)',
  fontSize: 10.5,
  color: 'var(--muted)',
  fontVariantNumeric: 'tabular-nums',
  minWidth: 18,
  textAlign: 'right',
}
