import type { Measure, Section, Song } from '../types'

const LIBRARY_KEY = 'tab-editor:songs'
const LAST_OPENED_KEY = 'tab-editor:last-opened'

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

// Legacy songs stored a global per-section `repeat` that replayed the same
// measures for every track. Rewrite that as written-out measures (content
// duplicated) with every track looping the original span — sounds identical,
// but tracks can now diverge by turning their loop off and editing the copies.
export function migrateSong(song: Song): Song {
  if (!song.sections.some((s) => (s.repeat ?? 1) > 1)) return song
  const sorted = [...song.sections].sort((a, b) => a.startMeasure - b.startMeasure)
  const tracks = song.tracks.map((t) => ({ ...t, loops: { ...(t.loops ?? {}) }, measures: t.measures.slice() }))
  const sections: Section[] = []
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
