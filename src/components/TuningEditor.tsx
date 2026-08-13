import { PRESET_TUNINGS, NOTE_NAMES, presetToTuning } from '../lib/tunings'
import type { StringTuning } from '../types'

interface Props {
  tuning: StringTuning[]
  trackName: string
  onChange: (tuning: StringTuning[]) => void
  onClose: () => void
}

const btn = 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-sm px-2 py-1 disabled:opacity-30 disabled:hover:bg-neutral-800'
const danger = 'bg-neutral-800 hover:bg-rose-900 hover:text-rose-300 text-neutral-200 text-sm px-2 py-1 disabled:opacity-30 disabled:hover:bg-neutral-800 disabled:hover:text-neutral-200'
const field = 'bg-neutral-950 border border-neutral-700 text-neutral-100 text-sm px-2 py-1'

export default function TuningEditor({ tuning, trackName, onChange, onClose }: Props) {
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
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-5" onClick={onClose}>
      <div
        className="bg-neutral-900 border border-neutral-800 p-6 w-full max-w-md max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-base font-semibold text-neutral-100">Tuning — {trackName}</h3>
          <button className={danger} onClick={onClose}>
            Close
          </button>
        </div>

        <label className="flex flex-col gap-1 text-xs text-neutral-400 mb-4">
          Start from preset
          <select className={field} defaultValue="" onChange={(e) => applyPreset(e.target.value)}>
            <option value="">— custom —</option>
            {Object.keys(PRESET_TUNINGS).map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-col gap-1.5">
          {tuning.map((s, i) => (
            <div className="flex items-center gap-1.5" key={i}>
              <span className="w-10 text-xs uppercase text-neutral-500">
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
                ×
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
