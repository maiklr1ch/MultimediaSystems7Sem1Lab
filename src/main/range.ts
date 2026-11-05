
export interface ByteRange {
  start: number
  end: number // включно
}

/**
 * @returns діапазон байтів, `null` якщо заголовка немає або він не розпізнаний
 *          (тоді віддаємо весь файл зі статусом 200), або `'unsatisfiable'` для 416.
 */
export function parseRange(header: string | null | undefined, size: number): ByteRange | null | 'unsatisfiable' {
  if (!header) return null

  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim())
  if (!match) return null

  const [, rawStart, rawEnd] = match
  if (rawStart === '' && rawEnd === '') return null

  let start: number
  let end: number

  if (rawStart === '') {
    const suffixLength = Number(rawEnd)
    if (suffixLength === 0) return 'unsatisfiable'
    start = Math.max(0, size - suffixLength)
    end = size - 1
  } else {
    start = Number(rawStart)
    end = rawEnd === '' ? size - 1 : Math.min(Number(rawEnd), size - 1)
  }

  if (size === 0 || start >= size || start > end) return 'unsatisfiable'
  return { start, end }
}
