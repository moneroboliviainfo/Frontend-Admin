'use client'

import { useEffect, useState } from 'react'

import { useRouter, usePathname } from 'next/navigation'

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

      const protectedPaths = [
        '/home',
        '/customers',
        '/apps',
        '/pages',
        '/forms',
        '/tables',
        '/charts',
        '/products',
        '/users',
        '/branches'
      ]

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
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <div className='auth-guard-spinner' />
      </div>
    )
  }

  return <>{children}</>
}

export default AuthGuard
