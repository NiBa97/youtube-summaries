import type { Channel, Video } from './types'

export const CHANNELS: Channel[] = [
  {
    id: 'c1',
    name: 'Veritasium',
    handle: '@veritasium',
    color: '#2e6f8e',
    topics: ['science', 'physics'],
    followers: '15M',
    cadence: 'weekly',
  },
]

const _now = new Date('2026-05-02T10:00:00')
const _hoursAgo = (h: number) => new Date(_now.getTime() - h * 3600 * 1000).toISOString()

export const VIDEOS: Video[] = [
  {
    id: 'v1',
    channelId: 'c1',
    oneshot: false,
    title: 'The Big Misconception About Electricity',
    duration: 870,
    publishedAt: _hoursAgo(12),
    addedAt: _hoursAgo(11),
    youtubeId: 'jdBlpyCom3U',
    status: 'unread',
    starred: true,
    tags: ['physics', 'electricity'],
    readingTime: 4,
    tldr: 'Energy travels through the fields around the wire, not through the electrons inside it. The wire only guides where the field goes.',
    summary: {
      keypoints: [
        'Electrons drift slowly — millimeters per second through copper.',
        'Energy is carried by the electromagnetic field surrounding the conductor.',
        'A bulb across a 1-light-second loop lights up almost instantly, not after 2 seconds.',
        'The Poynting vector points from source to load, mostly outside the wire.',
      ],
      stat: { value: '~1/c', caption: 'time for the field to reach the load, regardless of wire length' },
    },
  },
]
