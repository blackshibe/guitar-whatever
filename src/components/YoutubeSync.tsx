import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import type { YoutubeSync } from '../types'
import { extractVideoId, loadYouTubeApi } from '../lib/youtube'
import { CloseIcon } from './Icons'

interface Props {
  youtube: YoutubeSync | undefined
  anchorMeasure: number
  onSetVideo: (videoId: string | null) => void
  onSetAnchor: (measure: number, seconds: number) => void
}

export interface YoutubeSyncHandle {
  seekAndPlay: (seconds: number) => void
  pause: () => void
  getCurrentTime: () => number | null
}

interface YTPlayerInstance {
  seekTo(seconds: number, allowSeekAhead: boolean): void
  playVideo(): void
  pauseVideo(): void
  getCurrentTime(): number
  destroy(): void
}

// player.currentTime and the YT constructor aren't in the DOM lib; the API
// script defines window.YT at runtime.
type YTNamespace = {
  Player: new (
    el: HTMLElement,
    opts: { videoId: string; playerVars?: Record<string, unknown>; events?: { onReady?: () => void } }
  ) => YTPlayerInstance
}

// A floating reference-video widget pinned to the corner — Songsterr keeps
// transport at the bottom, so the video lives in the opposite corner rather
// than competing with either the score or the transport bar.
const YoutubeSyncPanel = forwardRef<YoutubeSyncHandle, Props>(function YoutubeSyncPanel(
  { youtube, anchorMeasure, onSetVideo, onSetAnchor },
  ref
) {
  const [collapsed, setCollapsed] = useState(false)
  const [addingUrl, setAddingUrl] = useState(false)
  const [urlInput, setUrlInput] = useState('')
  const [status, setStatus] = useState('')
  const mountRef = useRef<HTMLDivElement | null>(null)
  const playerRef = useRef<YTPlayerInstance | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!youtube || collapsed) return
    let cancelled = false
    loadYouTubeApi().then(() => {
      if (cancelled || !mountRef.current) return
      const YT = (window as unknown as { YT: YTNamespace }).YT
      playerRef.current?.destroy()
      setReady(false)
      playerRef.current = new YT.Player(mountRef.current, {
        videoId: youtube.videoId,
        playerVars: { playsinline: 1 },
        events: { onReady: () => setReady(true) },
      })
    })
    return () => {
      cancelled = true
      playerRef.current?.destroy()
      playerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [youtube?.videoId, collapsed])

  useImperativeHandle(ref, () => ({
    seekAndPlay: (seconds: number) => {
      if (!playerRef.current) return
      playerRef.current.seekTo(seconds, true)
      playerRef.current.playVideo()
    },
    pause: () => playerRef.current?.pauseVideo(),
    getCurrentTime: () => playerRef.current?.getCurrentTime() ?? null,
  }))

  const attach = () => {
    const id = extractVideoId(urlInput)
    if (!id) {
      setStatus('Not a YouTube URL')
      setTimeout(() => setStatus(''), 2000)
      return
    }
    onSetVideo(id)
    setUrlInput('')
    setAddingUrl(false)
    setCollapsed(false)
  }

  const syncHere = () => {
    const t = playerRef.current?.getCurrentTime()
    if (t == null) {
      setStatus('Video not ready')
      setTimeout(() => setStatus(''), 2000)
      return
    }
    onSetAnchor(anchorMeasure, t)
    setStatus(`Anchored → #${anchorMeasure + 1}`)
    setTimeout(() => setStatus(''), 2000)
  }

  // Below md the sidebar stacks full-width, so its own top-right "+ New"
  // lives at the same viewport corner this widget wants — drop out of
  // fixed-corner mode there and flow inline instead of covering it.
  if (!youtube) {
    return (
      <div data-keep-selection className="mx-5 my-3 md:m-0 md:fixed md:top-4 md:right-4 md:z-40 flex justify-end">
        {addingUrl ? (
          <div className="bg-plate-raised border border-hairline-strong p-2.5 flex items-center gap-2 shadow-[0_6px_16px_rgba(0,0,0,0.4)]">
            <input
              autoFocus
              className="bg-transparent border-b border-hairline-strong focus:border-accent outline-none text-ink text-xs font-mono px-1 py-0.5 w-48"
              placeholder="Paste YouTube URL"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') attach()
                if (e.key === 'Escape') setAddingUrl(false)
              }}
            />
            <button className="text-ink-soft hover:text-ink text-xs border-b border-hairline-strong hover:border-accent px-0.5" onClick={attach}>
              Attach
            </button>
            {status && <span className="text-xs text-accent">{status}</span>}
          </div>
        ) : (
          <button
            className="bg-plate-raised border border-hairline-strong text-ink-soft hover:text-ink text-xs font-medium px-3 py-2 shadow-[0_6px_16px_rgba(0,0,0,0.4)]"
            onClick={() => setAddingUrl(true)}
          >
            + Reference video
          </button>
        )}
      </div>
    )
  }

  return (
    <div
      data-keep-selection
      className="w-[280px] max-w-[calc(100vw-2.5rem)] ml-auto mr-5 my-3 md:m-0 md:fixed md:top-4 md:right-4 md:z-40 md:w-64 bg-plate-raised border border-hairline-strong shadow-[0_10px_24px_rgba(0,0,0,0.45)]"
    >
      <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-hairline">
        <button className="text-ink-soft hover:text-ink text-[11px] font-medium uppercase tracking-wide flex-1 text-left truncate" onClick={() => setCollapsed((v) => !v)}>
          {collapsed ? '▸' : '▾'} Reference video
        </button>
        <button className="text-ink-faint hover:text-accent text-[11px] px-1" onClick={() => onSetVideo(null)} title="Remove video">
          <CloseIcon />
        </button>
      </div>
      {!collapsed && (
        <>
          <div className="aspect-video bg-plate">
            <div ref={mountRef} className="w-full h-full" />
          </div>
          <div className="flex items-center gap-2 px-2 py-1.5">
            <button
              className="text-ink-soft hover:text-accent text-[11px] border-b border-hairline-strong hover:border-accent px-0.5 disabled:opacity-40"
              onClick={syncHere}
              disabled={!ready}
            >
              Sync here → #{anchorMeasure + 1}
            </button>
            {status && <span className="text-[11px] text-accent">{status}</span>}
          </div>
        </>
      )}
    </div>
  )
})

export default YoutubeSyncPanel
