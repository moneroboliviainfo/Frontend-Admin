'use client'

import { useEffect, useState } from 'react'

import { useRouter, usePathname } from 'next/navigation'

import { CircularProgress, Box } from '@mui/material'

import { authService } from '@/services/authService'
import { initLogRocket, identifyUser } from '@/libs/logrocket'
import { getHomeRouteByRole, canAccessRoute } from '@/utils/menuPermissions'

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
      const userEmail = isAuth ? authService.getUserEmail() : null

      // Identificar usuario en LogRocket si está autenticado
      if (userEmail) {
        identifyUser(userEmail, { email: userEmail })
      }

      const protectedPaths = ['/home', '/customers', '/apps', '/pages', '/forms', '/tables', '/charts', '/products']
      const publicPaths = ['/login', '/register', '/forgot-password']

      const isProtectedPath = protectedPaths.some(path => pathname.startsWith(path))
      const isPublicPath = publicPaths.some(path => pathname.startsWith(path))

      if (pathname === '/') {
        router.replace(isAuth ? getHomeRouteByRole(userEmail) : '/login')

        return
      }

      if (isProtectedPath && !isAuth) {
        router.replace(`/login?redirect=${pathname}`)

        return
      }

      if (isPublicPath && isAuth) {
        router.replace(getHomeRouteByRole(userEmail))

        return
      }

      if (isAuth && !isPublicPath && !canAccessRoute(userEmail, pathname)) {
        router.replace(getHomeRouteByRole(userEmail))

        return
      }

      setIsChecking(false)
    }

    checkAuth()
  }, [pathname, router])

  if (isChecking) {
    return (
      <Box display='flex' justifyContent='center' alignItems='center' minHeight='100vh'>
        <CircularProgress />
      </Box>
    )
  }

  return <>{children}</>
}

export default AuthGuard
