'use client'

import { authService } from '@/services/authService'
import { getRoleFromEmail, getHomeRouteByRole, getExcludedBranchCodes, getAllowedBranchCodes } from '@/utils/menuPermissions'

export const useUserRole = () => {
  const userEmail = authService.getUserEmail()
  const role = getRoleFromEmail(userEmail)
  const homeRoute = getHomeRouteByRole(userEmail)
  const excludedBranchCodes = getExcludedBranchCodes(userEmail)
  const allowedBranchCodes = getAllowedBranchCodes(userEmail)

  return {
    userEmail,
    role,
    homeRoute,
    excludedBranchCodes,
    allowedBranchCodes,
    isCashier: role === 'CASHIER',
    isAdmin: role === 'ADMIN',
    isFacturacionJunin: role === 'FACTURACION_JUNIN'
  }
}
