import type { VerticalMenuDataType } from '@/types/menuTypes'
import type { Role } from '@/types/api/auth'

export const filterMenuByRole = (
  menuItems: VerticalMenuDataType[],
  _userEmail: string | null,
  userRole?: Role | null
): VerticalMenuDataType[] => {
  const role = userRole || 'ADMIN'

  // SUPERVISOR = ADMIN salvo Usuarios
  if (role === 'ADMIN' || role === 'SUPERVISOR') {
    return menuItems
      .filter((item: any) => role === 'ADMIN' || item.label !== 'Usuarios')
      .map((item: any) => {
        if (item.label === 'Ventas' && item.children) {
          return {
            ...item,
            children: item.children.filter((child: any) => child.label !== 'Venta en Tienda')
          }
        }

        return item
      })
  }

  if (role === 'MANAGER') {
    // Nota: 'VENTAS' (la sección) no se excluye porque ahí vive 'Ventas', que
    // sí puede ver — solo se excluye 'SIAT' puntualmente dentro de esa sección.
    const managerExcluded = [
      'ADMINISTRACIÓN',
      'Usuarios',
      'Sucursales',
      'CLIENTES',
      'Clientes',
      'CATÁLOGO',
      'Productos',
      'Categorías',
      'Descuentos',
      'Outfits',
      'CONTENIDO',
      'Sliders',
      'Anuncios',
      'Banners',
      'SIAT'
    ]

    return menuItems.filter((item: any) => !managerExcluded.includes(item.label))
  }

  if (role === 'CASHIER') {
    const allowedMenus = ['VENTAS', 'Ventas']

    return menuItems.filter((item: any) => allowedMenus.includes(item.label))
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

  if (role === 'ADMIN') {
    return !route.startsWith('/sales/instore')
  }

  if (role === 'SUPERVISOR') {
    return !route.startsWith('/sales/instore') && !route.startsWith('/users')
  }

  if (role === 'MANAGER') {
    const managerBlockedRoutes = [
      '/users',
      '/branches',
      '/customers',
      '/products',
      '/category',
      '/discounts',
      '/outfits',
      '/sliders',
      '/advertisement',
      '/banners',
      '/siat'
    ]

    return !managerBlockedRoutes.some(r => route.startsWith(r))
  }

  if (role === 'CASHIER') {
    const cashierAllowedRoutes = ['/sales']

    return cashierAllowedRoutes.some(r => route.startsWith(r))
  }

  return false
}
