// Type Imports
import type { VerticalMenuDataType } from '@/types/menuTypes'
import { authService } from '@/services/authService'
import { filterMenuByRole } from '@/utils/menuPermissions'

const getFullMenuData = (): VerticalMenuDataType[] => [
  // Dashboard
  {
    isSection: true,
    label: 'PRINCIPAL'
  },
  {
    label: 'Inicio',
    icon: 'tabler-dashboard',
    href: '/home'
  },

  // MÓDULO CLIENTES
  {
    isSection: true,
    label: 'MÓDULO CLIENTES'
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

  // MÓDULO PRODUCTOS
  {
    isSection: true,
    label: 'MÓDULO PRODUCTOS'
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

  // MÓDULO CATEGORÍAS
  {
    isSection: true,
    label: 'MÓDULO CATEGORÍAS'
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

  // MÓDULO VENTAS
  {
    isSection: true,
    label: 'MÓDULO VENTAS'
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

  // MÓDULO DESCUENTOS
  {
    isSection: true,
    label: 'MÓDULO DESCUENTOS'
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

  // MÓDULO OUTFITS
  {
    isSection: true,
    label: 'MÓDULO OUTFITS'
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

  // MÓDULO SLIDERS
  {
    isSection: true,
    label: 'MÓDULO SLIDERS'
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

  // MÓDULO ANUNCIOS Y BANNERS
  {
    isSection: true,
    label: 'ANUNCIOS Y BANNERS'
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
  }
]

const verticalMenuData = (): VerticalMenuDataType[] => {
  const userEmail = authService.getUserEmail()
  const fullMenu = getFullMenuData()

  // Filtrar el menú basado en el rol del usuario
  return filterMenuByRole(fullMenu, userEmail)
}

export default verticalMenuData
