import { FORMATS, getExtension, getFormat, type MediaKind } from '@shared/formats'
import type { OpenedFile } from '@shared/ipc'

/** Те, що зараз відтворюється. Назва не MediaSource, щоб не конфліктувати з DOM API. */
export interface PlaybackSource {
  url: string
  title: string
  origin: 'file' | 'url'
  /** За розширенням. Для URL без розширення — 'unknown', уточнюється після loadedmetadata. */
  kind: MediaKind | 'unknown'
  /** Підпис формату для інтерфейсу: MP4, MP3, HLS… */
  formatLabel: string
  isHls: boolean
  sizeBytes?: number
  /** blob: URL треба звільнити, коли джерело замінюється. */
  revokeOnUnload?: boolean
}

export class SourceError extends Error {}

export function sourceFromOpenedFile(file: OpenedFile): PlaybackSource {
  return {
    url: file.url,
    title: file.name,
    origin: 'file',
    kind: file.kind,
    formatLabel: getExtension(file.name).toUpperCase() || 'Файл',
    isHls: false,
    sizeBytes: file.sizeBytes
  }
}

/** Файл, перетягнутий у вікно: відтворюємо через blob: URL, без звернення до main-процесу. */
export function sourceFromDroppedFile(file: File): PlaybackSource {
  const format = getFormat(file.name)
  const isMedia = format || file.type.startsWith('audio/') || file.type.startsWith('video/')
  if (!isMedia) {
    throw new SourceError(`«${file.name}» не схожий на аудіо чи відео. Перетягніть файл одного з підтримуваних форматів.`)
  }
  return {
    url: URL.createObjectURL(file),
    title: file.name,
    origin: 'file',
    kind: format?.kind ?? (file.type.startsWith('audio/') ? 'audio' : 'video'),
    formatLabel: getExtension(file.name).toUpperCase() || 'Файл',
    isHls: false,
    sizeBytes: file.size,
    revokeOnUnload: true
  }
}

export function sourceFromUrl(input: string): PlaybackSource {
  const trimmed = input.trim()
  if (!trimmed) throw new SourceError('Вставте посилання на аудіо чи відео.')

  // Дозволяємо вводити без схеми: example.com/video.mp4 → https://example.com/video.mp4
  const withScheme = /^[a-z][a-z\d+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`

  let url: URL
  try {
    url = new URL(withScheme)
  } catch {
    throw new SourceError('Це не схоже на посилання. Перевірте адресу, наприклад: https://example.com/video.mp4')
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new SourceError('Підтримуються лише посилання http:// та https://. Локальні файли відкривайте кнопкою «Відкрити файл».')
  }

  const ext = getExtension(url.pathname)
  if (ext === 'mpd') {
    throw new SourceError('MPEG-DASH (.mpd) не підтримується. Використайте пряме посилання на файл або HLS-потік (.m3u8).')
  }

  const isHls = ext === 'm3u8'
  const lastSegment = decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() ?? '')

  return {
    url: url.href,
    title: lastSegment || url.hostname,
    origin: 'url',
    kind: isHls ? 'unknown' : (FORMATS[ext]?.kind ?? 'unknown'),
    formatLabel: isHls ? 'HLS' : ext ? ext.toUpperCase() : 'URL',
    isHls
  }
}
