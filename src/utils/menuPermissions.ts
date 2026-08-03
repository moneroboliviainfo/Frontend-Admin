import type { VerticalMenuDataType } from '@/types/menuTypes'
import type { StaticRole } from '@/types/api/auth'

export const filterMenuByRole = (
  menuItems: VerticalMenuDataType[],
  userEmail: string | null,
  userRole?: StaticRole
): VerticalMenuDataType[] => {
  const role = userRole || getRoleFromEmail(userEmail)

  if (role === 'CASHIER') {
    const excludedMenus = ['PRINCIPAL', 'Inicio']

    return menuItems.filter((item: any) => !excludedMenus.includes(item.label))
  }

  if (role === 'FACTURACION_JUNIN') {
    // Solo mostrar el menú de Facturación Online
    return menuItems
      .filter((item: any) => item.label === 'FACTURACIÓN SIAT')
      .map((item: any) => ({
        ...item,
        children: item.children?.filter((child: any) => child.label === 'Facturación Online')
      }))
  }

  if (role === 'ADMIN') {
    return menuItems
  }

  return []
}

export const getRoleFromEmail = (email: string | null): StaticRole => {
  if (email === 'rilberadmin@moneroget.com') {
    return 'CASHIER'
  }

  if (email === 'facturacionjunin@gmail.com') {
    return 'FACTURACION_JUNIN'
  }

  return 'ADMIN'
}

// Códigos de sucursal excluidos por rol
export const getExcludedBranchCodes = (email: string | null, userRole?: StaticRole): number[] => {
  const role = userRole || getRoleFromEmail(email)

  if (role === 'FACTURACION_JUNIN') {
    return [3] // Excluir sucursal con código 3
  }

  return []
}

export const getHomeRouteByRole = (userEmail: string | null, userRole?: StaticRole): string => {
  const role = userRole || getRoleFromEmail(userEmail)

  if (role === 'CASHIER') {
    return '/sales/instore'
  }

  if (role === 'FACTURACION_JUNIN') {
    return '/siat/facturacion'
  }

  return '/home'
}
