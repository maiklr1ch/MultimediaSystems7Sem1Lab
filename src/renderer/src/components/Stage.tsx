import { FolderOpen, LoaderCircle, TriangleAlert } from 'lucide-react'
import { AUDIO_EXTENSIONS, VIDEO_EXTENSIONS } from '@shared/formats'
import type { MediaPlayer, PlayerState } from '../hooks/useMediaPlayer'
import { formatBytes } from '../lib/formatTime'

interface StageProps {
  player: MediaPlayer
  dragActive: boolean
  onOpenFile: () => void
  onToggleFullscreen: () => void
}

const listFormats = (extensions: string[]): string =>
  extensions
    .filter((ext) => ext !== 'oga') // .oga — те саме, що .ogg; не захаращуємо список
    .map((ext) => (ext === 'webm' ? 'WebM' : ext === 'opus' ? 'Opus' : ext.toUpperCase()))
    .join(', ')

export function Stage({ player, dragActive, onOpenFile, onToggleFullscreen }: StageProps) {
  const { state } = player
  const { source, error } = state
  const showVideo = source !== null && state.hasVideo && !error
  const showAudioCard = source !== null && !state.hasVideo && !error && (state.ready || source.kind === 'audio')

  return (
    <main className="relative min-h-0 flex-1 overflow-hidden bg-stage text-white">
      <video
        ref={player.mediaRef}
        className={`absolute inset-0 h-full w-full object-contain ${showVideo ? 'opacity-100' : 'opacity-0'}`}
        playsInline
        preload="metadata"
        onClick={player.togglePlay}
        onDoubleClick={onToggleFullscreen}
        data-testid="media"
      />

      {!source && <EmptyState onOpenFile={onOpenFile} />}
      {showAudioCard && <AudioCard state={state} />}

      {state.buffering && !error && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-live="polite">
          <LoaderCircle className="spinner text-white/70" size={40} strokeWidth={1.5} aria-label="Завантаження" />
        </div>
      )}

      {error && <ErrorPanel message={error} onOpenFile={onOpenFile} />}

      {dragActive && (
        <div className="pointer-events-none absolute inset-3 flex items-center justify-center rounded-2xl border-2 border-dashed border-accent bg-black/70">
          <p className="text-lg font-medium">Відпустіть, щоб відкрити файл</p>
        </div>
      )}
    </main>
  )
}

function EmptyState({ onOpenFile }: { onOpenFile: () => void }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center p-8">
      <div className="max-w-md">
        <h1 className="text-2xl font-medium text-white/90">Відкрийте аудіо чи відео</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-white/55">
          Перетягніть файл у вікно, оберіть його на диску або вставте посилання в рядок угорі.
        </p>

        <button
          type="button"
          onClick={onOpenFile}
          className="key mt-6 inline-flex h-10 items-center gap-2 rounded-full px-5 text-sm font-medium text-ink"
        >
          <FolderOpen size={17} />
          Відкрити файл
          <kbd className="ml-1 font-sans text-xs text-ink-muted">Ctrl+O</kbd>
        </button>

        <dl className="mt-8 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13px]">
          <dt className="text-white/40">Аудіо</dt>
          <dd className="text-white/70">{listFormats(AUDIO_EXTENSIONS)}</dd>
          <dt className="text-white/40">Відео</dt>
          <dd className="text-white/70">{listFormats(VIDEO_EXTENSIONS)}</dd>
          <dt className="text-white/40">За посиланням</dt>
          <dd className="text-white/70">ті самі формати по http(s), а також HLS-потоки (.m3u8)</dd>
        </dl>
      </div>
    </div>
  )
}

function AudioCard({ state }: { state: PlayerState }) {
  const dots: { cx: number; cy: number }[] = []
  for (let y = -84; y <= 84; y += 12) {
    for (let x = -84; x <= 84; x += 12) {
      if (x * x + y * y <= 80 * 80) dots.push({ cx: x, cy: y })
    }
  }
  const playing = !state.paused && !state.buffering
  const source = state.source!

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-6 p-8">
      <svg viewBox="-100 -100 200 200" className="h-[min(42vh,240px)] w-[min(42vh,240px)]" aria-hidden>
        <circle r="98" fill="#16191d" />
        <circle
          r="96"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2"
          className="transition-opacity duration-500"
          opacity={playing ? 1 : 0}
        />
        {dots.map(({ cx, cy }) => (
          <circle key={`${cx}:${cy}`} cx={cx} cy={cy} r="3.4" fill="#3a3f47" />
        ))}
      </svg>
      <div className="max-w-[min(90%,560px)] text-center">
        <p className="truncate text-lg font-medium text-white/90">{source.title}</p>
        <p className="mt-1 text-sm text-white/45">
          {source.origin === 'url' ? 'Аудіо за посиланням' : 'Аудіофайл'}
          {source.sizeBytes !== undefined ? `, ${formatBytes(source.sizeBytes)}` : ''}
        </p>
      </div>
    </div>
  )
}

function ErrorPanel({ message, onOpenFile }: { message: string; onOpenFile: () => void }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center p-8" role="alert">
      <div className="max-w-md">
        <TriangleAlert className="text-accent" size={28} strokeWidth={1.75} />
        <p className="mt-3 text-lg font-medium text-white/90">Не вдалося відтворити</p>
        <p className="mt-1.5 text-[15px] leading-relaxed text-white/60" data-testid="error-message">
          {message}
        </p>
        <button
          type="button"
          onClick={onOpenFile}
          className="key mt-5 inline-flex h-10 items-center gap-2 rounded-full px-5 text-sm font-medium text-ink"
        >
          <FolderOpen size={17} />
          Відкрити інший файл
        </button>
      </div>
    </div>
  )
}
