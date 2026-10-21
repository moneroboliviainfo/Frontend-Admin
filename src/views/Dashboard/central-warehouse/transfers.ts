import type {
  BranchTransfer,
  BranchTransferItem,
  BranchTransferStatus,
  TransferAction
} from '@/types/api/branchTransfer'

type ChipColor = 'primary' | 'success' | 'error' | 'warning' | 'secondary' | 'info'

// Solo tiene sentido con el traslado cerrado: mientras esta en camino receivedQuantity
// es null y no significa "llego cero", significa "todavia no llego".
export const missingUnits = (item: BranchTransferItem, status: BranchTransferStatus) => {
  if (status !== 'received' && status !== 'not_found' && status !== 'lost') return 0

  const dispatched = item.dispatchedQuantity ?? 0

  // En una reposicion quantity es null: lo que la central no mando no es un faltante
  const notFound = item.quantity === null ? 0 : item.quantity - dispatched

  // En un traslado perdido lo despachado ya se dio por perdido: solo queda revisar lo que nunca salio
  if (status === 'lost') return notFound

  return notFound + (dispatched - (item.receivedQuantity ?? 0))
}

// Lo pedido o, si ya salio, lo despachado. Una reposicion sin atender no tiene cantidades
export const itemUnits = (item: BranchTransferItem) => item.dispatchedQuantity ?? item.quantity ?? 0

export const transferUnits = (transfer: BranchTransfer) =>
  transfer.items.reduce((sum, item) => sum + itemUnits(item), 0)

export const itemLabel = (item: BranchTransferItem) => {
  const productColor = item.variant?.productColor

  return `${productColor?.product?.name || 'Producto'} · ${productColor?.color?.name || ''} · Talla ${
    item.variant?.size?.name || ''
  }`
}

// Respaldo por si el back no manda stageLabel (version vieja)
const statusFallback: Record<BranchTransferStatus, { label: string; color: ChipColor }> = {
  pending_payment: { label: 'Esperando pago', color: 'warning' },
  pending_dispatch: { label: 'Por despachar', color: 'warning' },
  in_transit: { label: 'En camino', color: 'primary' },
  not_found: { label: 'No encontrado', color: 'error' },
  received: { label: 'Recibido', color: 'success' },
  lost: { label: 'Perdido', color: 'error' },
  cancelled: { label: 'Anulado', color: 'secondary' }
}

const stageColors: Record<string, ChipColor> = {
  to_attend: 'warning',
  awaiting_central: 'warning',
  awaiting_payment: 'warning',
  payment_expired: 'error',
  awaiting_dispatch: 'warning',
  to_dispatch: 'warning',
  to_receive: 'primary',
  in_transit: 'primary',
  received: 'success',
  delivered: 'success',
  awaiting_customer: 'info',
  picked_up: 'success',
  not_picked_up: 'secondary',
  pickup_expired: 'error',
  rejected: 'error',
  not_found: 'error',
  lost: 'error',
  cancelled: 'secondary'
}

// El back calcula la etapa segun quien mira: no traducir status a mano (doc 15 §4)
export const stageOf = (transfer: BranchTransfer): { label: string; color: ChipColor } => {
  const fallback = statusFallback[transfer.status] || { label: transfer.status, color: 'secondary' as const }

  if (!transfer.stageLabel) return fallback

  return {
    label: transfer.stageLabel,
    color: (transfer.stage && stageColors[transfer.stage]) || fallback.color
  }
}

// allowedActions viene filtrado por rol, sucursal, plazos y plata. Si el back no lo manda
// (version vieja) se usa la regla que ya tenia cada pantalla
export const canDo = (transfer: BranchTransfer, action: TransferAction, fallback: boolean) =>
  transfer.allowedActions ? transfer.allowedActions.includes(action) : fallback

// Pedido "Para sucursal": una tienda reponiendo stock desde otra, sin cliente ni cobro.
// Para un cliente siempre se cobra al pedir (no hay pedidos fiados), asi que sin anticipo
// y sin cliente solo puede ser este. El back no lo distingue: lo trata como un pedido sin
// cobro, lo lista en awaitingPickup y le aplica los "dias apartado" (que se dejan en 0)
export const isRestockRequest = (transfer: BranchTransfer) =>
  transfer.type === 'branch_request' && !transfer.advanceAmount && !transfer.customerName

export const hasPendingReview = (transfer: BranchTransfer) =>
  transfer.pendingReview ?? transfer.discrepancyStatus === 'pending_review'
