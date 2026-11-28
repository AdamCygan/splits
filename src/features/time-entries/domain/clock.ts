export const formatClock = (seconds: number) =>
  [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
    .map((count, index) =>
      index === 0 ? String(count) : String(count).padStart(2, '0'),
    )
    .join(':')
