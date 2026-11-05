import { useEffect, useRef } from 'react'

export type ShortcutMap = Record<string, () => void>

/**
 * Глобальні гарячі клавіші за KeyboardEvent.code (не залежить від розкладки — працює і з українською).
 * Ctrl+O / Ctrl+L обробляє меню застосунку в main-процесі.
 */
export function useAppShortcuts(shortcuts: ShortcutMap): void {
  const ref = useRef(shortcuts)
  ref.current = shortcuts

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return

      const action = ref.current[event.code]
      if (!action) return
      event.preventDefault()
      action()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
