'use client'

import { useEffect, useState } from 'react'

import { useRouter, usePathname } from 'next/navigation'

import Cookies from 'js-cookie'

import { authService } from '@/services/authService'
import { initLogRocket, identifyUser } from '@/libs/logrocket'
import { canAccessRoute, getHomeRouteByRole } from '@/utils/menuPermissions'
import type { AuthUser, Role } from '@/types/api/auth'

const getUserRole = (): Role | null => {
  try {
    const userCookie = Cookies.get('auth-user')

    if (!userCookie) return null

    const user: AuthUser = JSON.parse(userCookie)

    return user.role
  } catch {
    return null
  }
}

interface AuthGuardProps {
  children: React.ReactNode
}

const AuthGuard = ({ children }: AuthGuardProps) => {
  const router = useRouter()
  const pathname = usePathname()
  const [isChecking, setIsChecking] = useState(true)

  // Inicializar LogRocket una sola vez
  useEffect(() => {
    initLogRocket()
  }, [])

  useEffect(() => {
    const checkAuth = () => {
      const isAuth = authService.isAuthenticated()

      // Identificar usuario en LogRocket si está autenticado
      if (isAuth) {
        const userEmail = authService.getUserEmail()

        if (userEmail) {
          identifyUser(userEmail, { email: userEmail })
        }
      }

      const publicPaths = ['/login', '/register', '/forgot-password']

      const isPublicPath = publicPaths.some(path => pathname.startsWith(path))

      if (pathname === '/') {
        router.replace(isAuth ? getHomeRouteByRole(null, getUserRole()) : '/login')

        return
      }

      // Todo lo que no es público requiere sesión (antes solo se protegía una lista
      // manual de rutas, y quedaban afuera módulos como /sales, /discounts, etc.)
      if (!isPublicPath && !isAuth) {
        router.replace(`/login?redirect=${pathname}`)

        return
      }

      if (isPublicPath && isAuth) {
        router.replace(getHomeRouteByRole(null, getUserRole()))

        return
      }

      if (isAuth && !isPublicPath) {
        const role = getUserRole()

        if (!canAccessRoute(role, pathname)) {
          router.replace(getHomeRouteByRole(null, role))

          return
        }
      }

      setIsChecking(false)
    }

    checkAuth()
  }, [pathname, router])

  if (isChecking) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <div className='auth-guard-spinner' />
      </div>
    )
  }

  return <>{children}</>
}

export default AuthGuard
