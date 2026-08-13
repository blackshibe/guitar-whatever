interface Props {
  title: string
  onTitleChange: (title: string) => void
  bpm: number
  onBpmChange: (bpm: number) => void
  isPlaying: boolean
  onPlay: () => void
  onStop: () => void
  onAddMeasure: () => void
  onAddSection: () => void
  onClear: () => void
  onCopy: () => void
  copyStatus: string
  onSave: () => void
  saveStatus: string
  isSaved: boolean
}

const btn = 'bg-blue-600 hover:bg-blue-700 text-white text-sm px-3.5 py-2'
const danger = 'bg-neutral-700 hover:bg-rose-900 hover:text-rose-300 text-neutral-100 text-sm px-3.5 py-2'
const neutral = 'bg-neutral-700 hover:bg-neutral-600 text-neutral-100 text-sm px-3.5 py-2'

export default function Toolbar({
  title,
  onTitleChange,
  bpm,
  onBpmChange,
  isPlaying,
  onPlay,
  onStop,
  onAddMeasure,
  onAddSection,
  onClear,
  onCopy,
  copyStatus,
  onSave,
  saveStatus,
  isSaved,
}: Props) {
  return (
    <div className="mb-4">
      <input
        className="block w-full bg-transparent border-b border-transparent hover:border-neutral-700 focus:border-blue-600 outline-none text-2xl font-semibold text-neutral-100 py-1 mb-4"
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
      />

      <div className="flex flex-wrap items-center gap-3 bg-neutral-900 border border-neutral-800 px-4 py-3">
        <label className="flex flex-col gap-1 text-xs text-neutral-400">
          BPM
          <input
            className="bg-neutral-950 border border-neutral-700 text-neutral-100 text-sm px-2 py-1.5 w-[70px]"
            type="number"
            min={30}
            max={300}
            value={bpm}
            onChange={(e) => onBpmChange(Number(e.target.value) || 100)}
          />
        </label>

        {isPlaying ? (
          <button className={danger} onClick={onStop}>
            Stop
          </button>
        ) : (
          <button className={btn} onClick={onPlay}>
            ▶ Play song
          </button>
        )}

        <button className={neutral} onClick={onAddMeasure}>
          + Measure
        </button>
        <button className={neutral} onClick={onAddSection}>
          + Section
        </button>
        <button className={neutral} onClick={onSave}>
          {isSaved ? 'Overwrite' : 'Save'}
        </button>
        <button className={danger} onClick={onClear}>
          Clear
        </button>
        <button className={neutral} onClick={onCopy}>
          Copy as text
        </button>
        {copyStatus && <span className="text-xs text-emerald-400">{copyStatus}</span>}
        {saveStatus && <span className="text-xs text-emerald-400">{saveStatus}</span>}
      </div>
    </div>
  )
}
