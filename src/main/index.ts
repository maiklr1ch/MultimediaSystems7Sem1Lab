import { stat } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { app, BrowserWindow, dialog, ipcMain, Menu, shell } from 'electron'
import { AUDIO_EXTENSIONS, VIDEO_EXTENSIONS, getFormat } from '../shared/formats'
import { IPC, type OpenedFile } from '../shared/ipc'
import { exposeFile, handleMediaProtocol, registerMediaSchemePrivileges } from './mediaProtocol'
import { buildAppMenu } from './menu'

registerMediaSchemePrivileges()

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1120,
    height: 760,
    minWidth: 720,
    minHeight: 520,
    title: 'Медіапрогравач',
    backgroundColor: '#000000',
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  win.once('ready-to-show', () => win.show())

  // Зовнішні посилання відкриваємо в браузері
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })

  win.webContents.on('will-navigate', (event, url) => {
    if (url !== win.webContents.getURL()) event.preventDefault()
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

ipcMain.handle(IPC.openFileDialog, async (event): Promise<OpenedFile | null> => {
  const owner = BrowserWindow.fromWebContents(event.sender)
  const options: Electron.OpenDialogOptions = {
    title: 'Відкрити медіафайл',
    properties: ['openFile'],
    filters: [
      { name: 'Медіафайли', extensions: [...AUDIO_EXTENSIONS, ...VIDEO_EXTENSIONS] },
      { name: 'Аудіо', extensions: AUDIO_EXTENSIONS },
      { name: 'Відео', extensions: VIDEO_EXTENSIONS },
      { name: 'Усі файли', extensions: ['*'] }
    ]
  }

  const result = owner ? await dialog.showOpenDialog(owner, options) : await dialog.showOpenDialog(options)
  const filePath = result.filePaths[0]
  if (result.canceled || !filePath) return null

  const { size } = await stat(filePath)
  return {
    url: exposeFile(filePath),
    name: basename(filePath),
    kind: getFormat(filePath)?.kind ?? 'video',
    sizeBytes: size
  }
})

app.whenReady().then(() => {
  handleMediaProtocol()
  Menu.setApplicationMenu(buildAppMenu())
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
