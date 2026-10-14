// Neon road-sign graphics, drawn in SVG. They're decoration, so screen readers skip them.

// The eShoferi mark: a priority-road diamond with the road running into it.
export function LogoMark({ className = '' }) {
  return (
    <svg className={`logo-mark neon neon-yellow ${className}`} viewBox="0 0 48 48" aria-hidden="true">
      <path d="M24 3.5 L44.5 24 L24 44.5 L3.5 24 Z" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinejoin="round" />
      <path d="M15.5 33.5 L23 13 M32.5 33.5 L25 13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M24 31 V28 M24 24.5 V22 M24 19 V17.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.75" />
    </svg>
  )
}

// Home page: three signs that "power on" like neon tubes.
export function NeonSigns({ className = '' }) {
  return (
    <svg className={`neon-signs ${className}`} viewBox="0 0 380 330" aria-hidden="true">
      <g className="tube tube-1 neon neon-blue">
        <circle cx="118" cy="118" r="78" fill="none" stroke="currentColor" strokeWidth="5" />
        <path d="M118 160 V82 M92 106 L118 80 L144 106" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <g className="tube tube-2 neon neon-red">
        <path d="M282 58 L366 205 H198 Z" fill="none" stroke="currentColor" strokeWidth="5" strokeLinejoin="round" />
        <path d="M282 112 V158" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
        <circle cx="282" cy="182" r="4.5" fill="currentColor" />
      </g>
      <g className="tube tube-3 neon neon-yellow">
        <path d="M196 170 L274 248 L196 326 L118 248 Z" fill="none" stroke="currentColor" strokeWidth="5" strokeLinejoin="round" transform="translate(0 -6)" />
        <path d="M196 206 L236 246 L196 286 L156 246 Z" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinejoin="round" transform="translate(0 -4)" />
      </g>
    </svg>
  )
}

export function PassSign({ className = '' }) {
  return (
    <svg className={`sign neon neon-green ${className}`} viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" strokeWidth="5" />
      <path d="M30 52 L45 66 L71 37" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function FailSign({ className = '' }) {
  return (
    <svg className={`sign neon neon-red ${className}`} viewBox="0 0 100 92" aria-hidden="true">
      <path d="M50 6 L94 84 H6 Z" fill="none" stroke="currentColor" strokeWidth="5" strokeLinejoin="round" />
      <path d="M50 32 V58" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
      <circle cx="50" cy="71" r="4" fill="currentColor" />
    </svg>
  )
}
