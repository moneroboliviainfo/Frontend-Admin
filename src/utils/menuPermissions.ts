import type { VerticalMenuDataType } from '@/types/menuTypes'
import type { Role } from '@/types/api/auth'

export const filterMenuByRole = (
  menuItems: VerticalMenuDataType[],
  _userEmail: string | null,
  userRole?: Role | null
): VerticalMenuDataType[] => {
  const role = userRole || 'ADMIN'

  if (role === 'ADMIN') {
    return menuItems
  }

  if (role === 'MANAGER') {
    return menuItems.map((item: any) => {
      if (item.label === 'SIAT' && item.children) {
        return {
          ...item,
          children: item.children.filter((child: any) => ['Facturación Online'].includes(child.label))
        }
      }

      return item
    })
  }

  if (role === 'CASHIER') {
    const allowedMenus = ['MÓDULO VENTAS', 'Ventas', 'FACTURACIÓN SIAT', 'SIAT']

    return menuItems
      .filter((item: any) => allowedMenus.includes(item.label))
      .map((item: any) => {
        if (item.label === 'SIAT' && item.children) {
          return {
            ...item,
            children: item.children.filter((child: any) => child.label === 'Facturación Online')
          }
        }

        return item
      })
  }

  return []
}

export const getHomeRouteByRole = (_userEmail: string | null, userRole?: Role | null): string => {
  const role = userRole || 'ADMIN'

  if (role === 'CASHIER') return '/sales/instore'
  if (role === 'MANAGER') return '/sales/list'

  return '/home'
}

export const canAccessRoute = (role: Role | null, route: string): boolean => {
  if (!role) return false
  if (role === 'ADMIN') return true

  const adminOnlyRoutes = ['/users', '/branches', '/siat/eventos', '/siat/paquetes', '/siat/cafc']

  return !adminOnlyRoutes.some(r => route.startsWith(r))
}
