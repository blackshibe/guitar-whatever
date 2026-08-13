import type { Song } from '../types'

interface Props {
  songs: Song[]
  currentSongId: string
  onLoad: (id: string) => void
  onDelete: (id: string) => void
  onNew: () => void
  onSave: () => void
  saveStatus: string
}

const btn = 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs px-2.5 py-1'
const danger = 'bg-neutral-800 hover:bg-rose-900 hover:text-rose-300 text-neutral-200 text-xs px-2.5 py-1'
const saveBtn = 'bg-blue-600 hover:bg-blue-700 text-white text-xs px-2.5 py-1'

export default function SongSidebar({ songs, currentSongId, onLoad, onDelete, onNew, onSave, saveStatus }: Props) {
  const isSaved = songs.some((s) => s.id === currentSongId)

  const handleDelete = (song: Song) => {
    if (window.confirm(`Delete "${song.title || 'Untitled Song'}"? This can't be undone.`)) {
      onDelete(song.id)
    }
  }

  return (
    <aside className="w-64 shrink-0 border-r border-neutral-800 h-screen sticky top-0 overflow-y-auto p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-neutral-100 uppercase tracking-wide">Songs</h2>
        <button className={btn} onClick={onNew}>
          + New
        </button>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <button className={`${saveBtn} flex-1`} onClick={onSave}>
          {isSaved ? 'Overwrite' : 'Save'}
        </button>
        {saveStatus && <span className="text-xs text-emerald-400">{saveStatus}</span>}
      </div>

      {songs.length === 0 ? (
        <p className="text-xs text-neutral-500">Nothing saved yet — hit Save to store the current song here.</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {songs.map((song) => (
            <div
              key={song.id}
              className={
                'border px-2.5 py-2 cursor-pointer ' +
                (song.id === currentSongId ? 'border-blue-600 bg-blue-950/30' : 'border-neutral-800 hover:border-neutral-700')
              }
              onClick={() => onLoad(song.id)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 text-sm text-neutral-100 truncate">{song.title || 'Untitled Song'}</div>
                <button
                  className={`${danger} shrink-0`}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDelete(song)
                  }}
                >
                  ×
                </button>
              </div>
              <div className="text-[11px] text-neutral-500 mt-0.5">
                {song.tracks.length} track{song.tracks.length === 1 ? '' : 's'} · {song.measureCount} measures
              </div>
              <div className="text-[11px] text-neutral-600">{new Date(song.updatedAt).toLocaleString()}</div>
            </div>
          ))}
        </div>
      )}
    </aside>
  )
}
