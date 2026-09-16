import { ElectronAPI } from '@electron-toolkit/preload'

export interface VaultCredentials {
  apiId: number
  apiHash: string
  sessionString: string
}

export interface CustomAPI {
  storage: {
    saveCredentials: (credentials: VaultCredentials) => Promise<boolean>
    getCredentials: () => Promise<VaultCredentials | null>
    clearCredentials: () => Promise<boolean>
  }
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: CustomAPI
  }
}
