import axios from 'axios'
import Cookies from 'js-cookie'

import type { LoginResponse as BackendLoginResponse, AuthUser } from '@/types/api/auth'
import { normalizeRole } from '@/types/api/auth'

export interface LoginCredentials {
  email: string
  password: string
}

// Re-exportar para compatibilidad
export type LoginResponse = BackendLoginResponse

class AuthService {
  private baseURL = process.env.NEXT_PUBLIC_API_URL

  async login(credentials: LoginCredentials): Promise<AuthUser> {
    try {
      const response = await axios.post<BackendLoginResponse>(`${this.baseURL}/api/auth/login`, credentials, {
        headers: { 'Content-Type': 'application/json' }
      })

      const { email, name, rol, token, branch } = response.data

      // Transformar respuesta del backend a AuthUser
      const user: AuthUser = {
        email,
        name,
        role: normalizeRole(rol),
        token,
        branch: branch || null
      }

      return user
    } catch (error: any) {
      if (error.response?.data?.message) {
        throw new Error(error.response.data.message)
      }

      throw new Error('Error de conexión. Inténtalo de nuevo.')
    }
  }

  async logout(): Promise<void> {
    this.removeToken()
    this.removeUserData()
  }

  // Token methods
  setToken(token: string) {
    Cookies.set('auth-token', token, {
      expires: 7,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    })
  }

  getToken(): string | null {
    return Cookies.get('auth-token') || null
  }

  removeToken() {
    Cookies.remove('auth-token')
  }

  // User data methods (legacy - mantener por compatibilidad)
  setUserEmail(email: string) {
    Cookies.set('user-email', email, {
      expires: 7,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    })
  }

  getUserEmail(): string | null {
    return Cookies.get('user-email') || null
  }

  removeUserEmail() {
    Cookies.remove('user-email')
  }

  removeUserData() {
    Cookies.remove('user-email')
    Cookies.remove('auth-user')
  }

  isAuthenticated(): boolean {
    const token = this.getToken()

    return !!token
  }
}

export const authService = new AuthService()
