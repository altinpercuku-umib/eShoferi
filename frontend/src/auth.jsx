import { createContext, useContext, useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router'
import { api } from './api.js'
import PageLoader from './components/PageLoader.jsx'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)

  // On startup: get a CSRF cookie, then ask the server who we are.
  // The login cookies are httpOnly, so JavaScript can't check them directly - only the server can.
  useEffect(() => {
    let cancelled = false
    async function restoreSession() {
      try {
        await api.csrf()
        const me = await api.me()
        if (!cancelled) setUser(me)
      } catch {
        // Not logged in - that's fine.
      } finally {
        if (!cancelled) setReady(true)
      }
    }
    restoreSession()
    return () => {
      cancelled = true
    }
  }, [])

  async function login(credentials) {
    setUser(await api.login(credentials))
  }

  async function register(details) {
    setUser(await api.register(details))
  }

  async function logout() {
    try {
      await api.logout()
    } finally {
      setUser(null)
    }
  }

  return (
    <AuthContext.Provider value={{ user, ready, login, register, logout }}>{children}</AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}

// Wrap pages that need a logged-in user. Visitors are sent to /login and come back afterwards.
export function RequireAuth({ children }) {
  const { user, ready } = useAuth()
  const location = useLocation()

  if (!ready) return <PageLoader />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  return children
}
