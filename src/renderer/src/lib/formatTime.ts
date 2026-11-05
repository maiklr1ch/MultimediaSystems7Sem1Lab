const pad = (n: number): string => String(n).padStart(2, '0')

/**
 * Форматує секунди як таймкод: 03:07 або 1:02:09.
 * `reference` — загальна тривалість: якщо вона ≥ 1 год, години показуються і для поточного часу,
 * щоб ширина дисплея не стрибала.
 */
export function formatTime(seconds: number, reference: number = seconds): string {
  const safe = Number.isFinite(seconds) && seconds > 0 ? seconds : 0
  const total = Math.floor(safe)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const withHours = h > 0 || (Number.isFinite(reference) && reference >= 3600)
  return withHours ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`
  const units = ['КБ', 'МБ', 'ГБ']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`
}
