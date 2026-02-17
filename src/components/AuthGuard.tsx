'use client'

import { useEffect, useState } from 'react'

import { useRouter, usePathname } from 'next/navigation'

import { CircularProgress, Box } from '@mui/material'

import { authService } from '@/services/authService'
import { initLogRocket, identifyUser } from '@/libs/logrocket'

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

      const protectedPaths = ['/home', '/customers', '/apps', '/pages', '/forms', '/tables', '/charts', '/products']
      const publicPaths = ['/login', '/register', '/forgot-password']

      const isProtectedPath = protectedPaths.some(path => pathname.startsWith(path))
      const isPublicPath = publicPaths.some(path => pathname.startsWith(path))

      if (pathname === '/') {
        router.replace(isAuth ? '/home' : '/login')

        return
      }

      if (isProtectedPath && !isAuth) {
        router.replace(`/login?redirect=${pathname}`)

        return
      }

      if (isPublicPath && isAuth) {
        router.replace('/home')

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
