import { useMemo } from 'react'
import type { Filters, Tag, Video } from '../types'
import { Icon, type IconName } from './Icon'

type Props = {
  tags: Tag[]
  videos: Video[]
  filters: Filters
  setFilters: (f: Filters | ((prev: Filters) => Filters)) => void
  onAddVideo: () => void
  onManageTags: () => void
}

/** Pseudo-topic id for videos with no topic, so "Unfiled" is a first-class
 *  shelf instead of an invisible remainder. */
export const UNFILED = '__unfiled__'

/**
 * Two-tier rail. Topics are the shelves - exactly one per video, always visible.
 * Tags are the facets, and they are scoped to whichever Topic is active: with a
 * Topic selected you only see the tags that actually occur inside it, which is
 * what keeps a long tag list from turning back into the one-long-list problem.
 *
 * Styling lives in index.css under `.fr-*` because the hover states need real
 * CSS rather than the inline styles the rest of the app uses.
 */
export function FilterRail({ tags, videos, filters, setFilters, onAddVideo, onManageTags }: Props) {
  const topics = useMemo(
    () => tags.filter((t) => t.kind === 'topic').sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || a.name.localeCompare(b.name)),
    [tags],
  )
  const tagById = useMemo(() => new Map(tags.map((t) => [t.id, t])), [tags])

  const topicCounts = useMemo(() => {
    const map: Record<string, number> = {}
    for (const v of videos) map[v.topicId || UNFILED] = (map[v.topicId || UNFILED] || 0) + 1
    return map
  }, [videos])

  // Tag counts are computed over the videos the Topic filter already admits, so
  // the number next to a tag is the number of rows a click will actually leave.
  const scopedTagCounts = useMemo(() => {
    const inScope = filters.topicId
      ? videos.filter((v) => (filters.topicId === UNFILED ? !v.topicId : v.topicId === filters.topicId))
      : videos
    const map: Record<string, number> = {}
    for (const v of inScope) for (const id of v.tagIds) map[id] = (map[id] || 0) + 1
    return map
  }, [videos, filters.topicId])

  const scopedTags = useMemo(() => {
    const entries = Object.entries(scopedTagCounts)
      .map(([id, count]) => ({ tag: tagById.get(id), count }))
      .filter((e): e is { tag: Tag; count: number } => !!e.tag && e.tag.kind === 'tag')
    // Selected tags stay pinned even when the scope drops their count to zero,
    // otherwise deselecting them becomes impossible.
    for (const id of filters.tagIds) {
      if (!scopedTagCounts[id]) {
        const t = tagById.get(id)
        if (t) entries.push({ tag: t, count: 0 })
      }
    }
    return entries.sort((a, b) => b.count - a.count || a.tag.name.localeCompare(b.tag.name))
  }, [scopedTagCounts, tagById, filters.tagIds])

  const unreadCount = videos.filter((v) => v.status === 'unread').length
  const starredCount = videos.filter((v) => v.starred).length
  const unfiledCount = topicCounts[UNFILED] || 0

  const setTopic = (id: string) =>
    setFilters((f) => (f.topicId === id ? { ...f, topicId: null, tagIds: [] } : { ...f, topicId: id, tagIds: [] }))

  const toggleTag = (id: string) =>
    setFilters((f) => ({
      ...f,
      tagIds: f.tagIds.includes(id) ? f.tagIds.filter((t) => t !== id) : [...f.tagIds, id],
    }))

  const clearAll = () =>
    setFilters((f) => ({ ...f, topicId: null, tagIds: [], unreadOnly: false, starredOnly: false }))

  const hasFilter = !!filters.topicId || filters.tagIds.length > 0 || filters.unreadOnly || filters.starredOnly

  return (
    <div className="fr">
      <div className="fr-header">
        <div className="fr-brand">
          <div className="fr-logo">R</div>
          <div style={{ minWidth: 0 }}>
            <div className="fr-brand-name">Reel Notes</div>
            <div className="fr-brand-sub">PERSONAL VIDEO DIGEST</div>
          </div>
        </div>

        <div className="fr-search">
          <Icon name="search" size={16} />
          <input
            value={filters.q}
            onChange={(e) => setFilters({ ...filters, q: e.target.value })}
            placeholder="Search summaries…"
          />
        </div>

        <div className="fr-lenses">
          <Lens label="All" count={videos.length} active={!hasFilter} onClick={clearAll} />
          <Lens
            label="Unread"
            icon="eye"
            count={unreadCount}
            active={filters.unreadOnly}
            onClick={() => setFilters((f) => ({ ...f, unreadOnly: !f.unreadOnly }))}
          />
          <Lens
            label="Starred"
            icon="star"
            count={starredCount}
            active={filters.starredOnly}
            onClick={() => setFilters((f) => ({ ...f, starredOnly: !f.starredOnly }))}
          />
        </div>
      </div>

      <div className="fr-scroll">
        <div className="fr-section">
          <div className="fr-section-head">TOPICS</div>
          {topics.length === 0 && (
            <div className="fr-empty">
              No topics yet. Create them in Manage tags — they are the shelves your library is divided into.
            </div>
          )}
          <div className="fr-rows">
            {topics.map((t) => {
              const on = filters.topicId === t.id
              return (
                <button key={t.id} className={`fr-row${on ? ' on' : ''}`} onClick={() => setTopic(t.id)}>
                  <span className="fr-lead">
                    <span className="fr-dot" style={{ background: t.color || 'var(--rule-strong)' }} />
                  </span>
                  <span className="fr-label">{t.name}</span>
                  <span className="fr-n">{topicCounts[t.id] || 0}</span>
                </button>
              )
            })}

            {unfiledCount > 0 && (
              <button
                className={`fr-row fr-unfiled${filters.topicId === UNFILED ? ' on' : ''}`}
                onClick={() => setTopic(UNFILED)}
                title={`${unfiledCount} video${unfiledCount === 1 ? '' : 's'} with no topic yet`}
              >
                <span className="fr-lead">
                  <Icon name="inbox" size={17} strokeWidth={1.7} />
                </span>
                <span className="fr-label">Unfiled</span>
                <span className="fr-badge">{unfiledCount}</span>
              </button>
            )}
          </div>
        </div>

        <div className="fr-section">
          <div className="fr-section-head">
            TAGS
            {filters.tagIds.length > 1 && (
              <span className="fr-toggle">
                {(['all', 'any'] as const).map((mode) => (
                  <button
                    key={mode}
                    className={filters.tagMode === mode ? 'on' : undefined}
                    onClick={() => setFilters((f) => ({ ...f, tagMode: mode }))}
                    title={mode === 'all' ? 'Videos with every selected tag' : 'Videos with any selected tag'}
                  >
                    {mode.toUpperCase()}
                  </button>
                ))}
              </span>
            )}
          </div>
          {scopedTags.length === 0 ? (
            <div className="fr-empty">{filters.topicId ? 'No tags inside this topic yet.' : 'No tags yet.'}</div>
          ) : (
            <div className="fr-chips">
              {scopedTags.map(({ tag, count }) => (
                <button
                  key={tag.id}
                  className={`fr-chip${filters.tagIds.includes(tag.id) ? ' on' : ''}`}
                  onClick={() => toggleTag(tag.id)}
                >
                  {tag.name}
                  <span className="fr-n">{count}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="fr-footer">
        <button className="fr-btn primary" onClick={onAddVideo}>
          <Icon name="plus" size={16} strokeWidth={2} />
          Add video
        </button>
        <button className="fr-btn" onClick={onManageTags}>
          <Icon name="tag" size={16} />
          Manage tags
        </button>
        <div className="fr-sha">{import.meta.env.VITE_GIT_SHA}</div>
      </div>
    </div>
  )
}

function Lens({
  label,
  count,
  active,
  onClick,
  icon,
}: {
  label: string
  count: number
  active: boolean
  onClick: () => void
  icon?: IconName
}) {
  return (
    <button className={`fr-lens${active ? ' on' : ''}`} onClick={onClick} title={`${label} · ${count}`}>
      {icon && <Icon name={icon} size={14} strokeWidth={1.8} />}
      {label}
      <span className="fr-n">{count}</span>
    </button>
  )
}
