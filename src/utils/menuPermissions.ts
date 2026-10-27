import type { VerticalMenuDataType } from '@/types/menuTypes'
import type { Role } from '@/types/api/auth'

// 'Códigos CAFC' (crear/editar) sigue siendo solo ADMIN/SUPERVISOR: a M/C se
// les quita ese hijo de SIAT, dejando Facturación/Eventos/Paquetes
const excludeCafc = (item: any) =>
  item.label === 'SIAT' && item.children
    ? { ...item, children: item.children.filter((child: any) => child.label !== 'Códigos CAFC') }
    : item

export const filterMenuByRole = (
  menuItems: VerticalMenuDataType[],
  _userEmail: string | null,
  userRole?: Role | null,
  isBillingOnly = false
): VerticalMenuDataType[] => {
  const role = userRole || 'ADMIN'

  // Sucursal 'solo facturacion': sin stock, ventas, caja ni traslados (el back
  // responde 403). Se decide por el tipo de sucursal, no por un rol aparte:
  // son cajeros y encargados comunes, con una sucursal distinta.
  if (isBillingOnly) {
    return menuItems.filter(item => item.label === 'SIAT')
  }

  // SUPERVISOR = ADMIN salvo Usuarios. 'Inventario' (stock de la sucursal y
  // recepciones) es de MANAGER/CASHIER; el admin tiene su propia Bodega Central.
  if (role === 'ADMIN' || role === 'SUPERVISOR') {
    return menuItems
      .filter((item: any) => item.label !== 'Inventario')
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
    // sí puede ver. 'SIAT' tampoco: facturación, eventos y paquetes son suyos
    // desde el 23/10 (doc 02) — solo 'Códigos CAFC' sigue siendo A/S.
    const managerExcluded = [
      'ADMINISTRACIÓN',
      'Usuarios',
      'Sucursales',
      'Plazos de Pedidos',
      'Bodega Central',
      'Stock de Sucursales',
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
      'Banners'
    ]

    return menuItems
      .filter((item: any) => !managerExcluded.includes(item.label))
      .map(excludeCafc)
  }

  if (role === 'CASHIER') {
    const allowedMenus = [
      'VENTAS',
      'Ventas',
      'INVENTARIO',
      'Inventario',
      'Reposiciones',
      'PEDIDOS ENTRE SUCURSALES',
      'Pedidos',
      'SIAT'
    ]

    // El historial de caja es A/S/M: el cajero ve el submenu pero no esa opcion
    return menuItems
      .filter((item: any) => allowedMenus.includes(item.label))
      .map((item: any) =>
        item.label === 'Ventas' && item.children
          ? { ...item, children: item.children.filter((child: any) => child.label !== 'Caja') }
          : item
      )
      .map(excludeCafc)
  }

  return []
}

export const getHomeRouteByRole = (_userEmail: string | null, userRole?: Role | null,
  isBillingOnly = false): string => {
  // Su unica pantalla es facturacion: mandarlo al POS lo rebotaria el guard
  if (isBillingOnly) return '/siat/facturacion'

  const role = userRole || 'ADMIN'

  if (role === 'CASHIER') return '/sales/instore'
  if (role === 'MANAGER') return '/sales/list'

  return '/home'
}

export const canAccessRoute = (role: Role | null, route: string, isBillingOnly = false): boolean => {
  // Escribir la URL a mano no puede saltear el tipo de sucursal: todo lo que no
  // sea facturacion le responde 403 al backend igual
  if (isBillingOnly) return route.startsWith('/siat')

  if (!role) return false

  if (role === 'ADMIN') {
    return !route.startsWith('/sales/instore') && !route.startsWith('/receptions')
  }

  if (role === 'SUPERVISOR') {
    return (
      !route.startsWith('/sales/instore') && !route.startsWith('/users') && !route.startsWith('/receptions')
    )
  }

  if (role === 'MANAGER') {
    // '/siat/cafc' queda afuera: crear/editar CAFC sigue siendo solo A/S
    const managerBlockedRoutes = [
      '/central-warehouse',
      '/users',
      '/branches',
      '/settings',
      '/customers',
      '/products',
      '/category',
      '/discounts',
      '/outfits',
      '/sliders',
      '/advertisement',
      '/banners',
      '/siat/cafc'
    ]

    return !managerBlockedRoutes.some(r => route.startsWith(r))
  }

  if (role === 'CASHIER') {
    const cashierAllowedRoutes = ['/sales', '/receptions', '/replenishments', '/branch-requests', '/siat']

    // '/siat/cafc' (crear/editar CAFC) sigue siendo solo A/S
    if (route.startsWith('/siat/cafc')) return false

    return cashierAllowedRoutes.some(r => route.startsWith(r))
  }

  return false
}
