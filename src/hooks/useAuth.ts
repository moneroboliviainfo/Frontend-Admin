'use client'

import { useRouter, useSearchParams } from 'next/navigation'

import { useMutation, useQueryClient } from '@tanstack/react-query'

import { authService, type LoginCredentials } from '@/services/authService'
import { useAuthContext } from '@/contexts/AuthContext'
import { getHomeRouteByRole } from '@/utils/menuPermissions'

export const useAuth = () => {
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const { login: contextLogin, logout: contextLogout, isAuthenticated, user } = useAuthContext()

  const loginMutation = useMutation({
    mutationFn: (credentials: LoginCredentials) => authService.login(credentials),
    onSuccess: data => {
      // Guardar usuario en el contexto (esto también guarda en cookies)
      contextLogin(data)

      // Obtener ruta de redirección según el rol
      const defaultRoute = getHomeRouteByRole(null, data.role)
      const redirectTo = searchParams?.get('redirect') || defaultRoute

      router.push(redirectTo)
    }
  })

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await authService.logout()
    },
    onSuccess: () => {
      // Limpiar contexto
      contextLogout()

      // Limpiar cache de react-query
      queryClient.clear()

      router.push('/login')
    }
  })

  return {
    user,
    isAuthenticated,
    isValidating: false,
    login: loginMutation.mutate,
    isLoggingIn: loginMutation.isPending,
    loginError: loginMutation.error,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending
  }
}
