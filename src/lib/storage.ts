import type { Measure, Section, Song, Track } from '../types'
import { makeMeasure } from './instruments'
import { sectionRangesFor } from './songOps'

const LIBRARY_KEY = 'tab-editor:songs'
const LAST_OPENED_KEY = 'tab-editor:last-opened'

// Section.linkTo and Track.loops are live, reducer-driven features now.
// Only the old global per-section `repeat` has no live equivalent; migrateSong
// rewrites it into written-out bars (plus an equivalent per-track loop) once, on load.
interface LegacySection extends Section {
  /** global per-section repeat, replayed for every track */
  repeat?: number
}

function readLibrary(): Record<string, Song> {
  try {
    const raw = localStorage.getItem(LIBRARY_KEY)
    return raw ? (JSON.parse(raw) as Record<string, Song>) : {}
  } catch {
    return {}
  }
}

function writeLibrary(lib: Record<string, Song>): void {
  localStorage.setItem(LIBRARY_KEY, JSON.stringify(lib))
}

export function saveSong(song: Song): void {
  const lib = readLibrary()
  lib[song.id] = song
  writeLibrary(lib)
  localStorage.setItem(LAST_OPENED_KEY, song.id)
}

export function deleteSong(id: string): void {
  const lib = readLibrary()
  delete lib[id]
  writeLibrary(lib)
  if (localStorage.getItem(LAST_OPENED_KEY) === id) {
    localStorage.removeItem(LAST_OPENED_KEY)
  }
}

export function listSongs(): Song[] {
  return Object.values(readLibrary()).sort((a, b) => b.updatedAt - a.updatedAt)
}

// Legacy global `repeat` becomes written-out measures plus an equivalent
// per-track loop (same live field the reducer maintains going forward).
function migrateLegacyRepeat(song: Song): Song {
  const legacySections = song.sections as LegacySection[]
  if (!legacySections.some((s) => (s.repeat ?? 1) > 1)) return song
  const sorted = [...legacySections].sort((a, b) => a.startMeasure - b.startMeasure)
  const tracks = song.tracks.map((t) => ({
    ...t,
    loops: { ...(t.loops ?? {}) },
    measures: t.measures.slice(),
  }))
  const sections: LegacySection[] = []
  let measureCount = song.measureCount
  let offset = 0
  sorted.forEach((sec, i) => {
    const start = sec.startMeasure + offset
    const end = (sorted[i + 1]?.startMeasure ?? song.measureCount) - 1 + offset
    const len = end - start + 1
    const repeat = Math.max(1, sec.repeat ?? 1)
    const { repeat: _repeat, ...rest } = sec
    sections.push({ ...rest, startMeasure: start })
    if (repeat > 1 && len > 0) {
      tracks.forEach((t) => {
        const block = t.measures.slice(start, end + 1)
        const copies: Measure[] = []
        for (let r = 1; r < repeat; r++) copies.push(...block.map((measure) => measure.map((col) => col.slice())))
        t.measures.splice(end + 1, 0, ...copies)
        t.loops[sec.id] = len
      })
      offset += len * (repeat - 1)
      measureCount += len * (repeat - 1)
    }
  })
  return { ...song, sections, tracks, measureCount }
}

// linkTo and loops are live fields the reducer keeps in sync as the user
// edits — this just self-heals on load in case saved data ever drifted, and
// keeps both fields (nothing is stripped).
function resyncLiveFeatures(song: Song): Song {
  const ranges = sectionRangesFor(song.sections, song.measureCount)
  const tracks: Track[] = song.tracks.map((t) => {
    const measures = t.measures.map((measure) => measure.map((col) => col.slice()))
    ranges.forEach((r) => {
      const span = r.endMeasure - r.startMeasure + 1
      const unit = t.loops?.[r.id] ?? 0
      if (unit < 1 || unit >= span) return
      for (let off = unit; off < span; off++) {
        const from = measures[r.startMeasure + (off % unit)]
        measures[r.startMeasure + off] = from ? from.map((col) => col.slice()) : makeMeasure(t.tuning.length)
      }
    })
    return { ...t, measures }
  })
  ranges.forEach((r) => {
    if (r.linkTo == null) return
    const src = ranges.find((x) => x.id === r.linkTo)
    if (!src) return
    const span = r.endMeasure - r.startMeasure + 1
    if (span !== src.endMeasure - src.startMeasure + 1) return
    tracks.forEach((t) => {
      for (let off = 0; off < span; off++) {
        const from = t.measures[src.startMeasure + off]
        t.measures[r.startMeasure + off] = from ? from.map((col) => col.slice()) : makeMeasure(t.tuning.length)
      }
    })
  })
  return { ...song, tracks }
}

export function migrateSong(song: Song): Song {
  return resyncLiveFeatures(migrateLegacyRepeat(song))
}

export function loadSong(id: string): Song | null {
  const song = readLibrary()[id]
  return song ? migrateSong(song) : null
}

export function exportLibrary(): string {
  return JSON.stringify(readLibrary(), null, 2)
}

function isSong(v: unknown): v is Song {
  const s = v as Song
  return (
    !!s &&
    typeof s === 'object' &&
    typeof s.id === 'string' &&
    typeof s.title === 'string' &&
    typeof s.measureCount === 'number' &&
    Array.isArray(s.tracks) &&
    Array.isArray(s.sections)
  )
}

// Accepts a full library export, an array of songs, or a single song.
// Merges by song id (imported wins) and returns how many songs were imported.
export function importLibrary(json: string): number {
  const parsed: unknown = JSON.parse(json)
  const songs = isSong(parsed)
    ? [parsed]
    : (Array.isArray(parsed) ? parsed : parsed && typeof parsed === 'object' ? Object.values(parsed) : []).filter(isSong)
  if (songs.length === 0) throw new Error('no songs in file')
  const lib = readLibrary()
  songs.forEach((s) => (lib[s.id] = s))
  writeLibrary(lib)
  return songs.length
}

export function getLastOpenedId(): string | null {
  return localStorage.getItem(LAST_OPENED_KEY)
}

export function setLastOpenedId(id: string): void {
  localStorage.setItem(LAST_OPENED_KEY, id)
}
