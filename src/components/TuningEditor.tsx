import { useEffect } from 'react'
import { PRESET_TUNINGS, NOTE_NAMES, presetLabel, presetToTuning } from '../lib/tunings'
import type { StringTuning } from '../types'
import { CloseIcon } from './Icons'

interface Props {
  tuning: StringTuning[]
  trackName: string
  onChange: (tuning: StringTuning[]) => void
  onClose: () => void
}

const btn = 'text-ink-soft hover:text-ink text-sm px-2 py-1 border-b border-transparent hover:border-hairline-strong disabled:opacity-30'
const danger = 'text-ink-soft hover:text-accent text-sm px-2 py-1 border-b border-transparent hover:border-accent/40 disabled:opacity-30'
const field = 'bg-transparent border-b border-hairline-strong focus:border-accent outline-none text-ink text-sm font-mono px-1.5 py-1'

export default function TuningEditor({ tuning, trackName, onChange, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const updateString = (i: number, field: keyof StringTuning, value: number) => {
    onChange(tuning.map((s, idx) => (idx === i ? { ...s, [field]: value } : s)))
  }

  const addString = (position: number) => {
    const copy = tuning[Math.max(0, position - 1)] || { noteIndex: 4, octave: 4 }
    const next = tuning.slice()
    next.splice(position, 0, { noteIndex: copy.noteIndex, octave: copy.octave })
    onChange(next)
  }

  const removeString = (i: number) => {
    if (tuning.length <= 1) return
    onChange(tuning.filter((_, idx) => idx !== i))
  }

  const moveString = (i: number, dir: number) => {
    const j = i + dir
    if (j < 0 || j >= tuning.length) return
    const next = tuning.slice()
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }

  const reverseOrder = () => onChange(tuning.slice().reverse())

  const applyPreset = (name: string) => {
    if (!name) return
    onChange(presetToTuning(PRESET_TUNINGS[name]))
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-5" onClick={onClose}>
      <div
        className="bg-plate border border-ink-faint p-6 w-full max-w-md max-h-[85vh] overflow-y-auto shadow-[0_10px_28px_rgba(28,27,25,0.28)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display text-xl text-ink">Tuning — {trackName}</h3>
          <button className={danger} onClick={onClose}>
            Close
          </button>
        </div>

        <label className="flex flex-col gap-1 text-xs text-ink-faint mb-4">
          Start from preset
          <select className={field} defaultValue="" onChange={(e) => applyPreset(e.target.value)}>
            <option value="">— custom —</option>
            {Object.keys(PRESET_TUNINGS).map((name) => (
              <option key={name} value={name}>
                {presetLabel(name)}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-col gap-1.5">
          {tuning.map((s, i) => (
            <div className="flex items-center gap-1.5" key={i}>
              <span className="w-10 text-xs uppercase text-ink-faint font-mono">
                {i === 0 ? 'top' : i === tuning.length - 1 ? 'bottom' : i + 1}
              </span>
              <select className={field} value={s.noteIndex} onChange={(e) => updateString(i, 'noteIndex', Number(e.target.value))}>
                {NOTE_NAMES.map((n, idx) => (
                  <option key={n} value={idx}>
                    {n}
                  </option>
                ))}
              </select>
              <input
                className={`${field} w-14`}
                type="number"
                min={0}
                max={8}
                value={s.octave}
                onChange={(e) => updateString(i, 'octave', Number(e.target.value))}
              />
              <button className={btn} title="Move up" onClick={() => moveString(i, -1)} disabled={i === 0}>
                ↑
              </button>
              <button className={btn} title="Move down" onClick={() => moveString(i, 1)} disabled={i === tuning.length - 1}>
                ↓
              </button>
              <button className={btn} title="Insert string below" onClick={() => addString(i + 1)}>
                +
              </button>
              <button className={danger} title="Remove string" onClick={() => removeString(i)} disabled={tuning.length <= 1}>
                <CloseIcon />
              </button>
            </div>
          ))}
        </div>

        <div className="flex gap-2 mt-4">
          <button className={btn} onClick={() => addString(tuning.length)}>
            + Add string
          </button>
          <button className={btn} onClick={reverseOrder}>
            Reverse order
          </button>
        </div>
      </div>
    </div>
  )
}
