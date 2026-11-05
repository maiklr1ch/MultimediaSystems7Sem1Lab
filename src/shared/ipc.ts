import type { MediaKind } from './formats'

/** Канали IPC між main і renderer. */
export const IPC = {
  openFileDialog: 'media:open-file-dialog',
  menuCommand: 'menu:command'
} as const

/** Команди, які надсилає меню застосунку (main → renderer). */
export type MenuCommand = 'open-file' | 'open-url'

/** Результат вибору файлу в нативному діалозі. */
export interface OpenedFile {
  /** URL у власній схемі media://, який можна віддати в <video src>. */
  url: string
  /** Ім'я файлу без шляху. */
  name: string
  kind: MediaKind
  sizeBytes: number
}

/** API, яке preload відкриває у window.mediaApi. */
export interface MediaApi {
  openFileDialog(): Promise<OpenedFile | null>
  onMenuCommand(handler: (command: MenuCommand) => void): () => void
}
