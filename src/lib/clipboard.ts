import type { Measure, RangeSelection, SectionRange, Track } from '../types'
import { COLS_PER_MEASURE } from './instruments'
import { deepCopyMeasures } from './songOps'

// A rectangular cell range: global columns (m * COLS_PER_MEASURE + c) so a
// selection crosses measure boundaries, string rows [s0..s1]. Inclusive.
export interface Rect {
  col0: number
  col1: number
  s0: number
  s1: number
}

export function globalCol(m: number, c: number): number {
  return m * COLS_PER_MEASURE + c
}

export function normalizeRect(sel: RangeSelection): Rect {
  const a = globalCol(sel.anchor.m, sel.anchor.c)
  const f = globalCol(sel.focus.m, sel.focus.c)
  return {
    col0: Math.min(a, f),
    col1: Math.max(a, f),
    s0: Math.min(sel.anchor.s, sel.focus.s),
    s1: Math.max(sel.anchor.s, sel.focus.s),
  }
}

export interface CellClipboard {
  kind: 'tab-editor/cells'
  rows: number
  cols: number
  /** data[row][col], row 0 = rect's top string */
  data: (string | null)[][]
}

export interface SectionClipboard {
  kind: 'tab-editor/section'
  name: string
  span: number
  comment?: string
  /** by track index at copy time */
  trackComments?: Record<number, string>
  tracks: { measures: Measure[] }[]
  /** measureNotes[off] for off in [0, span) */
  measureNotes?: string[]
  /** origin song — linking is only offered inside the same song */
  songId: string
  /** root section this was copied from (linkTo resolved) */
  sourceId: number
  colorIndex?: number
}

export type ClipboardPayload = CellClipboard | SectionClipboard

export function copyRange(track: Track, rect: Rect): CellClipboard {
  const s1 = Math.min(rect.s1, track.tuning.length - 1)
  const rows = s1 - rect.s0 + 1
  const cols = rect.col1 - rect.col0 + 1
  const data: (string | null)[][] = []
  for (let r = 0; r < rows; r++) {
    const row: (string | null)[] = []
    for (let i = 0; i < cols; i++) {
      const g = rect.col0 + i
      const m = Math.floor(g / COLS_PER_MEASURE)
      const c = g % COLS_PER_MEASURE
      row.push(track.measures[m]?.[c]?.[rect.s0 + r] ?? null)
    }
    data.push(row)
  }
  return { kind: 'tab-editor/cells', rows, cols, data }
}

export function sectionToClipboard(tracks: Track[], sec: SectionRange, songId: string, measureNotes: string[] | undefined): SectionClipboard {
  const span = sec.endMeasure - sec.startMeasure + 1
  const trackComments: Record<number, string> = {}
  tracks.forEach((t, i) => {
    const text = sec.trackComments?.[t.id]
    if (text) trackComments[i] = text
  })
  return {
    kind: 'tab-editor/section',
    name: sec.name,
    span,
    comment: sec.comment,
    trackComments: Object.keys(trackComments).length ? trackComments : undefined,
    songId,
    sourceId: sec.linkTo ?? sec.id,
    colorIndex: sec.colorIndex,
    tracks: tracks.map((t) => ({
      measures: deepCopyMeasures(t.measures.slice(sec.startMeasure, sec.endMeasure + 1)),
    })),
    measureNotes: measureNotes?.slice(sec.startMeasure, sec.endMeasure + 1),
  }
}

// Best-effort parse of an OS-clipboard payload written by copy.
export function parsePayload(text: string): ClipboardPayload | null {
  try {
    const v = JSON.parse(text) as ClipboardPayload
    if (v && (v.kind === 'tab-editor/cells' || v.kind === 'tab-editor/section')) return v
  } catch {
    // not ours
  }
  return null
}
