import type { StringTuning } from '../types'

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

export function noteOctaveToMidi(noteIndex: number, octave: number): number {
  return (octave + 1) * 12 + noteIndex
}

export function midiToNoteOctave(midi: number): StringTuning {
  const octave = Math.floor(midi / 12) - 1
  const noteIndex = ((midi % 12) + 12) % 12
  return { noteIndex, octave }
}

export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12)
}

export function midiToLabel(midi: number): string {
  const { noteIndex, octave } = midiToNoteOctave(midi)
  return `${NOTE_NAMES[noteIndex]}${octave}`
}

export function midiToNoteName(midi: number): string {
  const { noteIndex } = midiToNoteOctave(midi)
  return NOTE_NAMES[noteIndex]
}

// Preset tunings, top string (row 0) to bottom string, as MIDI notes.
export const PRESET_TUNINGS: Record<string, number[]> = {
  'Guitar Standard (E A D G B e)': [64, 59, 55, 50, 45, 40],
  'Guitar Drop D': [64, 59, 55, 50, 45, 38],
  'Guitar Half Step Down': [63, 58, 54, 49, 44, 39],
  'Guitar Open G': [62, 59, 55, 50, 43, 38],
  'Guitar 7-String': [64, 59, 55, 50, 45, 40, 35],
  'Bass Standard (G D A E)': [43, 38, 33, 28],
  'Bass 5-String (G D A E B)': [43, 38, 33, 28, 23],
  'Ukulele Standard (G C E A)': [69, 60, 64, 57],
}

export function presetToTuning(midiList: number[]): StringTuning[] {
  return midiList.map((midi) => midiToNoteOctave(midi))
}
