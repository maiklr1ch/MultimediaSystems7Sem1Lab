import { useCallback, useEffect, useRef, useState } from 'react'
import type Hls from 'hls.js'
import type { PlaybackSource } from '../lib/sources'

// Уся логіка відтворення зосереджена тут. Компоненти лише читають `state` і викликають дії.
// Один елемент <video> відтворює і відео, і аудіо: для аудіо videoWidth === 0,
// тож тип вмісту визначається фактично, а не лише за розширенням.

export interface PlayerState {
  source: PlaybackSource | null
  /** Метадані завантажено, відома тривалість. */
  ready: boolean
  paused: boolean
  ended: boolean
  /** Користувач натиснув Stop (відрізняється від паузи підписом і позицією 0). */
  stopped: boolean
  buffering: boolean
  currentTime: number
  /** NaN — ще невідома, Infinity — прямий ефір. */
  duration: number
  /** Кінець завантаженого фрагмента, що містить поточну позицію. */
  bufferedEnd: number
  volume: number
  muted: boolean
  hasVideo: boolean
  isLive: boolean
  error: string | null
}

const INITIAL_PLAYBACK = {
  ready: false,
  paused: true,
  ended: false,
  stopped: false,
  buffering: false,
  currentTime: 0,
  duration: Number.NaN,
  bufferedEnd: 0,
  hasVideo: false,
  isLive: false,
  error: null
} satisfies Partial<PlayerState>

const STORAGE_KEY = 'player.audio'

function readStoredAudio(): { volume: number; muted: boolean } {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '')
    if (typeof parsed.volume === 'number' && typeof parsed.muted === 'boolean') {
      return { volume: clamp(parsed.volume, 0, 1), muted: parsed.muted }
    }
  } catch {
    // немає збережених налаштувань або сховище недоступне
  }
  return { volume: 0.8, muted: false }
}

function storeAudio(volume: number, muted: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ volume, muted }))
  } catch {
    // не критично
  }
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function bufferedEndAt(el: HTMLMediaElement): number {
  const { buffered } = el
  for (let i = 0; i < buffered.length; i++) {
    if (buffered.start(i) <= el.currentTime + 0.25 && el.currentTime <= buffered.end(i)) {
      return buffered.end(i)
    }
  }
  return 0
}

function seekableBounds(el: HTMLMediaElement): [number, number] {
  const { seekable } = el
  if (seekable.length > 0) return [seekable.start(0), seekable.end(seekable.length - 1)]
  return [0, Number.isFinite(el.duration) ? el.duration : 0]
}

function describeMediaError(error: MediaError | null): string {
  switch (error?.code) {
    case MediaError.MEDIA_ERR_ABORTED:
      return 'Завантаження перервано.'
    case MediaError.MEDIA_ERR_NETWORK:
      return 'Мережева помилка: дані не надходять. Перевірте посилання та з’єднання з інтернетом.'
    case MediaError.MEDIA_ERR_DECODE:
      return 'Файл пошкоджений або закодований кодеком, який не підтримується.'
    case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
      return 'Формат чи кодек не підтримується, або за цією адресою немає медіафайлу.'
    default:
      return 'Невідома помилка відтворення.'
  }
}

export function useMediaPlayer() {
  const mediaRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  const sourceRef = useRef<PlaybackSource | null>(null)
  const loadIdRef = useRef(0)

  const [state, setState] = useState<PlayerState>(() => ({
    source: null,
    ...INITIAL_PLAYBACK,
    ...readStoredAudio()
  }))

  const patch = useCallback((partial: Partial<PlayerState>) => {
    setState((prev) => ({ ...prev, ...partial }))
  }, [])

  // Підписка на події HTMLMediaElement — єдине джерело правди про стан відтворення.
  useEffect(() => {
    const el = mediaRef.current
    if (!el) return

    const stored = readStoredAudio()
    el.volume = stored.volume
    el.muted = stored.muted

    // timeupdate приходить ~4 рази на секунду; для плавного progress bar під час
    // відтворення оновлюємо позицію кожен кадр через requestAnimationFrame.
    let frame = 0
    const tick = (): void => {
      patch({ currentTime: el.currentTime })
      frame = requestAnimationFrame(tick)
    }
    const startTicking = (): void => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(tick)
    }
    const stopTicking = (): void => cancelAnimationFrame(frame)

    const handlers: Partial<Record<keyof HTMLMediaElementEventMap, () => void>> = {
      loadedmetadata: () =>
        patch({
          ready: true,
          duration: el.duration,
          hasVideo: el.videoWidth > 0,
          isLive: el.duration === Infinity || hlsRef.current?.latestLevelDetails?.live === true,
          currentTime: el.currentTime
        }),
      durationchange: () => patch({ duration: el.duration }),
      timeupdate: () => patch({ currentTime: el.currentTime, bufferedEnd: bufferedEndAt(el) }),
      progress: () => patch({ bufferedEnd: bufferedEndAt(el) }),
      play: () => {
        patch({ paused: false, ended: false, stopped: false })
        startTicking()
      },
      playing: () => patch({ buffering: false }),
      pause: () => {
        stopTicking()
        patch({ paused: true, currentTime: el.currentTime })
      },
      waiting: () => patch({ buffering: true }),
      canplay: () => patch({ buffering: false }),
      seeked: () => patch({ currentTime: el.currentTime, bufferedEnd: bufferedEndAt(el) }),
      ended: () => {
        stopTicking()
        patch({ ended: true, paused: true, currentTime: el.duration })
      },
      volumechange: () => {
        patch({ volume: el.volume, muted: el.muted })
        storeAudio(el.volume, el.muted)
      },
      error: () => {
        if (!sourceRef.current) return // помилка від очищення попереднього джерела
        stopTicking()
        patch({ error: describeMediaError(el.error), buffering: false, paused: true })
      }
    }

    // 'resize' — зміна розміру кадру; є в HTMLVideoElement, але не в HTMLMediaElementEventMap.
    const onResize = (): void => patch({ hasVideo: el.videoWidth > 0 })

    for (const [name, handler] of Object.entries(handlers)) el.addEventListener(name, handler)
    el.addEventListener('resize', onResize)

    return () => {
      stopTicking()
      for (const [name, handler] of Object.entries(handlers)) el.removeEventListener(name, handler)
      el.removeEventListener('resize', onResize)
    }
  }, [patch])

  const unloadCurrent = useCallback(() => {
    const el = mediaRef.current
    const previous = sourceRef.current
    sourceRef.current = null

    hlsRef.current?.destroy()
    hlsRef.current = null

    if (el) {
      el.pause()
      el.removeAttribute('src')
      el.load()
    }
    if (previous?.revokeOnUnload) URL.revokeObjectURL(previous.url)
  }, [])

  // Звільняємо ресурси при закритті вікна / розмонтуванні.
  useEffect(() => unloadCurrent, [unloadCurrent])

  const load = useCallback(
    async (source: PlaybackSource) => {
      const el = mediaRef.current
      if (!el) return

      const loadId = ++loadIdRef.current
      unloadCurrent()
      sourceRef.current = source
      setState((prev) => ({ ...prev, ...INITIAL_PLAYBACK, source, buffering: true }))

      if (source.isHls) {
        // hls.js завантажується лише тоді, коли користувач відкриває HLS-потік.
        const { default: HlsLib } = await import('hls.js')
        if (loadId !== loadIdRef.current) return // поки вантажився модуль, користувач відкрив інше

        if (HlsLib.isSupported()) {
          const hls = new HlsLib()
          hlsRef.current = hls
          let recoveredMediaError = false

          hls.on(HlsLib.Events.LEVEL_LOADED, (_event, data) => {
            if (data.details.live) patch({ isLive: true })
          })
          hls.on(HlsLib.Events.ERROR, (_event, data) => {
            if (!data.fatal) return
            if (data.type === HlsLib.ErrorTypes.MEDIA_ERROR && !recoveredMediaError) {
              recoveredMediaError = true
              hls.recoverMediaError()
              return
            }
            patch({
              error:
                data.type === HlsLib.ErrorTypes.NETWORK_ERROR
                  ? 'Не вдалося завантажити HLS-потік. Перевірте посилання та з’єднання з інтернетом.'
                  : 'Помилка відтворення HLS-потоку.',
              buffering: false,
              paused: true
            })
            hls.destroy()
            hlsRef.current = null
          })

          hls.loadSource(source.url)
          hls.attachMedia(el)
        } else if (el.canPlayType('application/vnd.apple.mpegurl')) {
          el.src = source.url
        } else {
          patch({ error: 'HLS не підтримується в цьому середовищі.', buffering: false })
          return
        }
      } else {
        el.src = source.url
      }

      el.play().catch(() => {
        // AbortError при швидкій зміні джерела; реальні помилки прийдуть подією 'error'.
      })
    },
    [patch, unloadCurrent]
  )

  const play = useCallback(() => {
    const el = mediaRef.current
    if (!el || !sourceRef.current) return
    el.play().catch(() => {})
  }, [])

  const pause = useCallback(() => {
    mediaRef.current?.pause()
  }, [])

  const togglePlay = useCallback(() => {
    const el = mediaRef.current
    if (!el || !sourceRef.current) return
    if (el.paused || el.ended) play()
    else el.pause()
  }, [play])

  const stop = useCallback(() => {
    const el = mediaRef.current
    if (!el || !sourceRef.current) return
    el.pause()
    if (!hlsRef.current?.latestLevelDetails?.live && Number.isFinite(el.duration)) el.currentTime = 0
    patch({ stopped: true, ended: false, currentTime: el.currentTime })
  }, [patch])

  const seek = useCallback(
    (time: number) => {
      const el = mediaRef.current
      if (!el || !sourceRef.current || el.readyState === HTMLMediaElement.HAVE_NOTHING) return
      const [min, max] = seekableBounds(el)
      el.currentTime = clamp(time, min, max)
      patch({ currentTime: el.currentTime, stopped: false })
    },
    [patch]
  )

  const skip = useCallback(
    (deltaSeconds: number) => {
      const el = mediaRef.current
      if (el) seek(el.currentTime + deltaSeconds)
    },
    [seek]
  )

  const setVolume = useCallback((volume: number) => {
    const el = mediaRef.current
    if (!el) return
    el.volume = clamp(volume, 0, 1)
    if (el.volume > 0 && el.muted) el.muted = false
  }, [])

  const changeVolume = useCallback(
    (delta: number) => {
      const el = mediaRef.current
      if (el) setVolume(el.volume + delta)
    },
    [setVolume]
  )

  const toggleMute = useCallback(() => {
    const el = mediaRef.current
    if (!el) return
    if (el.muted || el.volume === 0) {
      el.muted = false
      if (el.volume === 0) el.volume = 0.5
    } else {
      el.muted = true
    }
  }, [])

  return {
    mediaRef,
    state,
    load,
    play,
    pause,
    togglePlay,
    stop,
    seek,
    skip,
    setVolume,
    changeVolume,
    toggleMute
  }
}

export type MediaPlayer = ReturnType<typeof useMediaPlayer>
