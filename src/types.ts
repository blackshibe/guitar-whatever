export interface StringTuning {
  noteIndex: number
  octave: number
}

export type Column = (string | null)[]
export type Measure = Column[]

export interface Track {
  id: number
  name: string
  tuning: StringTuning[]
  measures: Measure[]
  /** sectionId → bars this track loops within that section (unit < span); bars unit..span-1 mirror 0..unit-1 */
  loops?: Record<number, number>
}

export interface Section {
  id: number
  name: string
  startMeasure: number
  /** song-wide note */
  comment?: string
  /** trackId → note shown only for that track */
  trackComments?: Record<number, string>
  /** id of the section this one mirrors — every edit writes to all copies */
  linkTo?: number
  /** index into SECTION_COLORS; absent = neutral */
  colorIndex?: number
}

export interface SectionRange extends Section {
  endMeasure: number
}

export interface YoutubeSync {
  videoId: string
  /** downbeat this anchor pins — column anchorMeasure*COLS_PER_MEASURE */
  anchorMeasure: number
  anchorSeconds: number
}

export interface Song {
  id: string
  title: string
  bpm: number
  measureCount: number
  sections: Section[]
  tracks: Track[]
  updatedAt: number
  /** measureNotes[m] — free-text annotation for that measure, shared across tracks; parallel to measureCount */
  measureNotes?: string[]
  youtube?: YoutubeSync
}

export interface CellPos {
  m: number
  c: number
  s: number
}

export interface RangeSelection {
  anchor: CellPos
  focus: CellPos
}

export interface Playhead {
  m: number
  c: number
}
