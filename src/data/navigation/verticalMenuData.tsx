// Type Imports
import type { VerticalMenuDataType } from '@/types/menuTypes'
import type { Role } from '@/types/api/auth'
import { filterMenuByRole } from '@/utils/menuPermissions'

const getFullMenuData = (): VerticalMenuDataType[] => [
  // PRINCIPAL
  {
    isSection: true,
    label: 'PRINCIPAL'
  },
  {
    label: 'Inicio',
    icon: 'tabler-dashboard',
    href: '/home'
  },

  // VENTAS
  {
    isSection: true,
    label: 'VENTAS'
  },
  {
    label: 'Ventas',
    icon: 'tabler-shopping-cart',
    children: [
      {
        label: 'Listar Ventas',
        icon: 'tabler-list',
        href: '/sales/list/'
      },
      {
        label: 'Venta en Tienda',
        icon: 'tabler-list',
        href: '/sales/instore/'
      }
    ]
  },
  {
    label: 'SIAT',
    icon: 'tabler-file-invoice',
    children: [
      /*  {
        label: 'Facturación Online',
        icon: 'tabler-receipt',
        href: '/siat/facturacion/'
      }, */
      {
        label: 'Eventos Significativos',
        icon: 'tabler-alert-triangle',
        href: '/siat/eventos/'
      },
      {
        label: 'Paquetes Contingencia',
        icon: 'tabler-package',
        href: '/siat/paquetes/'
      },
      {
        label: 'Códigos CAFC',
        icon: 'tabler-shield-lock',
        href: '/siat/cafc/'
      }
    ]
  },

  // INVENTARIO
  {
    isSection: true,
    label: 'INVENTARIO'
  },
  {
    label: 'Bodega Central',
    icon: 'tabler-building-warehouse',
    href: '/central-warehouse'
  },

  // CATÁLOGO
  {
    isSection: true,
    label: 'CATÁLOGO'
  },
  {
    label: 'Productos',
    icon: 'tabler-package',
    children: [
      {
        label: 'Crear Productos',
        icon: 'tabler-plus',
        href: '/products/add'
      },
      {
        label: 'Listar Productos',
        icon: 'tabler-list',
        href: '/products/list'
      }
    ]
  },
  {
    label: 'Categorías',
    icon: 'tabler-category',
    children: [
      {
        label: 'Crear/Listar Categorías',
        icon: 'tabler-plus',
        href: '/category/'
      }
    ]
  },
  {
    label: 'Descuentos',
    icon: 'tabler-discount',
    children: [
      {
        label: 'Lista de Descuentos',
        icon: 'tabler-list',
        href: '/discounts/list/'
      }
    ]
  },
  {
    label: 'Outfits',
    icon: 'tabler-shirt',
    children: [
      {
        label: 'Lista de Outfits',
        icon: 'tabler-list',
        href: '/outfits/list/'
      }
    ]
  },

  // CONTENIDO
  {
    isSection: true,
    label: 'CONTENIDO'
  },
  {
    label: 'Sliders',
    icon: 'tabler-photo',
    children: [
      {
        label: 'Crear/Listar Sliders',
        icon: 'tabler-plus',
        href: '/sliders/list/'
      }
    ]
  },
  {
    label: 'Anuncios',
    icon: 'tabler-notification',
    href: '/advertisement/'
  },
  {
    label: 'Banners',
    icon: 'tabler-video',
    href: '/banners/'
  },

  // CLIENTES
  {
    isSection: true,
    label: 'CLIENTES'
  },
  {
    label: 'Clientes',
    icon: 'tabler-users',
    children: [
      {
        label: 'Listar Clientes',
        icon: 'tabler-list',
        href: '/customers/list'
      }
    ]
  },

  // ADMINISTRACIÓN
  {
    isSection: true,
    label: 'ADMINISTRACIÓN'
  },
  {
    label: 'Usuarios',
    icon: 'tabler-users-group',
    href: '/users/list'
  },
  {
    label: 'Sucursales',
    icon: 'tabler-building-store',
    href: '/branches/list'
  }
]

// Función que recibe el rol como parámetro
const verticalMenuData = (userRole?: Role | null): VerticalMenuDataType[] => {
  const fullMenu = getFullMenuData()

  // Filtrar el menú basado en el rol del usuario
  return filterMenuByRole(fullMenu, null, userRole)
}

export default verticalMenuData

// Exportar también el menú completo para casos especiales
export { getFullMenuData }
