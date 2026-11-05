import { RotateCcw, RotateCw } from 'lucide-react'

export function SkipIcon({ direction, seconds }: { direction: 'back' | 'forward'; seconds: number }) {
  const Arrow = direction === 'back' ? RotateCcw : RotateCw
  return (
    <span className="relative inline-flex h-[22px] w-[22px] items-center justify-center" aria-hidden>
      <Arrow size={22} strokeWidth={1.75} />
      <span className="absolute inset-0 flex items-center justify-center pt-px text-[8px] leading-none font-semibold tabular-nums">
        {seconds}
      </span>
    </span>
  )
}
