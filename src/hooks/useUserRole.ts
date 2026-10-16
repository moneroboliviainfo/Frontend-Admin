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

    // isAdmin es estricto (solo ADMIN crea/edita usuarios); para el resto, isAdminLike
    isAdmin: role === 'ADMIN',
    isSupervisor: role === 'SUPERVISOR',
    isAdminLike: role === 'ADMIN' || role === 'SUPERVISOR',
    needsBranchSelector: role === 'ADMIN' || role === 'SUPERVISOR',
    hasFixedBranch: role === 'MANAGER' || role === 'CASHIER'
  }
}
