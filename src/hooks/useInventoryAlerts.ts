'use client'

import { useTransferCount } from '@/hooks/useBranchTransfers'
import { useUserRole } from '@/hooks/useUserRole'

// Lo que dentro de Inventario necesita a la tienda: envios de la central (incluidas las
// reposiciones atendidas) que vienen en camino y hay que recibir. Solo MANAGER/CASHIER
// reciben; el admin no ve Inventario.
// Mismos parametros que la pestaña "Envios de la central": el menu y la pestaña comparten
// la consulta (cada 30 s). pending-count no sirve aca porque toReceive suma tambien pedidos
export const useInventoryAlerts = () => {
  const { isManager, isCashier } = useUserRole()

  const toReceive = useTransferCount(
    { direction: 'incoming', type: 'central_dispatch', status: 'in_transit' },
    isManager || isCashier
  )

  return { toReceive }
}

export const toReceiveHint = (count: number) =>
  `${count === 1 ? '1 envío de la central viene' : `${count} envíos de la central vienen`} en camino. ` +
  'Recíbalos en Envíos de la central.'
