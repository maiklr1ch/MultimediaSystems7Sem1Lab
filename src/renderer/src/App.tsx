import { useCallback, useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { ControlDeck, SKIP_SECONDS } from './components/ControlDeck'
import { Stage } from './components/Stage'
import { Toolbar } from './components/Toolbar'
import { useAppShortcuts } from './hooks/useAppShortcuts'
import { useFileDrop } from './hooks/useFileDrop'
import { useFullscreen } from './hooks/useFullscreen'
import { useMediaPlayer } from './hooks/useMediaPlayer'
import { SourceError, sourceFromDroppedFile, sourceFromOpenedFile, sourceFromUrl } from './lib/sources'

export function App() {
  const player = useMediaPlayer()
  const { isFullscreen, toggleFullscreen } = useFullscreen()
  const urlInputRef = useRef<HTMLInputElement>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const { load } = player

  const openFile = useCallback(async () => {
    try {
      const file = await window.mediaApi.openFileDialog()
      if (file) {
        setNotice(null)
        void load(sourceFromOpenedFile(file))
      }
    } catch (error) {
      setNotice(`Не вдалося відкрити файл: ${(error as Error).message}`)
    }
  }, [load])

  const openUrl = useCallback(
    (input: string): boolean => {
      try {
        const source = sourceFromUrl(input)
        setNotice(null)
        void load(source)
        return true
      } catch (error) {
        setNotice(error instanceof SourceError ? error.message : 'Не вдалося відкрити посилання.')
        return false
      }
    },
    [load]
  )

  const dragActive = useFileDrop((file) => {
    try {
      const source = sourceFromDroppedFile(file)
      setNotice(null)
      void load(source)
    } catch (error) {
      setNotice(error instanceof SourceError ? error.message : 'Не вдалося відкрити файл.')
    }
  })

  // Команди з меню застосунку (Ctrl+O, Ctrl+L).
  useEffect(
    () =>
      window.mediaApi.onMenuCommand((command) => {
        if (command === 'open-file') void openFile()
        if (command === 'open-url') {
          if (document.fullscreenElement) void document.exitFullscreen()
          urlInputRef.current?.focus()
          urlInputRef.current?.select()
        }
      }),
    [openFile]
  )

  useAppShortcuts({
    Space: player.togglePlay,
    KeyK: player.togglePlay,
    KeyS: player.stop,
    ArrowLeft: () => player.skip(-5),
    ArrowRight: () => player.skip(5),
    KeyJ: () => player.skip(-SKIP_SECONDS),
    KeyL: () => player.skip(SKIP_SECONDS),
    ArrowUp: () => player.changeVolume(0.05),
    ArrowDown: () => player.changeVolume(-0.05),
    KeyM: player.toggleMute,
    KeyF: toggleFullscreen
  })

  // Назва файлу в заголовку вікна.
  const title = player.state.source?.title
  useEffect(() => {
    document.title = title ? `${title} — Медіапрогравач` : 'Медіапрогравач'
  }, [title])

  // Повідомлення ховається саме через кілька секунд.
  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(null), 7000)
    return () => clearTimeout(timer)
  }, [notice])

  return (
    <div className="flex h-full flex-col">
      {!isFullscreen && <Toolbar urlInputRef={urlInputRef} onOpenFile={openFile} onOpenUrl={openUrl} />}

      {notice && (
        <div
          role="alert"
          data-testid="notice"
          className="flex shrink-0 items-center gap-3 border-b border-deck-line bg-deck-raised px-4 py-2 text-sm"
        >
          <span className="h-2 w-2 shrink-0 rounded-full bg-danger" aria-hidden />
          <p className="min-w-0 flex-1">{notice}</p>
          <button
            type="button"
            aria-label="Закрити повідомлення"
            onClick={() => setNotice(null)}
            className="rounded-full p-1 text-ink-muted hover:text-ink"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <Stage player={player} dragActive={dragActive} onOpenFile={openFile} onToggleFullscreen={toggleFullscreen} />

      <ControlDeck player={player} isFullscreen={isFullscreen} onToggleFullscreen={toggleFullscreen} />
    </div>
  )
}
