import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import apiClient from '../services/apiClient.js'
import { clearToken, getToken, saveRole, saveToken } from '../utils/storage.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    async function restoreSession() {
      if (!getToken()) {
        if (isMounted) setLoading(false)
        return
      }

      try {
        const response = await apiClient.get('/auth/me')
        if (isMounted) {
          setUser(response.data)
          saveRole(response.data.role)
        }
      } catch {
        clearToken()
        if (isMounted) setUser(null)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    restoreSession()
    return () => { isMounted = false }
  }, [])

  async function login(credentials) {
    const response = await apiClient.post('/auth/login', credentials)
    saveToken(response.data.token)
    saveRole(response.data.role)
    setUser(response.data)
    return response.data
  }

  async function register(details) {
    const response = await apiClient.post('/auth/register', details)
    saveToken(response.data.token)
    saveRole(response.data.role)
    setUser(response.data)
    return response.data
  }

  async function refreshUser() {
    const response = await apiClient.get('/auth/me')
    setUser(response.data)
    saveRole(response.data.role)
    return response.data
  }

  function logout() {
    clearToken()
    setUser(null)
  }

  const value = useMemo(() => ({ user, loading, login, register, logout, refreshUser }), [user, loading])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// oxlint-disable-next-line react/only-export-components
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
