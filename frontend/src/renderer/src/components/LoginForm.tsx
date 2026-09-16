import React, { useState, useEffect } from 'react'
import './LoginForm.css'

type AuthStep = 'INITIAL_CHECK' | 'INPUT_CREDS' | 'INPUT_CODE' | 'INPUT_2FA' | 'AUTHENTICATED'

interface TelegramUser {
  id?: string | number
  firstName?: string
  lastName?: string
  username?: string
  phone?: string
}

const API_BASE =
  typeof window !== 'undefined' && window.location.protocol.startsWith('http')
    ? '/api/auth'
    : 'http://127.0.0.1:8000/api/auth'

export default function LoginForm(): React.JSX.Element {
  const [step, setStep] = useState<AuthStep>('INITIAL_CHECK')
  const [apiId, setApiId] = useState<string>('')
  const [apiHash, setApiHash] = useState<string>('')
  const [phoneNumber, setPhoneNumber] = useState<string>('')
  const [phoneCode, setPhoneCode] = useState<string>('')
  const [password, setPassword] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [user, setUser] = useState<TelegramUser | null>(null)

  // Auto-restore session from safeStorage on mount
  useEffect(() => {
    async function checkSavedSession(): Promise<void> {
      try {
        if (window.api?.storage) {
          const saved = await window.api.storage.getCredentials()
          if (saved?.sessionString && saved?.apiId && saved?.apiHash) {
            setApiId(String(saved.apiId))
            setApiHash(saved.apiHash)

            const res = await fetch(`${API_BASE}/restore`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(saved)
            })
            const data = await res.json()
            if (data.success && data.status === 'AUTHENTICATED') {
              setUser(data.user)
              setStep('AUTHENTICATED')
              return
            }
          }
        }

        // Check if backend already has an active session
        const statusRes = await fetch(`${API_BASE}/status`)
        const statusData = await statusRes.json()
        if (statusData.success && statusData.isAuthenticated) {
          setUser(statusData.user)
          setStep('AUTHENTICATED')
          return
        }
      } catch (err: unknown) {
        console.log('[Auth] Backend offline or no saved session:', err)
      }
      setStep('INPUT_CREDS')
    }

    checkSavedSession()
  }, [])

  // Step 1: Send verification code
  const handleSendCode = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await fetch(`${API_BASE}/send-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiId: Number(apiId),
          apiHash: apiHash.trim(),
          phoneNumber: phoneNumber.trim()
        })
      })

      const data = await res.json()
      if (!data.success) {
        throw new Error(data.error || 'Failed to send code')
      }

      setStep('INPUT_CODE')
    } catch (err: any) {
      const msg =
        err.message === 'Failed to fetch'
          ? 'Cannot reach backend server. Make sure "npm run dev" is running in the backend folder (port 8000).'
          : err.message
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  // Step 2: Verify code
  const handleVerifyCode = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await fetch(`${API_BASE}/sign-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneCode: phoneCode.trim() })
      })

      const data = await res.json()
      if (!data.success) {
        throw new Error(data.error || 'Sign in failed')
      }

      if (data.status === '2FA_REQUIRED') {
        setStep('INPUT_2FA')
        return
      }

      if (data.status === 'AUTHENTICATED') {
        if (window.api?.storage && data.credentials) {
          await window.api.storage.saveCredentials(data.credentials)
        }
        setUser(data.user)
        setStep('AUTHENTICATED')
      }
    } catch (err: any) {
      setError(err.message || 'Invalid code or sign in error')
    } finally {
      setLoading(false)
    }
  }

  // Step 3: 2FA Password
  const handleSubmit2FA = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await fetch(`${API_BASE}/2fa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      })

      const data = await res.json()
      if (!data.success) {
        throw new Error(data.error || '2FA verification failed')
      }

      if (data.status === 'AUTHENTICATED') {
        if (window.api?.storage && data.credentials) {
          await window.api.storage.saveCredentials(data.credentials)
        }
        setUser(data.user)
        setStep('AUTHENTICATED')
      }
    } catch (err: any) {
      setError(err.message || 'Incorrect 2FA password')
    } finally {
      setLoading(false)
    }
  }

  // Log out
  const handleLogout = async (): Promise<void> => {
    try {
      await fetch(`${API_BASE}/logout`, { method: 'POST' })
      if (window.api?.storage) {
        await window.api.storage.clearCredentials()
      }
    } catch (err) {
      console.error('Logout error:', err)
    }
    setUser(null)
    setPhoneCode('')
    setPassword('')
    setStep('INPUT_CREDS')
  }

  if (step === 'INITIAL_CHECK') {
    return (
      <div className="auth-container">
        <div className="auth-header">
          <div className="auth-badge">Checking Session</div>
          <h2 className="auth-title">TeleVault</h2>
          <p className="auth-subtitle">Restoring encrypted credentials...</p>
        </div>
      </div>
    )
  }

  if (step === 'AUTHENTICATED') {
    const initials = (user?.firstName?.[0] || 'U') + (user?.lastName?.[0] || '')
    return (
      <div className="auth-container">
        <div className="user-card">
          <div className="user-avatar">{initials.toUpperCase()}</div>
          <div className="user-details">
            <span className="user-badge">Connected</span>
            <h3>
              {user?.firstName} {user?.lastName || ''}
            </h3>
            {user?.username && <p>@{user.username}</p>}
            {user?.phone && <p>{user.phone}</p>}
          </div>
          <button className="auth-btn-secondary" onClick={handleLogout}>
            Disconnect & Log out
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-container">
      <div className="auth-header">
        <div className="auth-badge">Encrypted MTProto</div>
        <h2 className="auth-title">TeleVault Login</h2>
        <p className="auth-subtitle">
          {step === 'INPUT_CREDS' && 'Connect your personal Telegram account as encrypted vault.'}
          {step === 'INPUT_CODE' && `Enter the OTP code sent to ${phoneNumber}.`}
          {step === 'INPUT_2FA' && 'Two-step verification is enabled for this account.'}
        </p>
      </div>

      {error && (
        <div className="auth-error" style={{ marginBottom: '16px' }}>
          <span>⚠️</span> {error}
        </div>
      )}

      {step === 'INPUT_CREDS' && (
        <form className="auth-form" onSubmit={handleSendCode}>
          <div className="form-group">
            <label className="form-label">API ID</label>
            <input
              className="form-input"
              type="number"
              placeholder="e.g. 12345678"
              value={apiId}
              onChange={(e) => setApiId(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">API Hash</label>
            <input
              className="form-input"
              type="text"
              placeholder="e.g. 0123456789abcdef0123456789abcdef"
              value={apiHash}
              onChange={(e) => setApiHash(e.target.value)}
              required
            />
            <span className="form-helper">
              Don't have credentials? Get them at{' '}
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault()
                  window.electron?.ipcRenderer?.send?.('ping') // or shell.openExternal
                }}
              >
                my.telegram.org
              </a>
            </span>
          </div>

          <div className="form-group">
            <label className="form-label">Phone Number</label>
            <input
              className="form-input"
              type="tel"
              placeholder="+1234567890"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              required
            />
          </div>

          <button className="auth-btn-primary" type="submit" disabled={loading}>
            {loading ? 'Sending Code...' : 'Send Login Code'}
          </button>
        </form>
      )}

      {step === 'INPUT_CODE' && (
        <form className="auth-form" onSubmit={handleVerifyCode}>
          <div className="form-group">
            <label className="form-label">Telegram Code (OTP)</label>
            <input
              className="form-input"
              type="text"
              placeholder="Enter code from Telegram app"
              value={phoneCode}
              onChange={(e) => setPhoneCode(e.target.value)}
              autoFocus
              required
            />
          </div>

          <button className="auth-btn-primary" type="submit" disabled={loading}>
            {loading ? 'Verifying...' : 'Verify Code'}
          </button>
          <button
            className="auth-btn-secondary"
            type="button"
            onClick={() => setStep('INPUT_CREDS')}
          >
            Back
          </button>
        </form>
      )}

      {step === 'INPUT_2FA' && (
        <form className="auth-form" onSubmit={handleSubmit2FA}>
          <div className="form-group">
            <label className="form-label">Two-Step Verification Password</label>
            <input
              className="form-input"
              type="password"
              placeholder="Enter your 2FA password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              required
            />
          </div>

          <button className="auth-btn-primary" type="submit" disabled={loading}>
            {loading ? 'Logging in...' : 'Submit Password'}
          </button>
          <button
            className="auth-btn-secondary"
            type="button"
            onClick={() => setStep('INPUT_CODE')}
          >
            Back
          </button>
        </form>
      )}
    </div>
  )
}
