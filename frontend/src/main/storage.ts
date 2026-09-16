import { app, safeStorage } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'fs'

export interface VaultCredentials {
  apiId: number
  apiHash: string
  sessionString: string
}

const getStoragePath = (): string => join(app.getPath('userData'), 'televault_session.bin')

/**
 * Encrypts and securely saves user's Telegram credentials using OS-level DPAPI / Keychain.
 */
export function saveCredentials(credentials: VaultCredentials): boolean {
  try {
    const json = JSON.stringify(credentials)
    const storagePath = getStoragePath()

    if (safeStorage.isEncryptionAvailable()) {
      const encryptedBuffer = safeStorage.encryptString(json)
      writeFileSync(storagePath, encryptedBuffer)
      return true
    } else {
      console.warn('[Storage] safeStorage encryption is not available on this platform.')
      // Fallback base64 file with warning
      writeFileSync(storagePath + '.txt', Buffer.from(json).toString('base64'))
      return true
    }
  } catch (error) {
    console.error('[Storage] Error saving credentials:', error)
    return false
  }
}

/**
 * Reads and decrypts stored credentials using OS-level DPAPI / Keychain.
 */
export function getCredentials(): VaultCredentials | null {
  try {
    const storagePath = getStoragePath()

    if (existsSync(storagePath) && safeStorage.isEncryptionAvailable()) {
      const encryptedBuffer = readFileSync(storagePath)
      const decryptedString = safeStorage.decryptString(encryptedBuffer)
      return JSON.parse(decryptedString) as VaultCredentials
    }

    const fallbackPath = storagePath + '.txt'
    if (existsSync(fallbackPath)) {
      const content = readFileSync(fallbackPath, 'utf8')
      const decoded = Buffer.from(content, 'base64').toString('utf8')
      return JSON.parse(decoded) as VaultCredentials
    }

    return null
  } catch (error) {
    console.error('[Storage] Error reading credentials:', error)
    return null
  }
}

/**
 * Deletes stored credentials from disk.
 */
export function clearCredentials(): boolean {
  try {
    const storagePath = getStoragePath()
    if (existsSync(storagePath)) {
      unlinkSync(storagePath)
    }
    const fallbackPath = storagePath + '.txt'
    if (existsSync(fallbackPath)) {
      unlinkSync(fallbackPath)
    }
    return true
  } catch (error) {
    console.error('[Storage] Error clearing credentials:', error)
    return false
  }
}
