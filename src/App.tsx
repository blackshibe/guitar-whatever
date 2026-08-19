import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type KeyboardEvent } from 'react'
import { COLS_PER_MEASURE, advanceIdCounter, defaultTuning, makeTrack, nextId, stringMidi } from './lib/instruments'
import { midiToFreq } from './lib/tunings'
import { playNote, resumeAudio, now } from './lib/audio'
import * as storage from './lib/storage'
import { sectionRangesFor } from './lib/songOps'
import { buildExportText } from './lib/exportText'
import {
  copyRange,
  globalCol,
  normalizeRect,
  parsePayload,
  sectionToClipboard,
  type ClipboardPayload,
} from './lib/clipboard'
import { historyReducer, initHistory } from './lib/songReducer'
import { videoSecondsForCol } from './lib/youtube'
import type { CellPos, Playhead, RangeSelection, Song } from './types'
import TrackTabs from './components/TrackTabs'
import SectionNav from './components/SectionNav'
import TabGrid from './components/TabGrid'
import TuningEditor from './components/TuningEditor'
import SongSidebar from './components/SongSidebar'
import ExportPanel from './components/ExportPanel'
import YoutubeSyncPanel, { type YoutubeSyncHandle } from './components/YoutubeSync'
import TransportBar from './components/TransportBar'
import Toast from './components/Toast'

function blankSong(): Song {
  const track = makeTrack('Guitar', defaultTuning(), 4)
  return {
    id: crypto.randomUUID(),
    title: 'Untitled Song',
    bpm: 100,
    measureCount: 4,
    sections: [{ id: nextId(), name: 'Intro', startMeasure: 0, comment: '' }],
    tracks: [track],
    updatedAt: Date.now(),
  }
}

export default function App() {
  const [initial] = useState<Song>(() => {
    const lastId = storage.getLastOpenedId()
    const loaded = lastId ? storage.loadSong(lastId) : null
    return loaded ?? blankSong()
  })

  const [history, dispatch] = useReducer(historyReducer, initial, initHistory)
  const song = history.present
  const { title, bpm, measureCount, sections, tracks, youtube } = song

  const [activeTrackId, setActiveTrackId] = useState<number>(initial.tracks[0]?.id)
  const [selected, setSelected] = useState<RangeSelection | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playhead, setPlayhead] = useState<Playhead | null>(null)
  const [clip, setClip] = useState<ClipboardPayload | null>(null)
  const [tuningEditorTrackId, setTuningEditorTrackId] = useState<number | null>(null)
  const [librarySongs, setLibrarySongs] = useState<Song[]>(() => storage.listSongs())
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)

  const playTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const visualTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const sectionRefs = useRef<Record<number, HTMLDivElement | null>>({})
  const gridRef = useRef<HTMLDivElement | null>(null)
  const ytRef = useRef<YoutubeSyncHandle | null>(null)
  const draggingRef = useRef(false)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg)
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setToastMsg(null), 2200)
  }, [])

  useEffect(() => {
    const maxId = Math.max(0, ...initial.sections.map((s) => s.id), ...initial.tracks.map((t) => t.id))
    advanceIdCounter(maxId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Selection survives clicks on the toolbar (play-from-cell, + Section) but
  // clears anywhere else outside the grid.
  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('[data-grid],[data-keep-selection]')) setSelected(null)
    }
    const onMouseUp = () => {
      draggingRef.current = false
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('mouseup', onMouseUp)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  // Undo/redo work everywhere except while typing in a text field.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
      if (!(e.ctrlKey || e.metaKey)) return
      const key = e.key.toLowerCase()
      if (key === 'z') {
        e.preventDefault()
        dispatch({ type: e.shiftKey ? 'redo' : 'undo' })
      } else if (key === 'y') {
        e.preventDefault()
        dispatch({ type: 'redo' })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const activeTrack = tracks.find((t) => t.id === activeTrackId) ?? tracks[0]
  const sectionRanges = useMemo(() => sectionRangesFor(sections, measureCount), [sections, measureCount])

  // Structural edits and undo can invalidate the selection — drop it.
  useEffect(() => {
    setSelected((prev) => {
      if (!prev) return prev
      const strings = activeTrack?.tuning.length ?? 0
      const ok = (p: CellPos) => p.m < measureCount && p.s < strings
      return ok(prev.anchor) && ok(prev.focus) ? prev : null
    })
  }, [measureCount, activeTrack])

  // Debounced autosave once the song is in the library. Loading or switching
  // songs isn't an edit — only changes after that count.
  const skipAutosaveRef = useRef(true)
  const autosaveSongIdRef = useRef(initial.id)
  useEffect(() => {
    if (skipAutosaveRef.current || autosaveSongIdRef.current !== song.id) {
      skipAutosaveRef.current = false
      autosaveSongIdRef.current = song.id
      setDirty(false)
      return
    }
    setDirty(true)
    const timer = setTimeout(() => {
      if (storage.listSongs().some((s) => s.id === song.id)) {
        storage.saveSong({ ...song, updatedAt: Date.now() })
        setLibrarySongs(storage.listSongs())
      }
      setDirty(false)
    }, 1000)
    return () => clearTimeout(timer)
  }, [song])

  const focusGrid = () => gridRef.current?.focus({ preventScroll: true })

  // ---- selection ----
  const handleCellMouseDown = (m: number, c: number, s: number, shiftKey: boolean) => {
    draggingRef.current = true
    setSelected((prev) =>
      shiftKey && prev ? { anchor: prev.anchor, focus: { m, c, s } } : { anchor: { m, c, s }, focus: { m, c, s } }
    )
    focusGrid()
  }

  const handleCellEnter = (m: number, c: number, s: number) => {
    if (!draggingRef.current) return
    setSelected((prev) => (prev ? { anchor: prev.anchor, focus: { m, c, s } } : prev))
  }

  // ---- clipboard ----
  const putOnClipboard = (payload: ClipboardPayload) => {
    setClip(payload)
    navigator.clipboard?.writeText(JSON.stringify(payload)).catch(() => {})
  }

  const copySelection = () => {
    if (!selected || !activeTrack) return
    putOnClipboard(copyRange(activeTrack, normalizeRect(selected)))
    showToast('Copied')
  }

  const cutSelection = () => {
    if (!selected || !activeTrack) return
    const rect = normalizeRect(selected)
    putOnClipboard(copyRange(activeTrack, rect))
    dispatch({ type: 'clear-range', trackId: activeTrack.id, rect })
    showToast('Cut')
  }

  const pasteAtSelection = async () => {
    if (!selected || !activeTrack) return
    let payload = clip
    try {
      const parsed = parsePayload(await navigator.clipboard.readText())
      if (parsed) payload = parsed
    } catch {
      // OS clipboard unavailable — the internal one still works
    }
    if (!payload) {
      showToast('Nothing to paste')
      return
    }
    if (payload.kind === 'tab-editor/cells') {
      const rect = normalizeRect(selected)
      const at = { m: Math.floor(rect.col0 / COLS_PER_MEASURE), c: rect.col0 % COLS_PER_MEASURE, s: rect.s0 }
      dispatch({ type: 'paste-cells', trackId: activeTrack.id, at, clip: payload })
    } else {
      const sec = sectionRanges.find((r) => selected.focus.m >= r.startMeasure && selected.focus.m <= r.endMeasure)
      if (sec) {
        dispatch({ type: 'paste-section', at: sec.endMeasure + 1, clip: payload })
        showToast('Section pasted')
      }
    }
  }

  const copySection = (id: number) => {
    const sec = sectionRanges.find((r) => r.id === id)
    if (!sec) return
    putOnClipboard(sectionToClipboard(tracks, sec, song.id, song.measureNotes))
    showToast('Section copied')
  }

  const pasteSectionAt = (at: number) => {
    if (clip?.kind !== 'tab-editor/section') return
    dispatch({ type: 'paste-section', at, clip })
  }

  // ---- measures & sections ----
  const deleteMeasure = (m: number) => {
    if (measureCount <= 1) {
      showToast("Can't delete the last measure")
      return
    }
    dispatch({ type: 'delete-measure', m })
  }

  const addSectionHere = () => {
    const m = selected ? selected.focus.m : measureCount - 1
    if (sections.some((s) => s.startMeasure === m)) {
      showToast('A section already starts here')
      return
    }
    dispatch({ type: 'add-section-at', m })
  }

  const jumpToSection = (id: number) => {
    sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // ---- tracks ----
  const addTrack = () => {
    const t = makeTrack(`Track ${tracks.length + 1}`, defaultTuning(), measureCount)
    dispatch({ type: 'add-track', track: t })
    setActiveTrackId(t.id)
  }

  const removeTrack = (id: number) => {
    if (tracks.length <= 1) return
    dispatch({ type: 'remove-track', id })
    if (activeTrackId === id) setActiveTrackId(tracks.filter((t) => t.id !== id)[0]?.id)
    if (tuningEditorTrackId === id) setTuningEditorTrackId(null)
    showToast('Track removed — Ctrl+Z to undo')
  }

  // ---- song lifecycle ----
  const applySong = (next: Song) => {
    stopPlayback()
    const maxId = Math.max(0, ...next.sections.map((s) => s.id), ...next.tracks.map((t) => t.id))
    advanceIdCounter(maxId)
    dispatch({ type: 'load-song', song: next })
    setActiveTrackId(next.tracks[0]?.id)
    setSelected(null)
    setTuningEditorTrackId(null)
  }

  const handleSave = () => {
    storage.saveSong({ ...song, updatedAt: Date.now() })
    setLibrarySongs(storage.listSongs())
    setDirty(false)
    showToast('Saved')
  }

  const exportLibrary = () => {
    const blob = new Blob([storage.exportLibrary()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'tab-editor-songs.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const importLibrary = async (file: File) => {
    try {
      const count = storage.importLibrary(await file.text())
      setLibrarySongs(storage.listSongs())
      showToast(`Imported ${count}`)
    } catch {
      showToast('Import failed')
    }
  }

  const loadSongFromLibrary = (id: string) => {
    const loaded = storage.loadSong(id)
    if (!loaded) return
    storage.setLastOpenedId(id)
    applySong(loaded)
  }

  const deleteSongFromLibrary = (id: string) => {
    storage.deleteSong(id)
    setLibrarySongs(storage.listSongs())
  }

  const newSong = () => applySong(blankSong())

  // ---- keyboard editing (active track only) ----
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    // Don't hijack typing in text fields (section names, comments, measure notes).
    const target = e.target as HTMLElement
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return

    if (e.key === ' ') {
      e.preventDefault()
      if (isPlaying) stopPlayback()
      else startPlayback(selected ? globalCol(selected.focus.m, selected.focus.c) : 0)
      return
    }

    const ctrl = e.ctrlKey || e.metaKey
    if (ctrl) {
      const key = e.key.toLowerCase()
      if (key === 'c') {
        e.preventDefault()
        copySelection()
        return
      }
      if (key === 'x') {
        e.preventDefault()
        cutSelection()
        return
      }
      if (key === 'v') {
        e.preventDefault()
        void pasteAtSelection()
        return
      }
    }

    if (!selected || !activeTrack) return
    const { focus } = selected

    const setFocus = (m: number, c: number, s: number, extend: boolean) => {
      e.preventDefault()
      const f = { m, c, s }
      setSelected((prev) => (extend && prev ? { anchor: prev.anchor, focus: f } : { anchor: f, focus: f }))
    }

    if (e.key >= '0' && e.key <= '9') {
      e.preventDefault()
      const current = activeTrack.measures[focus.m][focus.c][focus.s]
      let next = current === null || current === '' ? e.key : String(Number(current + e.key))
      if (next.length > 2 || Number(next) > 24) next = e.key
      dispatch({ type: 'set-cell', trackId: activeTrack.id, m: focus.m, c: focus.c, s: focus.s, value: next })
      setSelected({ anchor: focus, focus })
      return
    }

    if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault()
      dispatch({ type: 'clear-range', trackId: activeTrack.id, rect: normalizeRect(selected) })
      return
    }
    if (e.key === 'ArrowUp') {
      if (focus.s > 0) setFocus(focus.m, focus.c, focus.s - 1, e.shiftKey)
      else e.preventDefault()
      return
    }
    if (e.key === 'ArrowDown') {
      if (focus.s < activeTrack.tuning.length - 1) setFocus(focus.m, focus.c, focus.s + 1, e.shiftKey)
      else e.preventDefault()
      return
    }
    if (e.key === 'ArrowLeft' || (e.key === 'Tab' && e.shiftKey)) {
      e.preventDefault()
      if (focus.c > 0) setFocus(focus.m, focus.c - 1, focus.s, e.shiftKey)
      else if (focus.m > 0) setFocus(focus.m - 1, COLS_PER_MEASURE - 1, focus.s, e.shiftKey)
      return
    }
    if (e.key === 'ArrowRight' || e.key === 'Tab') {
      e.preventDefault()
      if (focus.c < COLS_PER_MEASURE - 1) setFocus(focus.m, focus.c + 1, focus.s, e.shiftKey)
      else if (focus.m < measureCount - 1) setFocus(focus.m + 1, 0, focus.s, e.shiftKey)
      else {
        // At the very end the grid grows under the cursor.
        dispatch({ type: 'insert-measure', after: measureCount - 1 })
        setFocus(measureCount, 0, focus.s, false)
      }
      return
    }
    if (e.key === 'Escape') setSelected(null)
  }

  // ---- playback: mixes every track together, plus the reference video ----
  // A lookahead scheduler (the standard Web Audio pattern), not a naive
  // setTimeout-per-note loop: notes are scheduled onto the audio clock a bit
  // ahead of when they sound, so JS event-loop jitter (React renders, GC)
  // never delays the audio itself — it can only delay how far ahead we
  // schedule, which a 150ms lookahead window comfortably absorbs.
  const stopPlayback = useCallback(() => {
    if (playTimeoutRef.current) clearTimeout(playTimeoutRef.current)
    playTimeoutRef.current = null
    visualTimeoutsRef.current.forEach((id) => clearTimeout(id))
    visualTimeoutsRef.current = []
    setIsPlaying(false)
    setPlayhead(null)
    ytRef.current?.pause()
  }, [])

  const startPlayback = (fromStep = 0) => {
    resumeAudio()
    setIsPlaying(true)
    const stepDuration = 60 / bpm / 2 // seconds per 8th note
    const scheduleAhead = 0.15
    const tickMs = 25

    const totalSteps = measureCount * COLS_PER_MEASURE
    let i = Math.max(0, Math.min(fromStep, totalSteps - 1))
    let nextStepTime = now() + 0.05

    if (youtube) ytRef.current?.seekAndPlay(videoSecondsForCol(youtube, bpm, COLS_PER_MEASURE, i))

    const scheduleStep = (stepIndex: number, time: number) => {
      const m = Math.floor(stepIndex / COLS_PER_MEASURE)
      const c = stepIndex % COLS_PER_MEASURE
      tracks.forEach((track) => {
        const col = track.measures[m]?.[c]
        if (!col) return
        col.forEach((fret, s) => {
          if (fret === null || fret === '') return
          const freq = midiToFreq(stringMidi(track.tuning[s]) + Number(fret))
          playNote(freq, time)
        })
      })
      const visualDelayMs = Math.max(0, (time - now()) * 1000)
      visualTimeoutsRef.current.push(setTimeout(() => setPlayhead({ m, c }), visualDelayMs))
    }

    const tick = () => {
      while (i < totalSteps && nextStepTime < now() + scheduleAhead) {
        scheduleStep(i, nextStepTime)
        nextStepTime += stepDuration
        i += 1
      }
      if (i >= totalSteps) {
        playTimeoutRef.current = setTimeout(stopPlayback, Math.max(0, (nextStepTime - now()) * 1000))
        return
      }
      playTimeoutRef.current = setTimeout(tick, tickMs)
    }
    tick()
  }

  useEffect(() => stopPlayback, [stopPlayback])

  const exportText = useMemo(() => buildExportText({ ...song, updatedAt: 0 }), [song])

  const activeSectionId = useMemo(() => {
    const m = playhead?.m ?? selected?.focus.m
    if (m == null) return null
    return sectionRanges.find((r) => m >= r.startMeasure && m <= r.endMeasure)?.id ?? null
  }, [playhead, selected, sectionRanges])

  const totalSteps = measureCount * COLS_PER_MEASURE
  const playProgress = playhead ? globalCol(playhead.m, playhead.c) / Math.max(1, totalSteps - 1) : null
  const measureNotes = song.measureNotes ?? []

  return (
    <div className="flex flex-col md:flex-row items-start">
      <SongSidebar
        songs={librarySongs}
        currentSongId={song.id}
        isAutosaved={!dirty}
        onLoad={loadSongFromLibrary}
        onDelete={deleteSongFromLibrary}
        onNew={newSong}
        onSave={handleSave}
        onExport={exportLibrary}
        onImport={importLibrary}
      />

      <div className="min-w-0 flex-1 max-w-[1100px] mx-auto px-5 pt-6 pb-24">
        <input
          className="block w-full bg-transparent border-none outline-none font-display font-semibold text-[2.25rem] leading-tight tracking-tight text-ink py-1 mb-3 placeholder-ink-faint"
          value={title}
          onChange={(e) => dispatch({ type: 'set-title', title: e.target.value })}
          placeholder="Untitled Song"
        />

        {/* Pinned so the track switcher and section jump stay reachable
            while scrolling a long tab — only the score body scrolls
            underneath. Add-measure/add-section live in the bottom transport
            bar alongside playback, so every editing action stays in one
            fixed place regardless of scroll position. */}
        <div data-keep-selection className="sticky top-0 z-20 bg-plate pt-1 pb-3 -mx-5 px-5 border-b border-hairline-strong">
          <TrackTabs
            tracks={tracks}
            activeTrackId={activeTrackId}
            onSelect={setActiveTrackId}
            onRename={(id, name) => dispatch({ type: 'rename-track', id, name })}
            onEditTuning={setTuningEditorTrackId}
            onRemove={removeTrack}
            onAdd={addTrack}
          />

          <SectionNav
            sectionRanges={sectionRanges}
            activeSectionId={activeSectionId}
            canPaste={clip?.kind === 'tab-editor/section'}
            onJump={jumpToSection}
            onAddAt={(m) => dispatch({ type: 'add-section-after', m })}
            onPasteAt={pasteSectionAt}
            onLink={(id, to) => dispatch({ type: 'link-section', id, to })}
            onUnlink={(id) => dispatch({ type: 'unlink-section', id })}
          />
        </div>

        {activeTrack && (
          <TabGrid
            className="mt-4"
            track={activeTrack}
            sectionRanges={sectionRanges}
            measureCount={measureCount}
            measureNotes={measureNotes}
            canDeleteSection={sections.length > 1}
            selected={selected}
            playhead={playhead}
            gridRef={gridRef}
            onCellMouseDown={handleCellMouseDown}
            onCellEnter={handleCellEnter}
            onDeleteMeasure={deleteMeasure}
            onInsertMeasureAfter={(m) => dispatch({ type: 'insert-measure', after: m })}
            onRenameSection={(id, name) => dispatch({ type: 'rename-section', id, name })}
            onCommentChange={(id, text) => dispatch({ type: 'set-section-comment', id, text })}
            onTrackCommentChange={(id, text) =>
              dispatch({ type: 'set-section-comment', id, trackId: activeTrack.id, text })
            }
            onCopySection={copySection}
            onDeleteSection={(id) => dispatch({ type: 'delete-section', id })}
            onSetTrackLoop={(sectionId, unit) => dispatch({ type: 'set-track-loop', trackId: activeTrack.id, sectionId, unit })}
            onSetMeasureNote={(m, text) => dispatch({ type: 'set-measure-note', m, text })}
            onKeyDown={handleKeyDown}
            registerSectionRef={(id, el) => {
              sectionRefs.current[id] = el
            }}
          />
        )}

        {tuningEditorTrackId !== null && (
          <TuningEditor
            trackName={tracks.find((t) => t.id === tuningEditorTrackId)?.name ?? ''}
            tuning={tracks.find((t) => t.id === tuningEditorTrackId)?.tuning ?? []}
            onChange={(next) => dispatch({ type: 'set-track-tuning', id: tuningEditorTrackId, tuning: next })}
            onClose={() => setTuningEditorTrackId(null)}
          />
        )}

        <ExportPanel text={exportText} />
      </div>

      <YoutubeSyncPanel
        ref={ytRef}
        youtube={youtube}
        anchorMeasure={selected?.focus.m ?? playhead?.m ?? 0}
        onSetVideo={(videoId) => dispatch({ type: 'set-youtube-video', videoId })}
        onSetAnchor={(measure, seconds) => dispatch({ type: 'set-youtube-anchor', measure, seconds })}
      />

      <TransportBar
        bpm={bpm}
        onBpmChange={(b) => dispatch({ type: 'set-bpm', bpm: b })}
        isPlaying={isPlaying}
        hasSelection={selected !== null}
        progress={playProgress}
        onPlay={() => startPlayback(selected ? globalCol(selected.focus.m, selected.focus.c) : 0)}
        onPlayFromStart={() => startPlayback(0)}
        onStop={stopPlayback}
        onSeek={(fraction) => startPlayback(Math.round(fraction * (totalSteps - 1)))}
        onAddMeasure={() => dispatch({ type: 'insert-measure', after: measureCount - 1 })}
        onAddSection={addSectionHere}
      />

      <Toast message={toastMsg} />
    </div>
  )
}
