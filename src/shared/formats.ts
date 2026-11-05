// Єдине джерело правди про підтримувані формати: використовується і main-процесом
// (фільтри діалогу, Content-Type у media:// протоколі), і renderer-ом (drag & drop, підписи).
//
// Важливо: формат = контейнер + кодек. Перелік перевірено на вбудованому в Electron Chromium:
// MKV та MOV відтворюються, коли всередині H.264 / VP9 / AV1, але не HEVC.

export type MediaKind = 'audio' | 'video'

interface FormatInfo {
  kind: MediaKind
  mime: string
}

export const FORMATS: Record<string, FormatInfo> = {
  // audio
  mp3: { kind: 'audio', mime: 'audio/mpeg' },
  wav: { kind: 'audio', mime: 'audio/wav' },
  ogg: { kind: 'audio', mime: 'audio/ogg' },
  oga: { kind: 'audio', mime: 'audio/ogg' },
  opus: { kind: 'audio', mime: 'audio/ogg' },
  flac: { kind: 'audio', mime: 'audio/flac' },
  m4a: { kind: 'audio', mime: 'audio/mp4' },
  aac: { kind: 'audio', mime: 'audio/aac' },
  // video
  mp4: { kind: 'video', mime: 'video/mp4' },
  m4v: { kind: 'video', mime: 'video/mp4' },
  webm: { kind: 'video', mime: 'video/webm' },
  mkv: { kind: 'video', mime: 'video/x-matroska' },
  mov: { kind: 'video', mime: 'video/quicktime' }
}

export const AUDIO_EXTENSIONS = Object.keys(FORMATS).filter((ext) => FORMATS[ext].kind === 'audio')
export const VIDEO_EXTENSIONS = Object.keys(FORMATS).filter((ext) => FORMATS[ext].kind === 'video')

export function getExtension(name: string): string {
  const clean = name.split(/[?#]/)[0]
  const dot = clean.lastIndexOf('.')
  const slash = Math.max(clean.lastIndexOf('/'), clean.lastIndexOf('\\'))
  return dot > slash ? clean.slice(dot + 1).toLowerCase() : ''
}

export function getFormat(name: string): FormatInfo | undefined {
  return FORMATS[getExtension(name)]
}
