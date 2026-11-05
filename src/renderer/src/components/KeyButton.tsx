import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface KeyButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Підпис для screen reader і підказка при наведенні. */
  label: string
  /** Гаряча клавіша, додається до підказки. */
  shortcut?: string
  variant?: 'default' | 'accent'
  size?: 'md' | 'lg'
  children: ReactNode
}

/** Кругла "фізична" кнопка панелі керування. */
export function KeyButton({
  label,
  shortcut,
  variant = 'default',
  size = 'md',
  className = '',
  children,
  ...rest
}: KeyButtonProps) {
  const dimensions = size === 'lg' ? 'h-14 w-14' : 'h-10 w-10'
  return (
    <button
      type="button"
      aria-label={label}
      title={shortcut ? `${label} (${shortcut})` : label}
      // Клік мишею не забирає фокус: інакше пробіл "натискав" би сфокусовану кнопку
      // замість глобальної гарячої клавіші Play/Pause. З клавіатури (Tab) фокус працює як зазвичай.
      onMouseDown={(event) => event.preventDefault()}
      className={`key inline-flex shrink-0 items-center justify-center rounded-full ${dimensions} ${
        variant === 'accent' ? 'key-accent' : ''
      } ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}
