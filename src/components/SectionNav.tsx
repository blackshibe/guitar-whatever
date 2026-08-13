import type { SectionRange } from '../types'

interface Props {
  sectionRanges: SectionRange[]
  onJump: (id: number) => void
}

export default function SectionNav({ sectionRanges, onJump }: Props) {
  return (
    <div className="flex flex-wrap gap-1.5 mb-3.5">
      {sectionRanges.map((sec) => (
        <button
          key={sec.id}
          className="bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs px-2.5 py-1.5"
          onClick={() => onJump(sec.id)}
        >
          {sec.name}
        </button>
      ))}
    </div>
  )
}
