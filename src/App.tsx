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
    sections: [{ id: nextId(), name: 'Intro', startMeasure: 0, comment: '', repeat: 1 }],
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

  const activeTrack = tracks.find((t) => t.id === activeTrackId) ?? tracks[0]
  const sectionRanges = useMemo(() => sectionRangesFor(sections, measureCount), [sections, measureCount])

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
  const addMeasureAtEnd = () => {
    setTracks((prev) => prev.map((t) => ({ ...t, measures: [...t.measures, ...makeMeasures(t.tuning.length, 1)] })))
    setMeasureCount((n) => n + 1)
  }

  const insertMeasureAfter = (m: number) => {
    setTracks((prev) =>
      prev.map((t) => {
        const measures = t.measures.slice()
        measures.splice(m + 1, 0, ...makeMeasures(t.tuning.length, 1))
        return { ...t, measures }
      })
    )
    setMeasureCount((n) => n + 1)
    setSections((prev) => dedupeSections(prev.map((s) => (s.startMeasure > m ? { ...s, startMeasure: s.startMeasure + 1 } : s))))
  }

  const deleteMeasure = (m: number) => {
    if (measureCount <= 1) return
    setTracks((prev) => prev.map((t) => ({ ...t, measures: t.measures.filter((_, i) => i !== m) })))
    setMeasureCount((n) => n - 1)
    setSections((prev) => dedupeSections(prev.map((s) => (s.startMeasure > m ? { ...s, startMeasure: s.startMeasure - 1 } : s))))
    setSelected(null)
  }

  // ---- sections ----
  const addSectionAt = (m: number) => {
    if (sections.some((s) => s.startMeasure === m)) return
    setSections((prev) => [...prev, { id: nextId(), name: 'New Section', startMeasure: m, comment: '', repeat: 1 }])
  }

  // Like addSectionAt, but if m falls past the last measure (e.g. splitting after
  // the final section), a fresh measure is appended first so the section isn't empty.
  const addSectionAfter = (m: number) => {
    if (m >= measureCount) addMeasureAtEnd()
    addSectionAt(m)
  }

  const renameSection = (id: number, name: string) => {
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, name } : s)))
  }

  const updateSectionComment = (id: number, comment: string) => {
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, comment } : s)))
  }

  const updateSectionRepeat = (id: number, repeat: number) => {
    const clamped = Math.max(1, Math.min(99, Math.round(repeat) || 1))
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, repeat: clamped } : s)))
  }

  const deleteSection = (id: number) => {
    setSections((prev) => {
      if (prev.length <= 1) return prev
      const next = prev.filter((s) => s.id !== id).sort((a, b) => a.startMeasure - b.startMeasure)
      if (next[0].startMeasure !== 0) next[0] = { ...next[0], startMeasure: 0 }
      return next
    })
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
    const blank = blankSong()
    setSongId(blank.id)
    setTitle(blank.title)
    setMeasureCount(blank.measureCount)
    setSections(blank.sections)
    setTracks(blank.tracks)
    setActiveTrackId(blank.tracks[0].id)
    setSelected(null)
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

  const applySong = (song: Song) => {
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
    const blank = blankSong()
    setSongId(blank.id)
    setTitle(blank.title)
    setBpm(blank.bpm)
    setMeasureCount(blank.measureCount)
    setSections(blank.sections)
    setTracks(blank.tracks)
    setActiveTrackId(blank.tracks[0].id)
    setSelected(null)
  }

  // ---- keyboard editing (active track only) ----
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (!selected || !activeTrack) return
      const { m, c, s } = selected
      const measure = activeTrack.measures[m]

      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault()
        const current = measure[c][s]
        let next = current === null ? e.key : current + e.key
        if (next.length > 2 || Number(next) > 24) next = e.key
        setCell(activeTrack.id, m, c, s, next)
        return
      }
      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault()
        setCell(activeTrack.id, m, c, s, null)
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
      if (e.key === 'ArrowLeft' || (e.key === 'Tab' && e.shiftKey)) {
        e.preventDefault()
        if (c > 0) moveTo(m, c - 1, s)
        else if (m > 0) moveTo(m - 1, COLS_PER_MEASURE - 1, s)
        return
      }
      if (e.key === 'ArrowRight' || e.key === 'Tab') {
        e.preventDefault()
        if (c < COLS_PER_MEASURE - 1) moveTo(m, c + 1, s)
        else if (m < measureCount - 1) moveTo(m + 1, 0, s)
        else {
          addMeasureAtEnd()
          moveTo(m + 1, 0, s)
        }
        return
      }
      if (e.key === 'Escape') setSelected(null)
    },
    [selected, activeTrack, measureCount, setCell]
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

    // Expand each section's measures according to its repeat count into one flat play order.
    const repeatedMeasures: number[] = []
    sectionRanges.forEach((sec) => {
      const range = Array.from({ length: sec.endMeasure - sec.startMeasure + 1 }, (_, off) => sec.startMeasure + off)
      const times = Math.max(1, sec.repeat ?? 1)
      for (let r = 0; r < times; r++) repeatedMeasures.push(...range)
    })

    const totalSteps = repeatedMeasures.length * COLS_PER_MEASURE
    let i = 0

    const step = () => {
      if (i >= totalSteps) {
        stopPlayback()
        return
      }
      const m = repeatedMeasures[Math.floor(i / COLS_PER_MEASURE)]
      const c = i % COLS_PER_MEASURE
      setPlayhead({ m, c })
      const t = now()
      tracks.forEach((track) => {
        const col = track.measures[m]?.[c]
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
        const repeatSuffix = sec.repeat && sec.repeat > 1 ? ` [x${sec.repeat}]` : ''
        parts.push(`== ${sec.name} (measures ${sec.startMeasure + 1}-${sec.endMeasure + 1})${repeatSuffix} ==`)
        if (sec.comment) parts.push(`# ${sec.comment}`)
        const measureIndices = Array.from(
          { length: sec.endMeasure - sec.startMeasure + 1 },
          (_, off) => sec.startMeasure + off
        )
        chunkMeasures(measureIndices).forEach((lineMeasures) => {
          const lines = track.tuning.map((str) => midiToNoteName(stringMidi(str)).padEnd(2, ' ') + '|')
          lineMeasures.forEach((m) => {
            const measure = track.measures[m]
            if (!measure) return
            measure.forEach((col) => {
              col.forEach((fret, s) => {
                const label = fret === null ? '-' : String(fret)
                lines[s] += label.padEnd(2, '-')
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
  }, [title, sectionRanges, tracks])

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
            activeTrack={activeTrack}
            sectionRanges={sectionRanges}
            measureCount={measureCount}
            canDeleteSection={sections.length > 1}
            selected={selected}
            playhead={playhead}
            onSelectCell={(m, c, s) => setSelected({ m, c, s })}
            onDeleteMeasure={deleteMeasure}
            onInsertMeasureAfter={insertMeasureAfter}
            onAddSectionAfter={addSectionAfter}
            onRenameSection={renameSection}
            onCommentChange={updateSectionComment}
            onRepeatChange={updateSectionRepeat}
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
