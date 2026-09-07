'use client'

import { useAuthContext } from '@/contexts/AuthContext'
import { getHomeRouteByRole } from '@/utils/menuPermissions'

export const useUserRole = () => {
  const { user } = useAuthContext()

  const role = user?.role ?? null
  const userEmail = user?.email ?? null
  const homeRoute = getHomeRouteByRole(userEmail, role)
  const userBranch = user?.branch ?? null

  return {
    user,
    userEmail,
    role,
    homeRoute,
    userBranch,
    isCashier: role === 'CASHIER',
    isManager: role === 'MANAGER',
    isAdmin: role === 'ADMIN',
    needsBranchSelector: role === 'ADMIN',
    hasFixedBranch: role === 'MANAGER' || role === 'CASHIER'
  }
}
