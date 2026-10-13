import { useEffect, useRef, useState } from 'react'

function format(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

// A traffic light: green while there's time, yellow in the last 5 minutes, red in the last minute.
export default function Timer({ deadline, onExpire }) {
  const [now, setNow] = useState(() => Date.now())
  const [announcement, setAnnouncement] = useState('')
  const expiredRef = useRef(false)
  const onExpireRef = useRef(onExpire)

  useEffect(() => {
    onExpireRef.current = onExpire
  }, [onExpire])

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [])

  const remaining = deadline - now
  const light = remaining <= 60_000 ? 'red' : remaining <= 5 * 60_000 ? 'yellow' : 'green'

  // Tell screen-reader users when the light changes, not every second.
  useEffect(() => {
    if (light === 'yellow') setAnnouncement('Kanë mbetur 5 minuta.')
    if (light === 'red') setAnnouncement('Ka mbetur 1 minutë.')
  }, [light])

  useEffect(() => {
    if (remaining <= 0 && !expiredRef.current) {
      expiredRef.current = true
      onExpireRef.current?.()
    }
  }, [remaining])

  return (
    <div className={`timer timer-${light}`}>
      <span className="timer-lights" aria-hidden="true">
        <span className="timer-lamp lamp-red" />
        <span className="timer-lamp lamp-yellow" />
        <span className="timer-lamp lamp-green" />
      </span>
      <span className="timer-text">
        <span className="visually-hidden">Koha e mbetur: </span>
        <time>{format(remaining)}</time>
      </span>
      <span className="visually-hidden" aria-live="polite">
        {announcement}
      </span>
    </div>
  )
}
