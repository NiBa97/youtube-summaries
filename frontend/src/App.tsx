import { useCallback, useEffect, useMemo, useState } from 'react'
import { Group, Panel, Separator } from 'react-resizable-panels'
import { listVideos, updateVideo } from './lib/pb'
import { listTags } from './lib/tags'
import type { Filters, Tag, TagSource, Video } from './types'
import { FilterRail, UNFILED } from './components/FilterRail'
import { ListToolbar } from './components/ListToolbar'
import { VideoList } from './components/VideoList'
import { VideoPanel } from './components/VideoPanel'
import { DeckPanel } from './components/DeckPanel'
import { VideoTagBar } from './components/VideoTagBar'
import { AddVideoDialog } from './components/AddVideoDialog'
import { TagManagerDialog } from './components/TagManagerDialog'

const EMPTY_FILTERS: Filters = {
  q: '',
  channelId: null,
  topicId: null,
  tagIds: [],
  tagMode: 'all',
  unreadOnly: false,
  starredOnly: false,
}

function App() {
  const [videos, setVideos] = useState<Video[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [tagsOpen, setTagsOpen] = useState(false)
  const [jumpStart, setJumpStart] = useState<number | null>(null)
  const [draggingVideoId, setDraggingVideoId] = useState<string | null>(null)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'paper')
  }, [])

  const reload = useCallback(async () => {
    const [vs, ts] = await Promise.all([listVideos(), listTags()])
    setVideos(vs)
    setTags(ts)
    setSelectedId((cur) => cur ?? vs[0]?.id ?? null)
  }, [])

  useEffect(() => {
    reload().catch((e) => console.error('initial load failed', e))
  }, [reload])

  const reloadTags = useCallback(() => {
    listTags()
      .then(setTags)
      .catch((e) => console.error('listTags failed', e))
  }, [])

  const filteredVideos = useMemo(() => {
    let out = videos
    if (filters.topicId) {
      out = out.filter((v) => (filters.topicId === UNFILED ? !v.topicId : v.topicId === filters.topicId))
    }
    if (filters.tagIds.length > 0) {
      out = out.filter((v) =>
        filters.tagMode === 'all'
          ? filters.tagIds.every((id) => v.tagIds.includes(id))
          : filters.tagIds.some((id) => v.tagIds.includes(id)),
      )
    }
    if (filters.unreadOnly) out = out.filter((v) => v.status === 'unread')
    if (filters.starredOnly) out = out.filter((v) => v.starred)
    if (filters.q) {
      const q = filters.q.toLowerCase()
      out = out.filter(
        (v) =>
          v.title.toLowerCase().includes(q) ||
          v.tldr?.toLowerCase().includes(q) ||
          (v.tags || []).some((tg) => tg.toLowerCase().includes(q)),
      )
    }
    return [...out].sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt))
  }, [videos, filters])

  useEffect(() => {
    if (filteredVideos.length === 0) return
    if (!filteredVideos.find((v) => v.id === selectedId)) setSelectedId(filteredVideos[0].id)
  }, [filteredVideos, selectedId])

  const tagById = useMemo(() => new Map(tags.map((t) => [t.id, t])), [tags])
  const selectedVideo = videos.find((v) => v.id === selectedId) || null
  const selectedTopic = selectedVideo?.topicId ? tagById.get(selectedVideo.topicId) || null : null

  const patchVideo = (video: Video) =>
    setVideos((vs) => vs.map((v) => (v.id === video.id ? video : v)))

  const toggleStar = (id: string) => {
    const current = videos.find((v) => v.id === id)
    if (!current) return
    const starred = !current.starred
    setVideos((vs) => vs.map((v) => (v.id === id ? { ...v, starred } : v)))
    updateVideo(id, { starred }).catch((e) => {
      console.error('star failed', e)
      setVideos((vs) => vs.map((v) => (v.id === id ? { ...v, starred: !starred } : v)))
    })
  }

  /**
   * Drag-and-drop filing: move a video onto a Topic shelf (or off it, when
   * dropped on Unfiled). Optimistic, with a rollback on failure, because the
   * whole point of the gesture is that filing feels free.
   */
  const moveToTopic = (id: string, topicId: string | null) => {
    // End the drag here rather than waiting for dragend, or the target row
    // flashes its "already here" marker for a frame on the way out.
    setDraggingVideoId(null)
    const current = videos.find((v) => v.id === id)
    if (!current || (current.topicId || null) === topicId) return

    // Provenance mirrors the tag bar: a hand-dragged topic is human-attached,
    // and the topic it left stops being recorded unless it is also a tag.
    const tagSource: TagSource = { ...current.tagSource }
    if (current.topicId && !current.tagIds.includes(current.topicId)) delete tagSource[current.topicId]
    if (topicId) tagSource[topicId] = 'human'

    setVideos((vs) => vs.map((v) => (v.id === id ? { ...v, topicId, tagSource } : v)))
    updateVideo(id, { topic: topicId, tag_source: tagSource }).catch((e) => {
      console.error('move to topic failed', e)
      setVideos((vs) => vs.map((v) => (v.id === id ? current : v)))
    })
  }

  const onSelect = (id: string) => {
    setSelectedId(id)
    setJumpStart(null)
    const current = videos.find((v) => v.id === id)
    if (current && current.status === 'unread') {
      setVideos((vs) => vs.map((v) => (v.id === id ? { ...v, status: 'reading' as const } : v)))
      updateVideo(id, { read_status: 'reading' }).catch((e) => console.error('read state failed', e))
    }
  }

  const onAddVideo = (video: Video) => {
    setVideos((vs) => [video, ...vs.filter((v) => v.id !== video.id)])
    setSelectedId(video.id)
    setJumpStart(null)
  }

  return (
    <div style={{ height: '100vh', background: 'var(--bg)', overflow: 'hidden' }}>
      <Group orientation="horizontal" id="reel-h" style={{ height: '100%' }}>
        <Panel id="rail" defaultSize="18%" minSize="200px" maxSize="32%">
          <FilterRail
            tags={tags}
            videos={videos}
            filters={filters}
            setFilters={setFilters}
            onAddVideo={() => setAddOpen(true)}
            onManageTags={() => setTagsOpen(true)}
            draggingVideoId={draggingVideoId}
            onDropOnTopic={moveToTopic}
          />
        </Panel>
        <Separator className="rs-sep rs-sep-h" />

        <Panel id="list" defaultSize="36%" minSize="280px">
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
            <ListToolbar
              count={filteredVideos.length}
              title={filters.topicId ? (filters.topicId === UNFILED ? 'Unfiled' : tagById.get(filters.topicId)?.name || 'Topic') : 'All videos'}
              tagNames={filters.tagIds.map((id) => tagById.get(id)?.name).filter((n): n is string => !!n)}
              tagMode={filters.tagMode}
              onClear={filters.topicId || filters.tagIds.length ? () => setFilters((f) => ({ ...f, topicId: null, tagIds: [] })) : undefined}
            />
            <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
              <VideoList
                videos={filteredVideos}
                tagById={tagById}
                selectedId={selectedId}
                onSelect={onSelect}
                onToggleStar={toggleStar}
                onDragStart={setDraggingVideoId}
                onDragEnd={() => setDraggingVideoId(null)}
              />
            </div>
          </div>
        </Panel>
        <Separator className="rs-sep rs-sep-h" />

        <Panel id="right" defaultSize="46%" minSize="320px">
          <Group orientation="vertical" id="reel-v" style={{ height: '100%' }}>
            <Panel id="player" defaultSize="50%" minSize="160px">
              <VideoPanel video={selectedVideo} start={jumpStart} />
            </Panel>
            <Separator className="rs-sep rs-sep-v" />
            <Panel id="deck" defaultSize="50%" minSize="160px">
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
                {selectedVideo && (
                  <VideoTagBar
                    key={selectedVideo.id}
                    video={selectedVideo}
                    tags={tags}
                    videos={videos}
                    onSaved={patchVideo}
                    onVocabularyChange={reloadTags}
                  />
                )}
                <div style={{ flex: 1, minHeight: 0 }}>
                  <DeckPanel video={selectedVideo} topic={selectedTopic} onJump={setJumpStart} />
                </div>
              </div>
            </Panel>
          </Group>
        </Panel>
      </Group>

      <AddVideoDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdd={onAddVideo}
        tags={tags}
        videos={videos}
        onVocabularyChange={reloadTags}
      />
      {tagsOpen && (
        <TagManagerDialog onClose={() => setTagsOpen(false)} tags={tags} videos={videos} onChanged={reload} />
      )}
    </div>
  )
}

export default App
