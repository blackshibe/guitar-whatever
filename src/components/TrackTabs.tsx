import type { Track } from '../types'
import { tuningLabel } from '../lib/instruments'

interface Props {
  tracks: Track[]
  activeTrackId: number
  onSelect: (id: number) => void
  onRename: (id: number, name: string) => void
  onEditTuning: (id: number) => void
  onRemove: (id: number) => void
  onAdd: () => void
}

export default function TrackTabs({ tracks, activeTrackId, onSelect, onRename, onEditTuning, onRemove, onAdd }: Props) {
  const activeTrack = tracks.find((t) => t.id === activeTrackId)

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5 mb-2">
        {tracks.map((t) => (
          <div
            key={t.id}
            className={
              'flex items-center gap-1 border px-2.5 py-1 ' +
              (t.id === activeTrackId
                ? 'bg-neutral-900 border-neutral-800 border-t-2 border-t-blue-600'
                : 'bg-neutral-900 border-neutral-800')
            }
          >
            <input
              className="bg-transparent border-none text-neutral-100 text-sm px-0.5 py-1 w-[110px] outline-none focus:border-b focus:border-blue-600"
              value={t.name}
              onClick={() => onSelect(t.id)}
              onChange={(e) => onRename(t.id, e.target.value)}
            />
            <button
              className="text-neutral-400 hover:bg-neutral-700 hover:text-neutral-100 text-sm px-1.5 py-0.5"
              title="Edit tuning"
              onClick={() => onEditTuning(t.id)}
            >
              ⚙
            </button>
            {tracks.length > 1 && (
              <button
                className="text-neutral-400 hover:bg-rose-900 hover:text-rose-300 text-sm px-1.5 py-0.5"
                title="Remove track"
                onClick={() => onRemove(t.id)}
              >
                ×
              </button>
            )}
          </div>
        ))}
        <button
          className="bg-transparent border border-dashed border-neutral-700 hover:bg-neutral-900 hover:text-neutral-100 text-neutral-400 text-sm px-3 py-1.5"
          onClick={onAdd}
        >
          + Track
        </button>
      </div>

      {activeTrack && (
        <div className="text-xs text-neutral-500 mb-3.5 font-mono">Tuning: {tuningLabel(activeTrack.tuning)}</div>
      )}
    </>
  )
}
