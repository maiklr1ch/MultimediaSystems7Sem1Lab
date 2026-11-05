import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { clamp } from '../hooks/useMediaPlayer'

// Власний слайдер замість <input type="range">: потрібні шар буферизації,
// підказка з часом під курсором і перегляд позиції під час перетягування.

interface SliderProps {
  value: number
  max: number
  step: number
  onInput: (value: number) => void
  onCommit?: (value: number) => void
  buffered?: number
  disabled?: boolean
  label: string
  valueText: string
  hoverText?: (value: number) => string
  size?: 'lg' | 'sm'
  className?: string
}

export function Slider({
  value,
  max,
  step,
  onInput,
  onCommit,
  buffered,
  disabled = false,
  label,
  valueText,
  hoverText,
  size = 'lg',
  className = ''
}: SliderProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [dragValue, setDragValue] = useState<number | null>(null)
  const [hover, setHover] = useState<{ x: number; value: number; width: number } | null>(null)

  const safeMax = max > 0 && Number.isFinite(max) ? max : 0
  const shown = dragValue ?? value
  const fraction = safeMax > 0 ? clamp(shown / safeMax, 0, 1) : 0

  function pointToValue(clientX: number): { value: number; x: number; width: number } {
    const rect = trackRef.current!.getBoundingClientRect()
    const x = clamp(clientX - rect.left, 0, rect.width)
    return { value: rect.width > 0 ? (x / rect.width) * safeMax : 0, x, width: rect.width }
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>): void {
    if (disabled || safeMax === 0 || event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    const { value: next } = pointToValue(event.clientX)
    setDragValue(next)
    onInput(next)
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>): void {
    if (disabled || safeMax === 0) return
    const point = pointToValue(event.clientX)
    if (hoverText) setHover(point)
    if (dragValue !== null) {
      setDragValue(point.value)
      onInput(point.value)
    }
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>): void {
    if (dragValue === null) return
    const { value: next } = pointToValue(event.clientX)
    setDragValue(null)
    onCommit?.(next)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (disabled || safeMax === 0) return
    const deltas: Record<string, number> = {
      ArrowLeft: -step,
      ArrowDown: -step,
      ArrowRight: step,
      ArrowUp: step,
      PageDown: -step * 4,
      PageUp: step * 4
    }
    let next: number | undefined
    if (event.key in deltas) next = clamp(value + deltas[event.key], 0, safeMax)
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = safeMax
    if (next === undefined) return

    event.preventDefault()
    event.stopPropagation()
    onInput(next)
    onCommit?.(next)
  }

  const trackHeight = size === 'lg' ? 'h-1.5 group-hover:h-2' : 'h-1'
  const thumbSize = size === 'lg' ? 'h-4 w-4' : 'h-3 w-3'

  return (
    <div
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={safeMax}
      aria-valuenow={Math.round(shown * 100) / 100}
      aria-valuetext={valueText}
      aria-disabled={disabled}
      className={`group relative flex h-6 touch-none items-center rounded-full ${
        disabled ? 'cursor-default opacity-50' : 'cursor-pointer'
      } ${className}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => setDragValue(null)}
      onPointerLeave={() => setHover(null)}
      onKeyDown={handleKeyDown}
    >
      <div
        ref={trackRef}
        className={`relative w-full overflow-hidden rounded-full bg-ink/15 transition-[height] duration-100 ${trackHeight}`}
      >
        {buffered !== undefined && (
          <div className="absolute inset-y-0 left-0 bg-ink/20" style={{ width: `${clamp(buffered, 0, 1) * 100}%` }} />
        )}
        <div className="absolute inset-y-0 left-0 bg-accent" style={{ width: `${fraction * 100}%` }} />
      </div>

      {!disabled && safeMax > 0 && (
        <div
          className={`pointer-events-none absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-accent-strong bg-deck-raised shadow-[0_1px_3px_rgb(0_0_0/0.3)] ${thumbSize}`}
          style={{ left: `${fraction * 100}%` }}
        />
      )}

      {hover && hoverText && !disabled && safeMax > 0 && (
        <div
          className="pointer-events-none absolute bottom-full mb-1.5 -translate-x-1/2 rounded-md bg-display px-2 py-0.5 font-mono text-xs text-white tabular-nums"
          style={{ left: clamp(hover.x, 28, Math.max(28, hover.width - 28)) }}
        >
          {hoverText(dragValue ?? hover.value)}
        </div>
      )}
    </div>
  )
}
