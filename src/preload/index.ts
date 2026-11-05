import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IPC, type MediaApi, type MenuCommand } from '../shared/ipc'

const api: MediaApi = {
  openFileDialog: () => ipcRenderer.invoke(IPC.openFileDialog),

  onMenuCommand(handler) {
    const listener = (_event: IpcRendererEvent, command: MenuCommand): void => handler(command)
    ipcRenderer.on(IPC.menuCommand, listener)
    return () => ipcRenderer.removeListener(IPC.menuCommand, listener)
  }
}

contextBridge.exposeInMainWorld('mediaApi', api)
