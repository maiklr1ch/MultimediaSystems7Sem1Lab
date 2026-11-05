import { useState, type FormEvent, type RefObject } from 'react'
import { FolderOpen, Link2 } from 'lucide-react'

interface ToolbarProps {
  urlInputRef: RefObject<HTMLInputElement | null>
  onOpenFile: () => void
  onOpenUrl: (url: string) => boolean
}

export function Toolbar({ urlInputRef, onOpenFile, onOpenUrl }: ToolbarProps) {
  const [url, setUrl] = useState('')

  function handleSubmit(event: FormEvent): void {
    event.preventDefault()
    if (onOpenUrl(url)) {
      setUrl('')
      urlInputRef.current?.blur()
    }
  }

  return (
    <header className="flex shrink-0 items-center gap-3 border-b border-deck-line bg-deck px-4 py-2.5">
      <button
        type="button"
        onClick={onOpenFile}
        title="Відкрити файл (Ctrl+O)"
        className="key inline-flex h-9 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-medium"
      >
        <FolderOpen size={16} />
        Відкрити файл
      </button>

      <form className="flex min-w-0 flex-1 items-center gap-2" onSubmit={handleSubmit}>
        <label htmlFor="media-url" className="sr-only">
          Посилання на аудіо чи відео
        </label>
        <div className="relative min-w-0 flex-1">
          <Link2
            size={16}
            className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-muted"
            aria-hidden
          />
          <input
            id="media-url"
            ref={urlInputRef}
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') event.currentTarget.blur()
            }}
            placeholder="https посилання на MP4, MP3, WebM або HLS (.m3u8)"
            spellCheck={false}
            autoComplete="off"
            className="h-9 w-full rounded-full border border-deck-line bg-deck-raised pr-4 pl-10 text-sm shadow-[inset_0_1px_2px_rgb(0_0_0/0.08)] select-text placeholder:text-ink-muted/80"
          />
        </div>
        <button
          type="submit"
          disabled={!url.trim()}
          title="Відтворити за посиланням (Enter)"
          className="key inline-flex h-9 shrink-0 items-center rounded-full px-4 text-sm font-medium"
        >
          Відтворити
        </button>
      </form>
    </header>
  )
}
