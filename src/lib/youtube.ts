// Minimal wrapper around the YouTube IFrame Player API: one lazy script
// load, id parsing, and the anchor-measure → video-seconds conversion that
// keeps a reference video locked to the tab's own timeline.

let apiPromise: Promise<void> | null = null

export function loadYouTubeApi(): Promise<void> {
  if (apiPromise) return apiPromise
  apiPromise = new Promise((resolve) => {
    const w = window as unknown as { YT?: { Player: unknown } }
    if (w.YT?.Player) {
      resolve()
      return
    }
    const prevCallback = (window as unknown as Record<string, unknown>).onYouTubeIframeAPIReady
    ;(window as unknown as Record<string, unknown>).onYouTubeIframeAPIReady = () => {
      if (typeof prevCallback === 'function') prevCallback()
      resolve()
    }
    const script = document.createElement('script')
    script.src = 'https://www.youtube.com/iframe_api'
    document.head.appendChild(script)
  })
  return apiPromise
}

const ID_PATTERNS = [/(?:v=|\/embed\/|youtu\.be\/|\/shorts\/)([A-Za-z0-9_-]{11})/, /^([A-Za-z0-9_-]{11})$/]

export function extractVideoId(input: string): string | null {
  const trimmed = input.trim()
  for (const pattern of ID_PATTERNS) {
    const m = trimmed.match(pattern)
    if (m) return m[1]
  }
  return null
}

// Video time for global column `g`, given the song's tempo and one anchor
// point (anchorMeasure's downbeat ↔ anchorSeconds). Constant tempo assumed.
export function videoSecondsForCol(
  youtube: { anchorMeasure: number; anchorSeconds: number },
  bpm: number,
  colsPerMeasure: number,
  g: number
): number {
  const secondsPerCol = 60 / bpm / 2
  const anchorCol = youtube.anchorMeasure * colsPerMeasure
  return Math.max(0, youtube.anchorSeconds + (g - anchorCol) * secondsPerCol)
}
