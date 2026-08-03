'use client'

import { authService } from '@/services/authService'
import { getRoleFromEmail, getHomeRouteByRole, getExcludedBranchCodes } from '@/utils/menuPermissions'

export const useUserRole = () => {
  const userEmail = authService.getUserEmail()
  const role = getRoleFromEmail(userEmail)
  const homeRoute = getHomeRouteByRole(userEmail)
  const excludedBranchCodes = getExcludedBranchCodes(userEmail)

  return {
    userEmail,
    role,
    homeRoute,
    excludedBranchCodes,
    isCashier: role === 'CASHIER',
    isAdmin: role === 'ADMIN',
    isFacturacionJunin: role === 'FACTURACION_JUNIN'
  }
}
