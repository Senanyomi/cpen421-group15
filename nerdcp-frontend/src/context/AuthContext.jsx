import { createContext, useContext, useState, useCallback } from 'react'

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
  // Hydrate from localStorage so the session survives a page refresh
  const [token, setToken] = useState(() => localStorage.getItem('nerdcp_token') || null)
  const [user, setUser]   = useState(() => {
    try {
      const raw = localStorage.getItem('nerdcp_user')
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  })

  const login = useCallback((accessToken, userData) => {
    localStorage.setItem('nerdcp_token', accessToken)
    localStorage.setItem('nerdcp_user', JSON.stringify(userData))
    setToken(accessToken)
    setUser(userData)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('nerdcp_token')
    localStorage.removeItem('nerdcp_user')
    setToken(null)
    setUser(null)
  }, [])

  // Quick role checks used in the UI to hide/show admin controls
  const isAdmin      = user?.role === 'ADMIN'
  const isDispatcher = user?.role === 'DISPATCHER' || user?.role === 'ADMIN'
  const isAnalyst    = user?.role === 'ANALYST'    || user?.role === 'ADMIN'

  return (
    <AuthContext.Provider value={{ token, user, login, logout, isAdmin, isDispatcher, isAnalyst }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
