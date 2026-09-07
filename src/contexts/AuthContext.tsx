'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'

import Cookies from 'js-cookie'

import type { AuthUser, AuthState } from '@/types/api/auth'

const AUTH_COOKIE_KEY = 'auth-user'
const TOKEN_COOKIE_KEY = 'auth-token'

interface AuthContextType extends AuthState {
  login: (user: AuthUser) => void
  logout: () => void
  updateBranch: (branch: { id: number; name: string } | null) => void
}

const defaultContextValue: AuthContextType = {
  user: null,
  isAuthenticated: false,
  isLoading: true,
  login: () => {},
  logout: () => {},
  updateBranch: () => {}
}

const AuthContext = createContext<AuthContextType>(defaultContextValue)

const cookieOptions = {
  expires: 7,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true
  })

  useEffect(() => {
    const loadUser = () => {
      try {
        const userCookie = Cookies.get(AUTH_COOKIE_KEY)
        const token = Cookies.get(TOKEN_COOKIE_KEY)

        if (userCookie && token) {
          const user: AuthUser = JSON.parse(userCookie)

          setState({ user, isAuthenticated: true, isLoading: false })
        } else {
          setState({ user: null, isAuthenticated: false, isLoading: false })
        }
      } catch {
        setState({ user: null, isAuthenticated: false, isLoading: false })
      }
    }

    loadUser()
  }, [])

  const login = useCallback((user: AuthUser) => {
    Cookies.set(AUTH_COOKIE_KEY, JSON.stringify(user), cookieOptions)
    Cookies.set(TOKEN_COOKIE_KEY, user.token, cookieOptions)
    setState({ user, isAuthenticated: true, isLoading: false })
  }, [])

  const logout = useCallback(() => {
    Cookies.remove(AUTH_COOKIE_KEY)
    Cookies.remove(TOKEN_COOKIE_KEY)
    setState({ user: null, isAuthenticated: false, isLoading: false })
  }, [])

  const updateBranch = useCallback((branch: { id: number; name: string } | null) => {
    setState(prev => {
      if (!prev.user) return prev

      const updatedUser = { ...prev.user, branch }

      Cookies.set(AUTH_COOKIE_KEY, JSON.stringify(updatedUser), cookieOptions)

      return { ...prev, user: updatedUser }
    })
  }, [])

  return (
    <AuthContext.Provider value={{ ...state, login, logout, updateBranch }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuthContext = () => {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuthContext must be used within AuthProvider')
  }

  return context
}

export default AuthContext
