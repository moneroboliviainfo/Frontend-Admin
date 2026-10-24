'use client'

import { useAuthContext } from '@/contexts/AuthContext'
import { getHomeRouteByRole } from '@/utils/menuPermissions'

export const useUserRole = () => {
  const { user } = useAuthContext()

  const role = user?.role ?? null
  const userEmail = user?.email ?? null
  const homeRoute = getHomeRouteByRole(userEmail, role)
  const userBranch = user?.branch ?? null

  // Sucursal 'solo facturacion': no tiene stock, ventas, caja ni traslados — el
  // back responde 403 en todo eso. No hace falta un rol nuevo: alcanza con el
  // tipo que llega en el login (doc 07).
  const isBillingOnly = userBranch?.type === 'billing_only'

  return {
    user,
    userEmail,
    role,
    homeRoute,
    userBranch,
    isBillingOnly,
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
