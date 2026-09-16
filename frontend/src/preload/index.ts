import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

export interface VaultCredentials {
  apiId: number
  apiHash: string
  sessionString: string
}

// Custom APIs for renderer
const api = {
  storage: {
    saveCredentials: (credentials: VaultCredentials): Promise<boolean> =>
      ipcRenderer.invoke('storage:save', credentials),
    getCredentials: (): Promise<VaultCredentials | null> =>
      ipcRenderer.invoke('storage:get'),
    clearCredentials: (): Promise<boolean> =>
      ipcRenderer.invoke('storage:clear')
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
