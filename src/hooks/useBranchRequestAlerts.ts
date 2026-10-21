'use client'

import { useBranchTransfers, usePendingCount, useTransferCount } from '@/hooks/useBranchTransfers'
import { useUserRole } from '@/hooks/useUserRole'
import { isRestockRequest } from '@/views/Dashboard/central-warehouse/transfers'

// Lo que dentro de Pedidos entre sucursales espera una accion de quien mira.
//
// Tienda: despachar lo que le pidieron, recibir lo que pidio y devolver anticipos.
// "Para entregar" queda afuera a proposito: espera al cliente durante dias, y un aviso
// siempre prendido deja de mirarse. Su numero sigue en la pestaña.
//
// Central: los pedidos que llegaron con faltantes y nadie reviso.
//
// Lo usan el menu lateral y la pantalla de Pedidos: comparten las consultas (cada 30 s)
export const useBranchRequestAlerts = () => {
  const { isAdminLike, isManager, isCashier } = useUserRole()
  const isStore = isManager || isCashier

  // Sin branchId: el back resuelve la sucursal de la tienda
  const { data: pending } = usePendingCount(undefined, isStore)

  // toReceive de pending-count suma tambien los envios de la central (esos avisan en
  // Inventario): aca solo cuentan los pedidos
  const toReceive = useTransferCount({ direction: 'incoming', type: 'branch_request', status: 'in_transit' }, isStore)

  const pendingReview = useTransferCount({ type: 'branch_request', discrepancyStatus: 'pending_review' }, isAdminLike)

  // pending-count.awaitingPickup cuenta tambien lo pedido para la sucursal, que no espera a
  // ningun cliente. Se cuenta con la misma lista que muestra la pestaña (comparten cache)
  const { data: awaitingPickupList } = useBranchTransfers({ awaitingPickup: true }, isStore)

  // enabled: false no alcanza: la central usa la misma clave de pending-count, y useQuery
  // devuelve lo que haya en cache aunque este apagado
  const toDispatch = isStore ? pending?.toDispatch || 0 : 0
  const pendingRefunds = isStore ? pending?.pendingRefunds || 0 : 0

  const awaitingPickup = isStore
    ? (awaitingPickupList?.data || []).filter(transfer => !isRestockRequest(transfer)).length
    : 0

  return {
    toDispatch,
    toReceive: isStore ? toReceive : 0,
    pendingRefunds,
    awaitingPickup,
    pendingReview: isAdminLike ? pendingReview : 0,

    // Lo que suma el chip del menu
    total: isAdminLike ? pendingReview : isStore ? toDispatch + toReceive + pendingRefunds : 0
  }
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`

// Una linea por cosa pendiente, para que se sepa a que pestaña ir
export const storeRequestsHint = ({
  toDispatch,
  toReceive,
  pendingRefunds
}: {
  toDispatch: number
  toReceive: number
  pendingRefunds: number
}) =>
  [
    toDispatch > 0 && `${plural(toDispatch, 'pedido', 'pedidos')} de otra tienda por despachar`,
    toReceive > 0 && `${plural(toReceive, 'pedido', 'pedidos')} en camino por recibir`,
    pendingRefunds > 0 && `${plural(pendingRefunds, 'devolución pendiente', 'devoluciones pendientes')}`
  ]
    .filter(Boolean)
    .join(' · ')

export const requestsReviewHint = (count: number) =>
  `${count === 1 ? '1 pedido llegó' : `${count} pedidos llegaron`} con faltantes. Revíselos en Pedidos.`
