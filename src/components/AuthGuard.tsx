'use client'

import { useEffect, useState } from 'react'

import { useRouter, usePathname } from 'next/navigation'

import Cookies from 'js-cookie'

import { authService } from '@/services/authService'
import { initLogRocket, identifyUser } from '@/libs/logrocket'
import { canAccessRoute, getHomeRouteByRole } from '@/utils/menuPermissions'
import type { AuthUser, Role } from '@/types/api/auth'

const getUser = (): AuthUser | null => {
  try {
    const userCookie = Cookies.get('auth-user')

    if (!userCookie) return null

    return JSON.parse(userCookie) as AuthUser
  } catch {
    return null
  }
}

const getUserRole = (): Role | null => getUser()?.role ?? null

// El tipo de sucursal viaja en la cookie del login, igual que el rol
const isBillingOnlyBranch = (): boolean => getUser()?.branch?.type === 'billing_only'

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
        router.replace(isAuth ? getHomeRouteByRole(null, getUserRole(), isBillingOnlyBranch()) : '/login')

        return
      }

      // Todo lo que no es público requiere sesión (antes solo se protegía una lista
      // manual de rutas, y quedaban afuera módulos como /sales, /discounts, etc.)
      if (!isPublicPath && !isAuth) {
        router.replace(`/login?redirect=${pathname}`)

        return
      }

      if (isPublicPath && isAuth) {
        router.replace(getHomeRouteByRole(null, getUserRole(), isBillingOnlyBranch()))

        return
      }

      if (isAuth && !isPublicPath) {
        const role = getUserRole()
        const isBillingOnly = isBillingOnlyBranch()

        if (!canAccessRoute(role, pathname, isBillingOnly)) {
          router.replace(getHomeRouteByRole(null, role, isBillingOnly))

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
