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
  /** sectionId → bars this track cycles across that section; absent/0 = play through */
  loops?: Record<number, number>
}

export interface Section {
  id: number
  name: string
  startMeasure: number
  comment?: string
  /** legacy global repeat — migrated to written-out measures + per-track loops on load */
  repeat?: number
}

export interface SectionRange extends Section {
  endMeasure: number
}

export interface Song {
  id: string
  title: string
  bpm: number
  measureCount: number
  sections: Section[]
  tracks: Track[]
  updatedAt: number
}

export interface Selection {
  m: number
  c: number
  s: number
}

export interface Playhead {
  m: number
  c: number
}
