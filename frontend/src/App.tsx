import { useEffect, useMemo, useState } from 'react'
import { Group, Panel, Separator } from 'react-resizable-panels'
import { CHANNELS, VIDEOS } from './data'
import type { Filters, Video } from './types'
import { FilterRail } from './components/FilterRail'
import { ListToolbar } from './components/ListToolbar'
import { VideoList } from './components/VideoList'
import { VideoPanel } from './components/VideoPanel'
import { DeckPanel } from './components/DeckPanel'
import { AddVideoDialog } from './components/AddVideoDialog'

function App() {
  const [videos, setVideos] = useState<Video[]>(VIDEOS)
  const [filters, setFilters] = useState<Filters>({ q: '', channelId: null })
  const [selectedId, setSelectedId] = useState<string | null>(VIDEOS[0]?.id ?? null)
  const [addOpen, setAddOpen] = useState(false)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'paper')
  }, [])

  const filteredVideos = useMemo(() => {
    let out = videos
    if (filters.channelId) out = out.filter((v) => v.channelId === filters.channelId)
    if (filters.q) {
      const q = filters.q.toLowerCase()
      out = out.filter(
        (v) =>
          v.title.toLowerCase().includes(q) ||
          v.tldr?.toLowerCase().includes(q) ||
          (v.tags || []).some((tg) => tg.includes(q)),
      )
    }
    return [...out].sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt))
  }, [videos, filters])

  useEffect(() => {
    if (filteredVideos.length === 0) return
    if (!filteredVideos.find((v) => v.id === selectedId)) setSelectedId(filteredVideos[0].id)
  }, [filteredVideos, selectedId])

  const selectedVideo = videos.find((v) => v.id === selectedId) || null
  const selectedChannel = selectedVideo?.channelId
    ? CHANNELS.find((c) => c.id === selectedVideo.channelId) || null
    : null

  const toggleStar = (id: string) =>
    setVideos((vs) => vs.map((v) => (v.id === id ? { ...v, starred: !v.starred } : v)))

  const onSelect = (id: string) => {
    setSelectedId(id)
    setVideos((vs) =>
      vs.map((v) => (v.id === id && v.status === 'unread' ? { ...v, status: 'reading' as const } : v)),
    )
  }

  const onAddVideo = (video: Video) => {
    setVideos((vs) => [video, ...vs])
    setSelectedId(video.id)
  }

  return (
    <div style={{ height: '100vh', background: 'var(--bg)', overflow: 'hidden' }}>
      <Group orientation="horizontal" id="reel-h" style={{ height: '100%' }}>
        <Panel id="rail" defaultSize="18%" minSize="200px" maxSize="32%">
          <FilterRail
            channels={CHANNELS}
            videos={videos}
            filters={filters}
            setFilters={setFilters}
            onAddVideo={() => setAddOpen(true)}
          />
        </Panel>
        <Separator className="rs-sep rs-sep-h" />

        <Panel id="list" defaultSize="36%" minSize="280px">
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
            <ListToolbar count={filteredVideos.length} />
            <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
              <VideoList
                videos={filteredVideos}
                channels={CHANNELS}
                selectedId={selectedId}
                onSelect={onSelect}
                onToggleStar={toggleStar}
              />
            </div>
          </div>
        </Panel>
        <Separator className="rs-sep rs-sep-h" />

        <Panel id="right" defaultSize="46%" minSize="320px">
          <Group orientation="vertical" id="reel-v" style={{ height: '100%' }}>
            <Panel id="player" defaultSize="50%" minSize="160px">
              <VideoPanel video={selectedVideo} />
            </Panel>
            <Separator className="rs-sep rs-sep-v" />
            <Panel id="deck" defaultSize="50%" minSize="160px">
              <DeckPanel video={selectedVideo} channel={selectedChannel} />
            </Panel>
          </Group>
        </Panel>
      </Group>

      <AddVideoDialog open={addOpen} onClose={() => setAddOpen(false)} onAdd={onAddVideo} />
    </div>
  )
}

export default App
