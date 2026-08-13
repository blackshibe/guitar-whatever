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
}

export interface Section {
  id: number
  name: string
  startMeasure: number
  comment?: string
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
