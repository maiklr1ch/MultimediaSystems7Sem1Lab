import { BrowserWindow, Menu, type MenuItemConstructorOptions } from 'electron'
import { IPC, type MenuCommand } from '../shared/ipc'

function send(command: MenuCommand): void {
  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  win?.webContents.send(IPC.menuCommand, command)
}

export function buildAppMenu(): Menu {
  const isMac = process.platform === 'darwin'

  const template: MenuItemConstructorOptions[] = [
    ...(isMac ? [{ role: 'appMenu' } as MenuItemConstructorOptions] : []),
    {
      label: 'Файл',
      submenu: [
        { label: 'Відкрити файл…', accelerator: 'CmdOrCtrl+O', click: () => send('open-file') },
        { label: 'Відкрити посилання…', accelerator: 'CmdOrCtrl+L', click: () => send('open-url') },
        { type: 'separator' },
        isMac ? { role: 'close', label: 'Закрити вікно' } : { role: 'quit', label: 'Вийти' }
      ]
    },
    {
      label: 'Вигляд',
      submenu: [{ role: 'toggleDevTools', label: 'Інструменти розробника' }]
    }
  ]

  return Menu.buildFromTemplate(template)
}
