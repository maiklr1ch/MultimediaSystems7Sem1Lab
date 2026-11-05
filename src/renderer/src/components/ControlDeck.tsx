import { Maximize, Minimize, Pause, Play, Square, Volume1, Volume2, VolumeX } from 'lucide-react'
import type { MediaPlayer, PlayerState } from '../hooks/useMediaPlayer'
import { formatTime } from '../lib/formatTime'
import { KeyButton } from './KeyButton'
import { SkipIcon } from './SkipIcon'
import { Slider } from './Slider'

export const SKIP_SECONDS = 10

interface ControlDeckProps {
  player: MediaPlayer
  isFullscreen: boolean
  onToggleFullscreen: () => void
}

export function ControlDeck({ player, isFullscreen, onToggleFullscreen }: ControlDeckProps) {
  const { state } = player
  const hasSource = state.source !== null && state.error === null
  const canSeek = hasSource && state.ready && !state.isLive && Number.isFinite(state.duration)
  const isPlaying = hasSource && !state.paused

  return (
    <footer className="shrink-0 border-t border-deck-line bg-deck px-5 pt-2 pb-4">
      <Slider
        value={state.currentTime}
        max={canSeek ? state.duration : 0}
        step={5}
        buffered={canSeek ? state.bufferedEnd / state.duration : undefined}
        disabled={!canSeek}
        onInput={player.seek}
        label="Позиція відтворення"
        valueText={`${formatTime(state.currentTime, state.duration)} з ${formatTime(state.duration)}`}
        hoverText={(value) => formatTime(value, state.duration)}
      />

      <div className="mt-2 flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <KeyButton
            label={`Назад на ${SKIP_SECONDS} с`}
            shortcut="J"
            disabled={!hasSource || !state.ready}
            onClick={() => player.skip(-SKIP_SECONDS)}
          >
            <SkipIcon direction="back" seconds={SKIP_SECONDS} />
          </KeyButton>

          <KeyButton
            label={isPlaying ? 'Пауза' : 'Відтворити'}
            shortcut="Пробіл"
            variant="accent"
            size="lg"
            disabled={!hasSource}
            onClick={player.togglePlay}
          >
            {isPlaying ? (
              <Pause size={24} fill="currentColor" strokeWidth={0} />
            ) : (
              <Play size={24} fill="currentColor" strokeWidth={0} className="translate-x-px" />
            )}
          </KeyButton>

          <KeyButton label="Стоп" shortcut="S" disabled={!hasSource} onClick={player.stop}>
            <Square size={15} fill="currentColor" strokeWidth={0} />
          </KeyButton>

          <KeyButton
            label={`Вперед на ${SKIP_SECONDS} с`}
            shortcut="L"
            disabled={!hasSource || !state.ready}
            onClick={() => player.skip(SKIP_SECONDS)}
          >
            <SkipIcon direction="forward" seconds={SKIP_SECONDS} />
          </KeyButton>
        </div>

        <TimeDisplay state={state} />

        <NowPlaying state={state} />

        <VolumeControl player={player} />

        <KeyButton
          label={isFullscreen ? 'Вийти з повноекранного режиму' : 'Повноекранний режим'}
          shortcut="F"
          onClick={onToggleFullscreen}
        >
          {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
        </KeyButton>
      </div>
    </footer>
  )
}

/** Таймкод — "вбудований дисплей" панелі. */
function TimeDisplay({ state }: { state: PlayerState }) {
  const hasDuration = Number.isFinite(state.duration)
  return (
    <div
      className="display-window flex h-11 shrink-0 items-baseline gap-1.5 rounded-lg px-3.5 pt-2 font-mono tabular-nums"
      aria-label="Час відтворення"
    >
      <span className="text-[22px] leading-none text-display-ink" data-testid="current-time">
        {formatTime(state.currentTime, state.duration)}
      </span>
      {state.isLive ? (
        <span className="ml-1 inline-flex items-center gap-1 text-[13px] leading-none text-display-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-danger" />
          наживо
        </span>
      ) : (
        <span className="text-[15px] leading-none text-display-muted" data-testid="duration">
          / {hasDuration ? formatTime(state.duration) : '--:--'}
        </span>
      )}
    </div>
  )
}

function statusText(state: PlayerState): string {
  if (!state.source) return 'Нічого не відкрито'
  if (state.error) return 'Помилка'
  if (state.buffering) return 'Завантаження…'
  if (state.ended) return 'Завершено'
  if (state.stopped) return 'Зупинено'
  if (state.paused) return 'Пауза'
  return 'Відтворення'
}

function NowPlaying({ state }: { state: PlayerState }) {
  return (
    <div className="hidden min-w-0 flex-1 min-[820px]:block">
      <p className="truncate text-sm font-medium" title={state.source?.title}>
        {state.source?.title ?? 'Медіапрогравач'}
      </p>
      <p className="mt-0.5 flex items-center gap-2 text-xs text-ink-muted">
        {state.source && (
          <span className="rounded border border-deck-line px-1 py-px text-[10px] leading-none font-semibold text-ink-muted">
            {state.source.formatLabel}
          </span>
        )}
        <span data-testid="status">{statusText(state)}</span>
      </p>
    </div>
  )
}

function VolumeControl({ player }: { player: MediaPlayer }) {
  const { volume, muted } = player.state
  const effective = muted ? 0 : volume
  const Icon = effective === 0 ? VolumeX : effective < 0.5 ? Volume1 : Volume2

  return (
    <div className="ml-auto flex shrink-0 items-center gap-2">
      <KeyButton label={muted ? 'Увімкнути звук' : 'Вимкнути звук'} shortcut="M" onClick={player.toggleMute}>
        <Icon size={18} />
      </KeyButton>
      <Slider
        className="w-28"
        size="sm"
        value={effective}
        max={1}
        step={0.05}
        onInput={player.setVolume}
        label="Гучність"
        valueText={`${Math.round(effective * 100)}%`}
        hoverText={(value) => `${Math.round(value * 100)}%`}
      />
    </div>
  )
}
