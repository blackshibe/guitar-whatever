import type { KeyboardEvent } from 'react'
import type { Playhead, SectionRange, Selection, Track } from '../types'
import { midiToNoteName } from '../lib/tunings'
import { chunkMeasures, stringMidi } from '../lib/instruments'

interface Props {
  activeTrack: Track
  sectionRanges: SectionRange[]
  measureCount: number
  canDeleteSection: boolean
  selected: Selection | null
  playhead: Playhead | null
  onSelectCell: (m: number, c: number, s: number) => void
  onDeleteMeasure: (m: number) => void
  onInsertMeasureAfter: (m: number) => void
  onAddSectionAfter: (m: number) => void
  onRenameSection: (id: number, name: string) => void
  onCommentChange: (id: number, comment: string) => void
  activeLoops: Record<number, number>
  onRepeatChange: (sectionId: number, times: number) => void
  onDeleteSection: (id: number) => void
  onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => void
  registerSectionRef: (id: number, el: HTMLDivElement | null) => void
}

const headerBtn = 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs px-2.5 py-1.5'
const dangerHeaderBtn = 'bg-neutral-800 hover:bg-rose-900 hover:text-rose-300 text-neutral-300 text-xs px-2.5 py-1.5'

export default function TabGrid({
  activeTrack,
  sectionRanges,
  measureCount,
  canDeleteSection,
  selected,
  playhead,
  onSelectCell,
  onDeleteMeasure,
  onInsertMeasureAfter,
  onAddSectionAfter,
  onRenameSection,
  onCommentChange,
  activeLoops,
  onRepeatChange,
  onDeleteSection,
  onKeyDown,
  registerSectionRef,
}: Props) {
  return (
    <div className="outline-none overflow-x-auto bg-neutral-900 border border-neutral-800 p-4" onKeyDown={onKeyDown} tabIndex={0}>
      {sectionRanges.map((sec) => {
        const span = sec.endMeasure - sec.startMeasure + 1
        const loop = activeLoops[sec.id] ?? 0
        const times = loop > 0 ? Math.ceil(span / loop) : 1
        // A looping track shows only its loop unit; the rest of the section span
        // exists on the timeline (other tracks fill it) but is hidden here.
        const measureIndices = Array.from({ length: loop > 0 ? loop : span }, (_, off) => sec.startMeasure + off)
        // Map the timeline playhead into the loop unit so it cycles on screen.
        const playheadMeasure =
          playhead && loop > 0 && playhead.m >= sec.startMeasure && playhead.m <= sec.endMeasure
            ? sec.startMeasure + ((playhead.m - sec.startMeasure) % loop)
            : playhead?.m ?? null
        return (
          <div
            className="border-t border-neutral-800 first:border-t-0 pt-3.5 first:pt-0 mb-2.5 scroll-mt-4"
            key={sec.id}
            ref={(el) => registerSectionRef(sec.id, el)}
          >
            <div className="flex items-center gap-2 mb-3">
              <input
                className="bg-transparent border-b border-neutral-700 focus:border-blue-600 outline-none text-base font-semibold text-neutral-100 px-1 py-0.5 flex-none w-[240px]"
                value={sec.name}
                onChange={(e) => onRenameSection(sec.id, e.target.value)}
              />
              <label
                className="flex items-center gap-1 text-xs text-neutral-400"
                title="Times this track's bars repeat — raising it extends the section for the other tracks"
              >
                ×
                <input
                  className="bg-neutral-950 border border-neutral-700 text-neutral-100 text-xs px-1.5 py-1 w-12"
                  type="number"
                  min={1}
                  max={99}
                  value={times}
                  onChange={(e) => onRepeatChange(sec.id, Number(e.target.value))}
                />
              </label>
              <button
                className={headerBtn}
                onClick={() => onInsertMeasureAfter(loop > 0 ? sec.startMeasure + loop - 1 : sec.endMeasure)}
                title="Add measure to this section"
              >
                + measure
              </button>
              <button className={headerBtn} onClick={() => onAddSectionAfter(sec.endMeasure + 1)} title="Split a new section after this one">
                + section after
              </button>
              {canDeleteSection && (
                <button className={dangerHeaderBtn} onClick={() => onDeleteSection(sec.id)} title="Remove section marker">
                  remove marker
                </button>
              )}
            </div>

            <input
              className="bg-transparent border-b border-neutral-800 focus:border-blue-600 outline-none text-xs text-neutral-400 placeholder-neutral-600 px-1 py-1 w-full max-w-[520px] mb-3"
              value={sec.comment ?? ''}
              placeholder="Notes"
              onChange={(e) => onCommentChange(sec.id, e.target.value)}
            />

            {chunkMeasures(measureIndices).map((lineMeasures) => (
              <div className="mb-4" key={lineMeasures[0]}>
                <div className="flex items-center">
                  <span className="w-10 shrink-0" />
                  {lineMeasures.map((m) => (
                    <div className="flex items-center shrink-0" key={m}>
                      <span className="w-3.5 shrink-0" />
                      <span className="flex items-center gap-1 w-[208px] shrink-0 text-xs text-neutral-500">
                        #{m + 1}
                        {measureCount > 1 && (
                          <button
                            className="bg-transparent hover:bg-rose-900 hover:text-rose-300 text-neutral-500 px-1.5 leading-none"
                            onClick={() => onDeleteMeasure(m)}
                            title="Delete measure"
                          >
                            ×
                          </button>
                        )}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="font-mono">
                  {activeTrack.tuning.map((str, s) => (
                    <div className="flex items-center" key={s}>
                      <span className="w-10 shrink-0 text-right mr-1.5 text-neutral-400 text-[13px]">
                        {midiToNoteName(stringMidi(str))}
                      </span>
                      <span className="w-3.5 shrink-0 text-center text-neutral-600">|</span>
                      {lineMeasures.map((m) => (
                        <span className="flex items-center shrink-0" key={m}>
                          {activeTrack.measures[m].map((col, c) => {
                            const isSelected = selected && selected.m === m && selected.c === c && selected.s === s
                            const isPlayhead = playheadMeasure === m && playhead?.c === c
                            const value = col[s]
                            return (
                              <button
                                key={c}
                                data-cell
                                className={
                                  'w-[26px] h-[26px] shrink-0 border-0 border-b border-neutral-800 text-[13px] p-0 m-0 ' +
                                  (isSelected
                                    ? 'outline outline-2 -outline-offset-2 outline-blue-600 bg-blue-950'
                                    : isPlayhead
                                      ? 'bg-emerald-950'
                                      : 'bg-transparent hover:bg-neutral-800') +
                                  ' ' +
                                  (value !== null ? 'text-neutral-100 font-semibold' : 'text-neutral-600')
                                }
                                onClick={() => onSelectCell(m, c, s)}
                              >
                                {value === null ? '-' : value}
                              </button>
                            )
                          })}
                          <span className="w-3.5 shrink-0 text-center text-neutral-600">|</span>
                        </span>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}
