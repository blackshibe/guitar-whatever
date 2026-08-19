// Authored line icons, one consistent 1.6px stroke, no fill — the engraved
// plate's own drawn vocabulary standing in for Unicode glyph chrome.
interface IconProps {
  className?: string
}

const base = 'w-[1em] h-[1em] inline-block align-[-0.14em]'
const strokeProps = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

export function PlayIcon({ className = '' }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" className={`${base} ${className}`} {...strokeProps}>
      <path d="M4 2.5 L13 8 L4 13.5 Z" />
    </svg>
  )
}

export function StopIcon({ className = '' }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" className={`${base} ${className}`} {...strokeProps}>
      <rect x="3.5" y="3.5" width="9" height="9" />
    </svg>
  )
}

export function SkipStartIcon({ className = '' }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" className={`${base} ${className}`} {...strokeProps}>
      <path d="M4.5 3 V13" />
      <path d="M12 3 L5.5 8 L12 13 Z" />
    </svg>
  )
}

export function GearIcon({ className = '' }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" className={`${base} ${className}`} {...strokeProps}>
      <circle cx="8" cy="8" r="2.4" />
      <path d="M8 2.4 V4.2 M8 11.8 V13.6 M13.6 8 H11.8 M4.2 8 H2.4 M11.9 4.1 L10.6 5.4 M5.4 10.6 L4.1 11.9 M11.9 11.9 L10.6 10.6 M5.4 5.4 L4.1 4.1" />
    </svg>
  )
}

export function HelpIcon({ className = '' }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" className={`${base} ${className}`} {...strokeProps}>
      <circle cx="8" cy="8" r="6.2" />
      <path d="M6 6.3c0-1.2 1-2 2-2s2 .7 2 1.8c0 1.4-2 1.4-2 3" />
      <circle cx="8" cy="11.2" r="0.15" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function InsertIcon({ className = '' }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" className={`${base} ${className}`} {...strokeProps}>
      <path d="M8 2.5 V9.5 M5 6.5 L8 9.5 L11 6.5" />
      <path d="M3 12.5 H13" />
    </svg>
  )
}

export function CloseIcon({ className = '' }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" className={`${base} ${className}`} {...strokeProps}>
      <path d="M4 4 L12 12 M12 4 L4 12" />
    </svg>
  )
}
