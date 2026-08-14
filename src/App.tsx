import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import {
  COLS_PER_MEASURE,
  advanceIdCounter,
  chunkMeasures,
  defaultTuning,
  makeMeasures,
  makeTrack,
  nextId,
  stringMidi,
} from './lib/instruments'
import { midiToFreq, midiToNoteName } from './lib/tunings'
import { playNote, resumeAudio, now } from './lib/audio'
import * as storage from './lib/storage'
import type { Playhead, Section, Selection, Song, Track } from './types'
import Toolbar from './components/Toolbar'
import TrackTabs from './components/TrackTabs'
import SectionNav from './components/SectionNav'
import TabGrid from './components/TabGrid'
import TuningEditor from './components/TuningEditor'
import SongSidebar from './components/SongSidebar'
import ExportPanel from './components/ExportPanel'

interface SectionRangeInternal extends Section {
  endMeasure: number
}

function sectionRangesFor(sections: Section[], measureCount: number): SectionRangeInternal[] {
  const sorted = [...sections].sort((a, b) => a.startMeasure - b.startMeasure)
  return sorted.map((sec, i) => ({
    ...sec,
    endMeasure: (sorted[i + 1]?.startMeasure ?? measureCount) - 1,
  }))
}

function dedupeSections(sections: Section[]): Section[] {
  const seen = new Set<number>()
  return sections.filter((s) => {
    if (seen.has(s.startMeasure)) return false
    seen.add(s.startMeasure)
    return true
  })
}

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

  const [songId, setSongId] = useState(initial.id)
  const [title, setTitle] = useState(initial.title)
  const [measureCount, setMeasureCount] = useState(initial.measureCount)
  const [sections, setSections] = useState<Section[]>(initial.sections)
  const [tracks, setTracks] = useState<Track[]>(initial.tracks)
  const [activeTrackId, setActiveTrackId] = useState<number>(initial.tracks[0]?.id)
  const [bpm, setBpm] = useState(initial.bpm)

  const [selected, setSelected] = useState<Selection | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playhead, setPlayhead] = useState<Playhead | null>(null)
  const [copyStatus, setCopyStatus] = useState('')
  const [saveStatus, setSaveStatus] = useState('')
  const [tuningEditorTrackId, setTuningEditorTrackId] = useState<number | null>(null)
  const [librarySongs, setLibrarySongs] = useState<Song[]>(() => storage.listSongs())

  const playTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sectionRefs = useRef<Record<number, HTMLDivElement | null>>({})

  useEffect(() => {
    const maxId = Math.max(0, ...initial.sections.map((s) => s.id), ...initial.tracks.map((t) => t.id))
    advanceIdCounter(maxId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('[data-cell]')) setSelected(null)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  const activeTrack = tracks.find((t) => t.id === activeTrackId) ?? tracks[0]
  const sectionRanges = useMemo(() => sectionRangesFor(sections, measureCount), [sections, measureCount])

  // A linked section resolves to its source; everything else resolves to itself.
  const resolveRange = useCallback(
    (sec: SectionRangeInternal): SectionRangeInternal =>
      sec.linkTo != null ? sectionRanges.find((r) => r.id === sec.linkTo) ?? sec : sec,
    [sectionRanges]
  )

  // Effective loop length of a track over a section: 0 = play through.
  const loopLenFor = useCallback(
    (track: Track, sec: SectionRangeInternal): number => {
      const src = resolveRange(sec)
      const raw = track.loops?.[src.id] ?? 0
      const span = src.endMeasure - src.startMeasure + 1
      return raw > 0 && raw < span ? raw : 0
    },
    [resolveRange]
  )

  // Timeline measure → the measure that stores its content (linked sections read/write their source).
  const srcMeasureIndex = useCallback(
    (m: number): number => {
      const sec = sectionRanges.find((r) => m >= r.startMeasure && m <= r.endMeasure)
      if (!sec || sec.linkTo == null) return m
      const src = resolveRange(sec)
      return src === sec ? m : src.startMeasure + (m - sec.startMeasure)
    },
    [sectionRanges, resolveRange]
  )

  // Every timeline position that mirrors position m — m's own copy plus all linked
  // copies, at the same offset. Structural edits (insert/delete a bar) apply to all
  // of them so linked spans stay equal.
  const linkedPositions = useCallback(
    (m: number): number[] => {
      const sec = sectionRanges.find((r) => m >= r.startMeasure && m <= r.endMeasure)
      if (!sec) return [m]
      const srcId = sec.linkTo ?? sec.id
      const copies = sectionRanges.filter((r) => r.id === srcId || r.linkTo === srcId)
      if (copies.length <= 1) return [m]
      const off = m - sec.startMeasure
      return copies.map((r) => r.startMeasure + off)
    },
    [sectionRanges]
  )

  const activeLoops = useMemo(() => {
    const map: Record<number, number> = {}
    if (activeTrack) sectionRanges.forEach((sec) => (map[sec.id] = loopLenFor(activeTrack, sec)))
    return map
  }, [activeTrack, sectionRanges, loopLenFor])

  // A measure is a ghost for the active track when it falls past the track's
  // loop unit in a looped section: it renders/plays cycled content and can't be edited.
  const isGhostMeasure = useCallback(
    (m: number): boolean => {
      if (!activeTrack) return false
      const sec = sectionRanges.find((r) => m >= r.startMeasure && m <= r.endMeasure)
      if (!sec) return false
      const loop = loopLenFor(activeTrack, sec)
      return loop > 0 && m >= sec.startMeasure + loop
    },
    [activeTrack, sectionRanges, loopLenFor]
  )

  // What the grid renders: linked sections display their source's bars.
  const viewTrack = useMemo(() => {
    if (!activeTrack) return activeTrack
    return { ...activeTrack, measures: activeTrack.measures.map((_, m) => activeTrack.measures[srcMeasureIndex(m)]) }
  }, [activeTrack, srcMeasureIndex])

  const updateTrack = useCallback((trackId: number, updater: (t: Track) => Track) => {
    setTracks((prev) => prev.map((t) => (t.id === trackId ? updater(t) : t)))
  }, [])

  const setCell = useCallback(
    (trackId: number, m: number, c: number, s: number, value: string | null) => {
      updateTrack(trackId, (t) => {
        const measures = t.measures.map((measure) => measure.map((col) => col.slice()))
        measures[m][c][s] = value
        return { ...t, measures }
      })
    },
    [updateTrack]
  )

  // ---- measures ----
  const addMeasureAtEnd = () => insertMeasureAfter(measureCount - 1)

  const insertMeasureAfter = (m: number) => {
    const sec = sectionRanges.find((r) => m >= r.startMeasure && m <= r.endMeasure)
    const src = sec ? resolveRange(sec) : undefined
    const positions = linkedPositions(m)
    const desc = [...positions].sort((a, b) => b - a)
    setTracks((prev) =>
      prev.map((t) => {
        const measures = t.measures.slice()
        desc.forEach((p) => measures.splice(p + 1, 0, ...makeMeasures(t.tuning.length, 1)))
        // A bar inserted inside a track's loop unit grows that unit.
        let loops = t.loops
        if (sec && src) {
          const loop = loopLenFor(t, sec)
          if (loop > 0 && m - sec.startMeasure < loop) loops = { ...loops, [src.id]: loop + 1 }
        }
        return { ...t, measures, loops }
      })
    )
    setMeasureCount((n) => n + positions.length)
    setSections((prev) =>
      dedupeSections(
        prev.map((s) => {
          const shift = positions.filter((p) => s.startMeasure > p).length
          return shift ? { ...s, startMeasure: s.startMeasure + shift } : s
        })
      )
    )
  }

  const deleteMeasure = (m: number) => {
    const sec = sectionRanges.find((r) => m >= r.startMeasure && m <= r.endMeasure)
    const src = sec ? resolveRange(sec) : undefined
    const positions = linkedPositions(m)
    if (measureCount - positions.length < 1) return
    // Deleting the only bar of a linked group would leave dangling markers — remove the copy instead.
    if (sec && positions.length > 1 && sec.endMeasure === sec.startMeasure) return
    const drop = new Set(positions)
    const newCount = measureCount - positions.length
    setTracks((prev) =>
      prev.map((t) => {
        const measures = t.measures.filter((_, i) => !drop.has(i))
        let loops = t.loops
        if (sec && src) {
          const loop = loopLenFor(t, sec)
          if (loop > 0 && m - sec.startMeasure < loop) {
            loops = { ...loops }
            if (loop <= 1) delete loops[src.id]
            else loops[src.id] = loop - 1
          }
        }
        return { ...t, measures, loops }
      })
    )
    setMeasureCount(newCount)
    setSections((prev) => {
      const shifted = prev
        .map((s) => {
          const shift = positions.filter((p) => p < s.startMeasure).length
          return shift ? { ...s, startMeasure: s.startMeasure - shift } : s
        })
        .map((s) => (s.startMeasure >= newCount ? { ...s, startMeasure: newCount - 1 } : s))
      const deduped = dedupeSections(shifted).sort((a, b) => a.startMeasure - b.startMeasure)
      if (deduped[0].startMeasure !== 0) deduped[0] = { ...deduped[0], startMeasure: 0 }
      const ids = new Set(deduped.map((s) => s.id))
      return deduped.map((s) => (s.linkTo != null && !ids.has(s.linkTo) ? { ...s, linkTo: undefined } : s))
    })
    setSelected(null)
  }

  // ---- sections ----
  const addSectionAt = (m: number) => {
    if (sections.some((s) => s.startMeasure === m)) return
    // Splitting a linked section — or a source that has linked copies — would break the mirroring.
    const sec = sectionRanges.find((r) => m >= r.startMeasure && m <= r.endMeasure)
    if (sec && (sec.linkTo != null || sectionRanges.some((r) => r.linkTo === sec.id))) return
    setSections((prev) => [...prev, { id: nextId(), name: 'New Section', startMeasure: m, comment: '' }])
  }

  // Append a linked copy of a section at the end of the song. It occupies real
  // timeline bars but owns no content: reads and writes resolve to the source,
  // so edits anywhere apply everywhere. Linking a linked copy links its source.
  const addLinkedSection = (id: number) => {
    const target = sectionRanges.find((r) => r.id === id)
    if (!target) return
    const src = resolveRange(target)
    const span = src.endMeasure - src.startMeasure + 1
    const start = measureCount
    setTracks((prev) => prev.map((t) => ({ ...t, measures: [...t.measures, ...makeMeasures(t.tuning.length, span)] })))
    setMeasureCount((c) => c + span)
    setSections((prev) => [...prev, { id: nextId(), name: src.name, startMeasure: start, comment: '', linkTo: src.id }])
  }

  // Start a new section at measure m. If m is past the end, or another section
  // already starts there (splitting after a middle section), a fresh measure is
  // inserted at m first — shifting later sections right — so the new section is
  // never empty and never collides.
  const addSectionAfter = (m: number) => {
    const collision = sections.some((s) => s.startMeasure === m)
    if (m >= measureCount || collision) {
      setTracks((prev) =>
        prev.map((t) => {
          const measures = t.measures.slice()
          measures.splice(m, 0, ...makeMeasures(t.tuning.length, 1))
          return { ...t, measures }
        })
      )
      setMeasureCount((n) => n + 1)
      setSections((prev) => [
        ...prev.map((s) => (s.startMeasure >= m ? { ...s, startMeasure: s.startMeasure + 1 } : s)),
        { id: nextId(), name: 'New Section', startMeasure: m, comment: '' },
      ])
    } else {
      addSectionAt(m)
    }
  }

  const renameSection = (id: number, name: string) => {
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, name } : s)))
  }

  const updateSectionComment = (id: number, comment: string) => {
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, comment } : s)))
  }

  // ×N for the active track over a section. N=1 turns the loop off. N>1 locks the
  // track's current bars in as its loop unit and grows the section timeline to
  // unit×N — other tracks gain real, editable bars there. Lowering N trims the
  // section tail, but only when no track would lose written content.
  const setTrackRepeat = (sectionId: number, times: number) => {
    if (!activeTrack) return
    const target = sectionRanges.find((r) => r.id === sectionId)
    if (!target) return
    const sec = resolveRange(target) // a linked copy's ×N acts on its source
    const span = sec.endMeasure - sec.startMeasure + 1
    const n = Math.max(1, Math.min(99, Math.round(times) || 1))
    const unit = loopLenFor(activeTrack, sec) || span
    // Every linked copy resizes in lockstep with the source.
    const copies = sectionRanges.filter((r) => r.id === sec.id || r.linkTo === sec.id)
    updateTrack(activeTrack.id, (t) => {
      const loops = { ...(t.loops ?? {}) }
      if (n > 1) loops[sec.id] = unit
      else delete loops[sec.id]
      return { ...t, loops }
    })
    setSelected(null)
    if (n === 1) return
    const desired = unit * n
    if (desired > span) {
      const extra = desired - span
      const ats = copies.map((r) => r.endMeasure + 1).sort((a, b) => b - a)
      setTracks((prev) =>
        prev.map((t) => {
          const measures = t.measures.slice()
          ats.forEach((at) => measures.splice(at, 0, ...makeMeasures(t.tuning.length, extra)))
          return { ...t, measures }
        })
      )
      setMeasureCount((c) => c + extra * copies.length)
      setSections((prev) =>
        prev.map((s) => {
          const shift = ats.filter((at) => s.startMeasure >= at).length * extra
          return shift ? { ...s, startMeasure: s.startMeasure + shift } : s
        })
      )
    } else if (desired < span) {
      const cnt = span - desired
      const froms = copies.map((r) => r.startMeasure + desired)
      const safe = tracks.every((t) => {
        const tLoop = t.id === activeTrack.id ? unit : loopLenFor(t, sec)
        if (tLoop > 0 && tLoop <= desired) return true // cycled bars for this track — nothing real is shown there
        return froms.every((from) =>
          t.measures.slice(from, from + cnt).every((measure) => measure.every((col) => col.every((v) => v === null || v === '')))
        )
      })
      if (!safe) return
      const drop = new Set(froms.flatMap((from) => Array.from({ length: cnt }, (_, i) => from + i)))
      setTracks((prev) => prev.map((t) => ({ ...t, measures: t.measures.filter((_, i) => !drop.has(i)) })))
      setMeasureCount((c) => c - cnt * copies.length)
      setSections((prev) =>
        prev.map((s) => {
          const shift = froms.filter((from) => s.startMeasure > from).length * cnt
          return shift ? { ...s, startMeasure: s.startMeasure - shift } : s
        })
      )
    }
  }

  const deleteSection = (id: number) => {
    const sec = sectionRanges.find((r) => r.id === id)
    if (!sec) return

    // A linked copy owns no content — removing it removes its bars too.
    if (sec.linkTo != null) {
      const span = sec.endMeasure - sec.startMeasure + 1
      if (measureCount - span < 1) return
      setTracks((prev) =>
        prev.map((t) => ({ ...t, measures: t.measures.filter((_, i) => i < sec.startMeasure || i > sec.endMeasure) }))
      )
      setMeasureCount((c) => c - span)
      setSections((prev) => {
        const next = prev
          .filter((s) => s.id !== id)
          .map((s) => (s.startMeasure > sec.endMeasure ? { ...s, startMeasure: s.startMeasure - span } : s))
          .sort((a, b) => a.startMeasure - b.startMeasure)
        if (next[0].startMeasure !== 0) next[0] = { ...next[0], startMeasure: 0 }
        return next
      })
      setSelected(null)
      return
    }

    if (sections.length <= 1) return
    // Removing a source marker merges its bars into the previous section, so its
    // linked copies materialize first: content and loops are written into their
    // own bars and they become ordinary sections.
    const mirrors = sectionRanges.filter((r) => r.linkTo === id)
    if (mirrors.length) {
      const span = sec.endMeasure - sec.startMeasure + 1
      setTracks((prev) =>
        prev.map((t) => {
          const measures = t.measures.slice()
          mirrors.forEach((mr) => {
            for (let off = 0; off < span; off++) {
              measures[mr.startMeasure + off] = measures[sec.startMeasure + off].map((col) => col.slice())
            }
          })
          let loops = t.loops
          if (loops?.[id]) {
            loops = { ...loops }
            mirrors.forEach((mr) => (loops![mr.id] = t.loops![id]))
          }
          return { ...t, measures, loops }
        })
      )
    }
    setSections((prev) => {
      const next = prev
        .filter((s) => s.id !== id)
        .map((s) => (s.linkTo === id ? { ...s, linkTo: undefined } : s))
        .sort((a, b) => a.startMeasure - b.startMeasure)
      if (next[0].startMeasure !== 0) next[0] = { ...next[0], startMeasure: 0 }
      return next
    })
    setTracks((prev) =>
      prev.map((t) => {
        if (!t.loops?.[id]) return t
        const loops = { ...t.loops }
        delete loops[id]
        return { ...t, loops }
      })
    )
  }

  const jumpToSection = (id: number) => {
    sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // ---- tracks ----
  const addTrack = () => {
    const t = makeTrack(`Track ${tracks.length + 1}`, defaultTuning(), measureCount)
    setTracks((prev) => [...prev, t])
    setActiveTrackId(t.id)
    setTuningEditorTrackId(t.id)
  }

  const removeTrack = (id: number) => {
    if (tracks.length <= 1) return
    setTracks((prev) => prev.filter((t) => t.id !== id))
    if (activeTrackId === id) {
      const remaining = tracks.filter((t) => t.id !== id)
      setActiveTrackId(remaining[0]?.id)
    }
    if (tuningEditorTrackId === id) setTuningEditorTrackId(null)
  }

  const renameTrack = (id: number, name: string) => updateTrack(id, (t) => ({ ...t, name }))

  const setTrackTuning = (id: number, newTuning: Track['tuning']) => {
    updateTrack(id, (t) => {
      const len = newTuning.length
      const measures = t.measures.map((measure) =>
        measure.map((col) => {
          const next = col.slice(0, len)
          while (next.length < len) next.push(null)
          return next
        })
      )
      return { ...t, tuning: newTuning, measures }
    })
  }

  // ---- song lifecycle ----
  const clearAll = () => {
    if (!window.confirm('Clear the whole song? This removes all tracks and sections.')) return
    stopPlayback()
    const blank = blankSong()
    setSongId(blank.id)
    setTitle(blank.title)
    setMeasureCount(blank.measureCount)
    setSections(blank.sections)
    setTracks(blank.tracks)
    setActiveTrackId(blank.tracks[0].id)
    setSelected(null)
    setTuningEditorTrackId(null)
  }

  const buildSnapshot = (): Song => ({
    id: songId,
    title,
    bpm,
    measureCount,
    sections,
    tracks,
    updatedAt: Date.now(),
  })

  const handleSave = () => {
    storage.saveSong(buildSnapshot())
    setLibrarySongs(storage.listSongs())
    setSaveStatus('Saved!')
    setTimeout(() => setSaveStatus(''), 2000)
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
    let status: string
    try {
      const count = storage.importLibrary(await file.text())
      setLibrarySongs(storage.listSongs())
      status = `Imported ${count}`
    } catch {
      status = 'Import failed'
    }
    setSaveStatus(status)
    setTimeout(() => setSaveStatus(''), 2000)
  }

  const applySong = (song: Song) => {
    stopPlayback()
    const maxId = Math.max(0, ...song.sections.map((s) => s.id), ...song.tracks.map((t) => t.id))
    advanceIdCounter(maxId)
    setSongId(song.id)
    setTitle(song.title)
    setBpm(song.bpm)
    setMeasureCount(song.measureCount)
    setSections(song.sections)
    setTracks(song.tracks)
    setActiveTrackId(song.tracks[0]?.id)
    setSelected(null)
    setTuningEditorTrackId(null)
  }

  const loadSongFromLibrary = (id: string) => {
    const song = storage.loadSong(id)
    if (!song) return
    storage.setLastOpenedId(id)
    applySong(song)
  }

  const deleteSongFromLibrary = (id: string) => {
    storage.deleteSong(id)
    setLibrarySongs(storage.listSongs())
  }

  const newSong = () => {
    stopPlayback()
    const blank = blankSong()
    setSongId(blank.id)
    setTitle(blank.title)
    setBpm(blank.bpm)
    setMeasureCount(blank.measureCount)
    setSections(blank.sections)
    setTracks(blank.tracks)
    setActiveTrackId(blank.tracks[0].id)
    setSelected(null)
    setTuningEditorTrackId(null)
  }

  // ---- keyboard editing (active track only) ----
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      // Don't hijack typing in text fields (section names, comments, repeat counts).
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
      if (!selected || !activeTrack) return
      const { m, c, s } = selected
      // Cells in a linked section read and write their source's measure.
      const mm = srcMeasureIndex(m)
      const measure = activeTrack.measures[mm]

      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault()
        const current = measure[c][s]
        let next = current === null ? e.key : String(Number(current + e.key))
        if (next.length > 2 || Number(next) > 24) next = e.key
        setCell(activeTrack.id, mm, c, s, next)
        return
      }
      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault()
        setCell(activeTrack.id, mm, c, s, null)
        return
      }
      const moveTo = (nm: number, nc: number, ns: number) => {
        e.preventDefault()
        setSelected({ m: nm, c: nc, s: ns })
      }
      if (e.key === 'ArrowUp') {
        if (s > 0) moveTo(m, c, s - 1)
        return
      }
      if (e.key === 'ArrowDown') {
        if (s < activeTrack.tuning.length - 1) moveTo(m, c, s + 1)
        return
      }
      // Ghost measures (a looped track's cycled bars) aren't editable — skip them.
      const nextEditableMeasure = (from: number, dir: 1 | -1): number | null => {
        for (let mm = from; mm >= 0 && mm < measureCount; mm += dir) {
          if (!isGhostMeasure(mm)) return mm
        }
        return null
      }
      if (e.key === 'ArrowLeft' || (e.key === 'Tab' && e.shiftKey)) {
        e.preventDefault()
        if (c > 0) moveTo(m, c - 1, s)
        else {
          const pm = nextEditableMeasure(m - 1, -1)
          if (pm !== null) moveTo(pm, COLS_PER_MEASURE - 1, s)
        }
        return
      }
      if (e.key === 'ArrowRight' || e.key === 'Tab') {
        e.preventDefault()
        if (c < COLS_PER_MEASURE - 1) {
          moveTo(m, c + 1, s)
          return
        }
        const nm = nextEditableMeasure(m + 1, 1)
        if (nm !== null) moveTo(nm, 0, s)
        else {
          const lastSec = sectionRanges[sectionRanges.length - 1]
          if (lastSec && lastSec.linkTo == null && loopLenFor(activeTrack, lastSec) === 0) {
            addMeasureAtEnd()
            moveTo(measureCount, 0, s)
          }
        }
        return
      }
      if (e.key === 'Escape') setSelected(null)
    },
    [selected, activeTrack, measureCount, setCell, sectionRanges, isGhostMeasure, loopLenFor, srcMeasureIndex]
  )

  // ---- playback: mixes every track together ----
  const stopPlayback = useCallback(() => {
    if (playTimeoutRef.current) clearTimeout(playTimeoutRef.current)
    playTimeoutRef.current = null
    setIsPlaying(false)
    setPlayhead(null)
  }, [])

  const startPlayback = () => {
    resumeAudio()
    setIsPlaying(true)
    const stepMs = (60 / bpm / 2) * 1000 // 8th notes

    const totalSteps = measureCount * COLS_PER_MEASURE
    let i = 0

    const step = () => {
      if (i >= totalSteps) {
        stopPlayback()
        return
      }
      const m = Math.floor(i / COLS_PER_MEASURE)
      const c = i % COLS_PER_MEASURE
      setPlayhead({ m, c })
      const t = now()
      tracks.forEach((track) => {
        // A linked section plays its source; a looping track cycles its loop unit.
        const sec = sectionRanges.find((r) => m >= r.startMeasure && m <= r.endMeasure)
        const src = sec ? resolveRange(sec) : undefined
        const loop = src ? loopLenFor(track, src) : 0
        const off = sec ? m - sec.startMeasure : 0
        const tm = sec && src ? src.startMeasure + (loop > 0 ? off % loop : off) : m
        const col = track.measures[tm]?.[c]
        if (!col) return
        col.forEach((fret, s) => {
          if (fret === null || fret === '') return
          const freq = midiToFreq(stringMidi(track.tuning[s]) + Number(fret))
          playNote(freq, t)
        })
      })
      i += 1
      playTimeoutRef.current = setTimeout(step, stepMs)
    }
    step()
  }

  useEffect(() => stopPlayback, [stopPlayback])

  // ---- export ----
  const exportText = useMemo(() => {
    const parts = [`# ${title}`, '']
    tracks.forEach((track) => {
      parts.push(`-- ${track.name} --`)
      sectionRanges.forEach((sec) => {
        const src = resolveRange(sec)
        const loop = loopLenFor(track, src)
        const span = src.endMeasure - src.startMeasure + 1
        const loopSuffix = loop > 0 ? ` x${Math.ceil(span / loop)}` : ''
        const measureIndices = Array.from({ length: loop > 0 ? loop : span }, (_, off) => src.startMeasure + off)
        const isEmpty = measureIndices.every((m) =>
          (track.measures[m] ?? []).every((col) => col.every((fret) => fret === null || fret === ''))
        )
        if (isEmpty) return
        // A linked section prints a reference to its source instead of repeating the bars.
        if (src !== sec) {
          parts.push(`== ${sec.name} = ${src.name}${loopSuffix} ==`, '')
          return
        }
        parts.push(`== ${sec.name}${loopSuffix} ==`)
        if (sec.comment) parts.push(`# ${sec.comment}`)
        // One column width for the whole section: any 2-digit fret widens every column.
        const width = Math.max(
          2,
          ...measureIndices.flatMap((m) =>
            (track.measures[m] ?? []).map(
              (col) => Math.max(...col.map((fret) => (fret === null ? 1 : String(fret).length))) + 1
            )
          )
        )
        chunkMeasures(measureIndices).forEach((lineMeasures) => {
          const lines = track.tuning.map((str) => midiToNoteName(stringMidi(str)).padEnd(2, ' ') + '|')
          lineMeasures.forEach((m) => {
            const measure = track.measures[m]
            if (!measure) return
            measure.forEach((col, ci) => {
              col.forEach((fret, s) => {
                const label = fret === null ? '-' : String(fret)
                lines[s] += (ci === 0 ? ' ' : '') + label.padEnd(width, ' ')
              })
            })
            lines.forEach((_, s) => (lines[s] += '|'))
          })
          parts.push(...lines)
          parts.push('')
        })
      })
    })
    return parts.join('\n')
  }, [title, sectionRanges, tracks, loopLenFor, resolveRange])

  const copyExport = async () => {
    try {
      await navigator.clipboard.writeText(exportText)
      setCopyStatus('Copied!')
    } catch {
      setCopyStatus('Copy failed — select the text manually')
    }
    setTimeout(() => setCopyStatus(''), 2000)
  }

  const isSongSaved = librarySongs.some((s) => s.id === songId)

  return (
    <div className="flex items-start">
      <SongSidebar
        songs={librarySongs}
        currentSongId={songId}
        onLoad={loadSongFromLibrary}
        onDelete={deleteSongFromLibrary}
        onNew={newSong}
        onSave={handleSave}
        onExport={exportLibrary}
        onImport={importLibrary}
        saveStatus={saveStatus}
      />

      <div className="min-w-0 flex-1 max-w-[1100px] mx-auto px-5 pt-6 pb-16">
        <Toolbar
          title={title}
          onTitleChange={setTitle}
          bpm={bpm}
          onBpmChange={setBpm}
          isPlaying={isPlaying}
          onPlay={startPlayback}
          onStop={stopPlayback}
          onAddMeasure={addMeasureAtEnd}
          onAddSection={() => addSectionAt(selected ? selected.m : measureCount - 1)}
          onClear={clearAll}
          onCopy={copyExport}
          copyStatus={copyStatus}
          onSave={handleSave}
          saveStatus={saveStatus}
          isSaved={isSongSaved}
        />

        <TrackTabs
          tracks={tracks}
          activeTrackId={activeTrackId}
          onSelect={setActiveTrackId}
          onRename={renameTrack}
          onEditTuning={setTuningEditorTrackId}
          onRemove={removeTrack}
          onAdd={addTrack}
        />

        <SectionNav sectionRanges={sectionRanges} onJump={jumpToSection} />

        {activeTrack && (
          <TabGrid
            activeTrack={viewTrack ?? activeTrack}
            sectionRanges={sectionRanges}
            measureCount={measureCount}
            canDeleteSection={sections.length > 1}
            selected={selected}
            playhead={playhead}
            onSelectCell={(m, c, s) =>
              setSelected((prev) => (prev && prev.m === m && prev.c === c && prev.s === s ? null : { m, c, s }))
            }
            onDeleteMeasure={deleteMeasure}
            onInsertMeasureAfter={insertMeasureAfter}
            onAddSectionAfter={addSectionAfter}
            onLinkSection={addLinkedSection}
            onRenameSection={renameSection}
            onCommentChange={updateSectionComment}
            activeLoops={activeLoops}
            onRepeatChange={setTrackRepeat}
            onDeleteSection={deleteSection}
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
            onChange={(next) => setTrackTuning(tuningEditorTrackId, next)}
            onClose={() => setTuningEditorTrackId(null)}
          />
        )}

        <ExportPanel text={exportText} />
      </div>
    </div>
  )
}
