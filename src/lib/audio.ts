let ctx: AudioContext | null = null

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext()
  return ctx
}

// Plucked-string-ish tone: short decaying triangle wave.
export function playNote(freq: number, time: number, duration = 0.35): void {
  const audioCtx = getCtx()
  const osc = audioCtx.createOscillator()
  const gain = audioCtx.createGain()
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(freq, time)
  gain.gain.setValueAtTime(0.0001, time)
  gain.gain.exponentialRampToValueAtTime(0.3, time + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, time + duration)
  osc.connect(gain)
  gain.connect(audioCtx.destination)
  osc.start(time)
  osc.stop(time + duration + 0.05)
}

export function resumeAudio(): AudioContext {
  const audioCtx = getCtx()
  if (audioCtx.state === 'suspended') audioCtx.resume()
  return audioCtx
}

export function now(): number {
  return getCtx().currentTime
}
