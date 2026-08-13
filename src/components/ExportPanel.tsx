interface Props {
  text: string
}

export default function ExportPanel({ text }: Props) {
  return (
    <>
      <h2 className="text-lg mt-8 mb-2 text-neutral-400">Export</h2>
      <pre className="bg-black border border-neutral-800 p-4 overflow-x-auto font-mono text-[13px] leading-relaxed whitespace-pre text-neutral-200">
        {text}
      </pre>
    </>
  )
}
