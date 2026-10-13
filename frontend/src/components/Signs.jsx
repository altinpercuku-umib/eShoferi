// Road-sign shapes drawn in SVG. They're decoration, so screen readers skip them.

export function PrioritySign({ className = '' }) {
  return (
    <svg className={`sign ${className}`} viewBox="0 0 200 200" aria-hidden="true">
      <rect x="35" y="35" width="130" height="130" rx="8" transform="rotate(45 100 100)" fill="var(--sign-edge)" />
      <rect x="44" y="44" width="112" height="112" rx="6" transform="rotate(45 100 100)" fill="#fff" />
      <rect x="62" y="62" width="76" height="76" rx="3" transform="rotate(45 100 100)" fill="var(--yellow)" />
    </svg>
  )
}

export function PassSign({ className = '' }) {
  return (
    <svg className={`sign ${className}`} viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r="48" fill="var(--blue)" />
      <path d="M28 52 L44 67 L73 35" fill="none" stroke="#fff" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function FailSign({ className = '' }) {
  return (
    <svg className={`sign ${className}`} viewBox="0 0 100 92" aria-hidden="true">
      <path d="M50 4 L96 86 H4 Z" fill="#fff" stroke="var(--red)" strokeWidth="8" strokeLinejoin="round" />
      <rect x="45" y="30" width="10" height="32" rx="3" fill="#1C2126" />
      <circle cx="50" cy="73" r="6" fill="#1C2126" />
    </svg>
  )
}
