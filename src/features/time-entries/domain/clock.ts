export const formatClock = (seconds: number) =>
  [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
    .map((n, i) => (i === 0 ? String(n) : String(n).padStart(2, '0')))
    .join(':')
