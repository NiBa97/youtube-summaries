// ==UserScript==
// @name         YouTube Summaries – add to library
// @namespace    https://github.com/NiBa97/youtube-summaries
// @version      0.3.0
// @description  Summarise the YouTube video you are watching, file it into your library, all from the watch page.
// @match        https://www.youtube.com/*
// @match        https://m.youtube.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @connect      *
// ==/UserScript==

/*
 * Runs the same pipeline as AddVideoDialog in the app:
 *   POST /api/slides (transcript + deck + classification) -> pick tags -> write to Pocketbase.
 *
 * All requests go through GM_xmlhttpRequest, not fetch: youtube.com's CSP blocks
 * cross-origin connects from page context, and GM_xmlhttpRequest also skips CORS.
 *
 * Logic mirrored from the frontend - keep in sync:
 *   normalizeTag()      <- frontend/src/lib/tags.ts
 *   buildVocabulary()   <- frontend/src/lib/tags.ts
 *   AUTO_APPLY_THRESHOLD, suggestedValue(), ensureTags(), save flow
 *   videoPayload()      <- frontend/src/lib/pb.ts
 */
(function () {
  'use strict'

  const VERSION = '0.3.0'

  // Load indicator. A small pill that fades on its own; only errors stay (click
  // to dismiss). Built with createElement/textContent only (no innerHTML) and
  // before anything else, so it still shows if the rest of the script fails.
  const bar = document.createElement('div')
  bar.style.cssText =
    'position:fixed;left:12px;bottom:12px;z-index:2147483647;padding:4px 10px;border-radius:999px;' +
    'font:11px system-ui,sans-serif;color:#fff;background:#222;opacity:.9;transition:opacity .6s;pointer-events:none'
  bar.addEventListener('click', () => bar.remove())
  let fadeTimer = null
  const setStatus = (msg, isErr) => {
    clearTimeout(fadeTimer)
    bar.textContent = `YT Summaries v${VERSION} · ${msg}`
    bar.style.background = isErr ? '#9a3b2f' : '#222'
    bar.style.pointerEvents = isErr ? 'auto' : 'none'
    bar.style.opacity = '.9'
    if (!isErr) {
      fadeTimer = setTimeout(() => {
        bar.style.opacity = '0'
        fadeTimer = setTimeout(() => bar.remove(), 700)
      }, 2500)
    }
  }
  setStatus('starting…')
  document.documentElement.appendChild(bar)
  window.addEventListener('error', (e) => {
    if (e.filename && e.filename.includes('userscript')) setStatus('error: ' + e.message, true)
  })

  try {
    main()
  } catch (e) {
    setStatus('failed to start: ' + (e && e.message), true)
    console.error('[YT Summaries]', e)
  }

  function main() {

  const AUTO_APPLY_THRESHOLD = 0.75
  const DEFAULT_BASE = 'http://localhost'

  const baseUrl = () => String(GM_getValue('baseUrl', DEFAULT_BASE)).replace(/\/+$/, '')
  const API = () => baseUrl() + '/api'
  const PB = () => baseUrl() + '/pb/api'

  // Optional: hide Shorts everywhere and turn /shorts/ID links into normal watch pages.
  const blockShorts = !!GM_getValue('blockShorts', false)
  GM_registerMenuCommand(blockShorts ? 'Shorts: blocked (click to allow)' : 'Shorts: allowed (click to block)', () => {
    GM_setValue('blockShorts', !blockShorts)
    location.reload()
  })
  if (blockShorts) {
    const style = document.createElement('style')
    style.textContent = [
      'ytd-reel-shelf-renderer', 'ytd-rich-shelf-renderer[is-shorts]', 'ytd-reel-item-renderer',
      'ytm-shorts-lockup-view-model', 'ytm-shorts-lockup-view-model-v2', 'grid-shelf-view-model',
      'ytd-guide-entry-renderer:has(a[title="Shorts"])', 'ytd-mini-guide-entry-renderer:has(a[title="Shorts"])',
      'ytd-video-renderer:has(a[href^="/shorts/"])', 'ytd-rich-item-renderer:has(a[href^="/shorts/"])',
      'yt-lockup-view-model:has(a[href^="/shorts/"])', 'ytd-grid-video-renderer:has(a[href^="/shorts/"])',
      'yt-chip-cloud-chip-renderer:has(yt-formatted-string[title="Shorts"])',
    ].join(',\n') + ' { display: none !important; }'
    document.documentElement.appendChild(style)
  }
  function redirectShorts() {
    if (!blockShorts) return
    const m = location.pathname.match(/^\/shorts\/([\w-]{11})/)
    if (m) location.replace('/watch?v=' + m[1])
  }
  redirectShorts()

  GM_registerMenuCommand('Set app URL…', () => {
    const next = window.prompt('Base URL of your YouTube Summaries instance (no trailing /api):', baseUrl())
    if (next && next.trim()) GM_setValue('baseUrl', next.trim().replace(/\/+$/, ''))
  })

  // ---------- http ----------

  function request(method, url, body) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method,
        url,
        headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
        data: body === undefined ? undefined : JSON.stringify(body),
        timeout: 180000,
        onload: (r) => {
          let json = null
          try {
            json = JSON.parse(r.responseText)
          } catch {
            // not JSON
          }
          if (r.status >= 200 && r.status < 300) return resolve(json)
          const detail = json && (json.detail || json.message)
          reject(new Error(detail ? String(typeof detail === 'string' ? detail : JSON.stringify(detail)) : 'HTTP ' + r.status))
        },
        onerror: () => reject(new Error('Cannot reach ' + baseUrl() + ' – check the app URL (Tampermonkey menu → Set app URL).')),
        ontimeout: () => reject(new Error('Timed out')),
      })
    })
  }

  async function pbList(collection, params) {
    const items = []
    for (let page = 1; ; page++) {
      const q = new URLSearchParams({ perPage: '500', page: String(page), ...params })
      const res = await request('GET', `${PB()}/collections/${collection}/records?${q}`)
      items.push(...res.items)
      if (page >= res.totalPages) return items
    }
  }

  // ---------- library logic (mirrors frontend) ----------

  const normalizeTag = (name) => name.trim().toLowerCase().replace(/[\s_-]+/g, '')

  function buildVocabulary(tags, videoTagLists) {
    const counts = {}
    for (const list of videoTagLists) for (const id of list) counts[id] = (counts[id] || 0) + 1
    return {
      topics: tags.filter((t) => t.kind === 'topic').map((t) => t.name),
      tags: tags
        .filter((t) => t.kind === 'tag')
        .map((t) => ({ name: t.name, count: counts[t.id] || 0 }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    }
  }

  function suggestedValue(c, tags) {
    if (!c) return { topicId: null, tagNames: [] }
    const topic = tags.find((t) => t.kind === 'topic' && t.norm === normalizeTag(c.topic || ''))
    return {
      topicId: topic ? topic.id : null,
      tagNames: c.tags.filter((s) => s.confidence >= AUTO_APPLY_THRESHOLD).map((s) => s.name),
    }
  }

  async function ensureTags(names, known) {
    const byNorm = new Map(known.map((t) => [t.norm, t]))
    const out = []
    const seen = new Set()
    for (const raw of names) {
      const norm = normalizeTag(raw)
      if (!norm || seen.has(norm)) continue
      seen.add(norm)
      const hit = byNorm.get(norm)
      if (hit) {
        out.push(hit)
        continue
      }
      try {
        out.push(await request('POST', `${PB()}/collections/tags/records`, { name: raw.trim(), norm, kind: 'tag', color: '', sort: 0 }))
      } catch {
        try {
          const res = await request('GET', `${PB()}/collections/tags/records?perPage=1&filter=${encodeURIComponent(`norm="${norm}"`)}`)
          if (res.items[0]) out.push(res.items[0])
        } catch {
          // give up on this tag only
        }
      }
    }
    return out
  }

  // ---------- page ----------

  function idFromHref(href) {
    let u
    try {
      u = new URL(href, location.origin)
    } catch {
      return null
    }
    if (u.pathname === '/watch') {
      const v = u.searchParams.get('v')
      return v && /^[\w-]{11}$/.test(v) ? v : null
    }
    const m = u.pathname.match(/^\/(?:live|embed)\/([\w-]{11})/)
    return m ? m[1] : null
  }
  const currentVideoId = () => idFromHref(location.href)

  // ---------- ui ----------

  // YouTube enforces Trusted Types: a plain innerHTML assignment throws and the
  // whole script dies silently. Every markup write goes through this.
  let ttPolicy = null
  try {
    ttPolicy = window.trustedTypes ? window.trustedTypes.createPolicy('yts-userscript', { createHTML: (s) => s }) : null
  } catch {
    // policy name refused; fall through to plain strings
  }
  const setHTML = (el, html) => {
    el.innerHTML = ttPolicy ? ttPolicy.createHTML(html) : html
  }

  const CSS = `
    :host { all: initial; }
    * { box-sizing: border-box; font-family: system-ui, sans-serif; }
    .fab { position: fixed; right: 20px; bottom: 20px; z-index: 2147483647; padding: 10px 16px; border-radius: 999px;
      border: 0; background: #a85a2a; color: #fff; font-size: 14px; font-weight: 600; cursor: pointer; box-shadow: 0 2px 10px rgba(0,0,0,.35); }
    .thumb { position: fixed; z-index: 2147483647; width: 30px; height: 30px; border-radius: 8px; border: 0; padding: 0;
      background: #a85a2a; color: #fff; font-size: 20px; line-height: 30px; text-align: center; cursor: pointer;
      box-shadow: 0 1px 6px rgba(0,0,0,.5); }
    .thumb:hover { background: #c0692f; }
    .panel { position: fixed; right: 20px; bottom: 70px; z-index: 2147483647; width: 380px; max-width: calc(100vw - 40px);
      max-height: calc(100vh - 100px); overflow: auto; background: #fffdf8; color: #222; border: 1px solid #d8cfc0;
      border-radius: 12px; padding: 16px; box-shadow: 0 8px 30px rgba(0,0,0,.35); font-size: 13px; line-height: 1.45; }
    h3 { margin: 0 0 4px; font-size: 15px; }
    .sub { color: #776; margin: 0 0 12px; font-size: 12px; }
    .row { display: flex; gap: 8px; margin-top: 12px; align-items: center; flex-wrap: wrap; }
    button.btn { padding: 8px 14px; border-radius: 8px; border: 1px solid #a85a2a; background: #a85a2a; color: #fff; font-weight: 600; cursor: pointer; }
    button.btn.ghost { background: transparent; color: #a85a2a; }
    button.btn:disabled { opacity: .5; cursor: default; }
    textarea { width: 100%; min-height: 60px; padding: 8px; border: 1px solid #d8cfc0; border-radius: 8px; font-size: 13px; resize: vertical; background: #fff; color: #222; }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
    .chip { padding: 3px 10px; border-radius: 999px; border: 1px solid #cbbf9f; background: #fff; color: #444; cursor: pointer; font-size: 12px; }
    .chip.on { background: #a85a2a; border-color: #a85a2a; color: #fff; }
    .chip.new { border-style: dashed; }
    .label { margin-top: 12px; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: #776; }
    .err { color: #9a3b2f; margin-top: 10px; white-space: pre-wrap; }
    .steps { list-style: none; padding: 0; margin: 12px 0 0; }
    .steps li { padding: 4px 0; color: #999; }
    .steps li.done { color: #3f6b46; } .steps li.done::before { content: '✓ '; }
    .steps li.active { color: #222; font-weight: 600; } .steps li.active::before { content: '… '; }
    a { color: #a85a2a; }
    .ok { display: flex; gap: 12px; align-items: center; }
    .check { flex: none; width: 36px; height: 36px; border-radius: 50%; background: #3f6b46; color: #fff; font-size: 20px;
      line-height: 36px; text-align: center; }
    .ok .t { font-weight: 700; font-size: 14px; }
    .ok .s { color: #776; font-size: 12px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box;
      -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
    .countdown { height: 3px; margin: 14px -16px -16px; background: #eee6d6; border-radius: 0 0 12px 12px; overflow: hidden; }
    .countdown i { display: block; height: 100%; background: #3f6b46; transform-origin: left;
      animation: drain var(--ms, 4000ms) linear forwards; }
    .panel:hover .countdown i { animation-play-state: paused; }
    @keyframes drain { from { transform: scaleX(1); } to { transform: scaleX(0); } }
  `

  const host = document.createElement('div')
  const root = host.attachShadow({ mode: 'open' })
  setHTML(root, `<style>${CSS}</style><button class="fab" hidden>＋ Summarise</button><button class="thumb" title="Summarise this video" hidden>＋</button><div class="panel" hidden></div>`)
  const fab = root.querySelector('.fab')
  const panel = root.querySelector('.panel')
  const thumbBtn = root.querySelector('.thumb')
  document.documentElement.appendChild(host)

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

  // One run's state. Reset whenever the video changes or the panel is closed while idle.
  let run = null
  let runId = 0

  function resetRun() {
    runId++
    run = null
    panel.hidden = true
    setHTML(panel, '')
  }

  function syncFab() {
    const id = currentVideoId()
    fab.hidden = !id
    redirectShorts()
  }
  window.addEventListener('yt-navigate-finish', syncFab)
  setInterval(syncFab, 1500) // m.youtube.com and edge cases don't fire yt-navigate-finish
  syncFab()
  setStatus('loaded ✓' + (blockShorts ? ' · Shorts blocked' : ''))

  // Open the panel for a given video. A run in flight is never clobbered; a
  // finished or idle one is replaced when you pick a different video.
  function openFor(videoId) {
    if (!videoId) return
    if (run && run.busy && run.videoId !== videoId) {
      panel.hidden = false
      render()
      return
    }
    if (run && run.videoId !== videoId) resetRun()
    panel.hidden = false
    if (!run) start(videoId)
    else render()
  }

  fab.addEventListener('click', () => {
    if (!panel.hidden && (!run || run.videoId === currentVideoId())) {
      panel.hidden = true
      return
    }
    openFor(currentVideoId())
  })

  // One floating button that follows the hovered thumbnail. Fixed positioning
  // sidesteps YouTube's per-layout stacking/overflow; delegated listeners
  // survive its endless re-rendering.
  let hoverId = null
  let hideTimer = null
  const hideThumb = () => {
    thumbBtn.hidden = true
    hoverId = null
  }
  document.addEventListener(
    'mouseover',
    (e) => {
      if (e.composedPath().includes(host)) {
        clearTimeout(hideTimer)
        return
      }
      const a = e.target instanceof Element && e.target.closest('a[href*="/watch?v="], a[href^="/live/"]')
      const id = a && idFromHref(a.getAttribute('href'))
      // Only anchors that wrap a thumbnail, not title links.
      if (!id || !a.querySelector('img, yt-image, yt-thumbnail-view-model, yt-collection-thumbnail-view-model, .yt-core-image')) return
      clearTimeout(hideTimer)
      const r = a.getBoundingClientRect()
      if (r.width < 80 || r.height < 40) return
      hoverId = id
      thumbBtn.style.left = Math.round(r.right - 38) + 'px'
      thumbBtn.style.top = Math.round(r.top + 8) + 'px'
      thumbBtn.hidden = false
    },
    true,
  )
  document.addEventListener(
    'mouseout',
    (e) => {
      if (e.relatedTarget && e.composedPath().includes(host)) return
      clearTimeout(hideTimer)
      hideTimer = setTimeout(hideThumb, 250)
    },
    true,
  )
  window.addEventListener('scroll', hideThumb, { passive: true, capture: true })
  thumbBtn.addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    openFor(hoverId)
  })

  // Load library state (does this video exist? what tags exist?) before offering anything.
  async function start(videoId) {
    const my = ++runId
    run = { videoId, phase: 'loading', instructions: '', busy: true }
    render()
    try {
      const [existing, tags, videoTags] = await Promise.all([
        request('GET', `${PB()}/collections/videos/records?perPage=1&fields=id,title&filter=${encodeURIComponent(`video_id="${videoId}"`)}`),
        pbList('tags', { sort: 'sort,name' }),
        pbList('videos', { fields: 'tags' }),
      ])
      if (my !== runId) return
      run.tags = tags
      run.vocabulary = buildVocabulary(tags, videoTags.map((v) => v.tags || []))
      run.busy = false
      run.phase = existing.items.length ? 'exists' : 'ready'
      run.existing = existing.items[0]
    } catch (e) {
      if (my !== runId) return
      run.busy = false
      run.phase = 'failed'
      run.error = e.message
      run.retry = () => start(videoId)
    }
    render()
  }

  async function generate() {
    const my = runId
    run.busy = true
    run.phase = 'generating'
    run.error = null
    run.startedAt = Date.now()
    render()
    const tick = setInterval(() => {
      if (my !== runId || run.phase !== 'generating') return clearInterval(tick)
      const el = panel.querySelector('[data-elapsed]')
      if (el) el.textContent = Math.round((Date.now() - run.startedAt) / 1000) + 's'
    }, 500)
    try {
      const resp = await request('POST', `${API()}/slides`, {
        url: `https://www.youtube.com/watch?v=${run.videoId}`,
        instructions: run.instructions.trim() || undefined,
        vocabulary: run.vocabulary,
      })
      if (my !== runId) return
      const initial = suggestedValue(resp.classification, run.tags)
      run.result = resp
      run.picked = { topicId: initial.topicId, tagNames: new Set(initial.tagNames) }
      run.aiNorms = new Set(initial.tagNames.map(normalizeTag))
      run.phase = 'review'
    } catch (e) {
      if (my !== runId) return
      run.phase = 'failed'
      run.error = e.message
      run.retry = generate
    } finally {
      clearInterval(tick)
      if (my === runId) run.busy = false
    }
    render()
  }

  async function save() {
    const my = runId
    run.busy = true
    run.phase = 'saving'
    render()
    try {
      const { result, picked, tags } = run
      const resolved = await ensureTags([...picked.tagNames], tags)
      const tagSource = {}
      for (const t of resolved) tagSource[t.id] = run.aiNorms.has(t.norm) ? 'ai' : 'human'
      if (picked.topicId) {
        const suggested = suggestedValue(result.classification, tags).topicId
        tagSource[picked.topicId] = picked.topicId === suggested ? 'ai' : 'human'
      }
      await request('POST', `${PB()}/collections/videos/records`, {
        url: `https://www.youtube.com/watch?v=${result.video_id}`,
        video_id: result.video_id,
        title: (result.deck && result.deck.title) || `YouTube ${result.video_id}`,
        deck: result.deck,
        transcript: result.transcript,
        instructions: run.instructions.trim(),
        topic: picked.topicId || '',
        tags: resolved.map((t) => t.id),
        tag_source: tagSource,
        status: 'slides_ready',
        read_status: 'unread',
      })
      if (my !== runId) return
      run.phase = 'saved'
      run.savedTitle = (result.deck && result.deck.title) || result.video_id
      armAutoClose(my)
    } catch (e) {
      if (my !== runId) return
      run.phase = 'failed'
      run.error = e.message
      run.retry = save
    }
    run.busy = false
    render()
  }

  // The success card dismisses itself. Hovering it pauses the countdown (CSS)
  // and the timer, so a link you are reaching for does not vanish.
  const AUTO_CLOSE_MS = 4000
  let closeTimer = null
  function armAutoClose(my) {
    clearTimeout(closeTimer)
    closeTimer = setTimeout(() => {
      if (my === runId && run && run.phase === 'saved' && !panel.matches(':hover')) resetRun()
    }, AUTO_CLOSE_MS)
  }
  panel.addEventListener('mouseleave', () => {
    if (run && run.phase === 'saved') {
      // restart the visible bar too, so bar and timer agree
      setHTML(panel, panel.innerHTML)
      armAutoClose(runId)
    }
  })

  function chips(items, isOn, attr, extra = '') {
    return items
      .map((t) => `<button class="chip ${isOn(t) ? 'on' : ''} ${extra}" data-${attr}="${esc(t.key)}">${esc(t.label)}</button>`)
      .join('')
  }

  function render() {
    if (!run || panel.hidden) return
    const p = run.phase
    let html = ''
    const err = run.error ? `<div class="err">${esc(run.error)}</div>` : ''

    if (p === 'loading') {
      html = `<h3>Summaries</h3><p class="sub">Checking your library…</p>`
    } else if (p === 'exists') {
      html = `<h3>Already in your library</h3><p class="sub">${esc(run.existing.title || run.videoId)}</p>
        <p>Re-summarising is a deliberate choice in the app – open it there.</p>
        <div class="row"><a href="${esc(baseUrl())}" target="_blank" rel="noreferrer">Open library</a></div>`
    } else if (p === 'ready') {
      html = `<h3>Add to library</h3><p class="sub">Transcript → deck → suggested filing. Takes ~40s.</p>
        <textarea data-instr maxlength="1000" placeholder="Optional: steer what the summary covers">${esc(run.instructions)}</textarea>
        <div class="row"><button class="btn" data-go>Summarise</button></div>`
    } else if (p === 'generating') {
      html = `<h3>Working…</h3><p class="sub">Elapsed <span data-elapsed>0s</span></p>
        <ul class="steps"><li class="active">Fetching transcript, writing deck, filing against your tags</li></ul>
        <p class="sub">Nothing is saved yet.</p>`
    } else if (p === 'review') {
      const r = run.result
      const topics = run.tags.filter((t) => t.kind === 'topic')
      const existingTags = run.tags.filter((t) => t.kind === 'tag')
      const c = r.classification
      const proposed = ((c && c.new_tags) || []).filter((s) => !run.tags.some((t) => t.norm === normalizeTag(s.name)))
      // Suggested-but-known names first, then the rest of the vocabulary, then proposals.
      const suggestedFirst = [
        ...existingTags.filter((t) => run.picked.tagNames.has(t.name)),
        ...existingTags.filter((t) => !run.picked.tagNames.has(t.name)),
      ]
      html = `<h3>${esc((r.deck && r.deck.title) || r.video_id)}</h3>
        <p class="sub">${esc((r.deck && r.deck.tldr) || '')}</p>
        ${r.language_fallback ? `<p class="err">No English subtitles – used the ${esc(r.language)} track and translated. Expect less precision.</p>` : ''}
        <div class="label">Topic</div>
        <div class="chips">${chips(topics.map((t) => ({ key: t.id, label: t.name })), (t) => run.picked.topicId === t.key, 'topic')}</div>
        <div class="label">Tags</div>
        <div class="chips">${chips(suggestedFirst.map((t) => ({ key: t.name, label: t.name })), (t) => run.picked.tagNames.has(t.key), 'tag')}
        ${chips(proposed.map((s) => ({ key: s.name, label: '+ ' + s.name })), (t) => run.picked.tagNames.has(t.key), 'tag', 'new')}</div>
        <p class="sub" style="margin-top:8px">Dashed = new tag proposed by the model; never pre-selected.</p>
        <div class="row"><button class="btn" data-save>Save to library</button><button class="btn ghost" data-discard>Discard</button></div>`
    } else if (p === 'saving') {
      html = `<h3>Saving…</h3><ul class="steps"><li class="done">Deck generated</li><li class="active">Writing to library</li></ul>`
    } else if (p === 'saved') {
      html = `<div class="ok"><div class="check">✓</div><div><div class="t">Saved to library</div><div class="s">${esc(run.savedTitle || '')}</div></div></div>
        <div class="row"><a href="${esc(baseUrl())}" target="_blank" rel="noreferrer">Open library</a><button class="btn ghost" data-close>Close</button></div>
        <div class="countdown"><i style="--ms:${AUTO_CLOSE_MS}ms"></i></div>`
    } else if (p === 'failed') {
      html = `<h3>Failed</h3>${err}<div class="row"><button class="btn" data-retry>Retry</button></div>`
    }
    setHTML(panel, html)
    if (p === 'review' && run.error) setHTML(panel, html + err)
  }

  panel.addEventListener('click', (e) => {
    const t = e.target.closest('button')
    if (!t || !run) return
    if ('go' in t.dataset) generate()
    else if ('save' in t.dataset) save()
    else if ('retry' in t.dataset) run.retry && run.retry()
    else if ('discard' in t.dataset || 'close' in t.dataset) resetRun()
    else if ('topic' in t.dataset) {
      run.picked.topicId = run.picked.topicId === t.dataset.topic ? null : t.dataset.topic
      render()
    } else if ('tag' in t.dataset) {
      const s = run.picked.tagNames
      s.has(t.dataset.tag) ? s.delete(t.dataset.tag) : s.add(t.dataset.tag)
      render()
    }
  })
  panel.addEventListener('input', (e) => {
    if (run && e.target.matches('[data-instr]')) run.instructions = e.target.value
  })
  }
})()
