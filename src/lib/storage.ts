import type { Song } from '../types'

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

export function loadSong(id: string): Song | null {
  return readLibrary()[id] ?? null
}

export function getLastOpenedId(): string | null {
  return localStorage.getItem(LAST_OPENED_KEY)
}

export function setLastOpenedId(id: string): void {
  localStorage.setItem(LAST_OPENED_KEY, id)
}
