// How a percentage compares to the pass mark: good = passing, warn = close, bad = far off.
export function levelOf(percent, passPercent) {
  if (percent >= passPercent) return 'good'
  if (percent >= passPercent - 25) return 'warn'
  return 'bad'
}
