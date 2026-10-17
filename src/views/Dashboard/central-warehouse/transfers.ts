import type { BranchTransferItem, BranchTransferStatus } from '@/types/api/branchTransfer'

// Solo tiene sentido con el traslado cerrado: mientras esta en camino receivedQuantity
// es null y no significa "llego cero", significa "todavia no llego".
export const missingUnits = (item: BranchTransferItem, status: BranchTransferStatus) => {
  if (status !== 'received' && status !== 'not_found' && status !== 'lost') return 0

  const dispatched = item.dispatchedQuantity ?? 0
  const notFound = item.quantity - dispatched

  // En un traslado perdido lo despachado ya se dio por perdido: solo queda revisar lo que nunca salio
  if (status === 'lost') return notFound

  return notFound + (dispatched - (item.receivedQuantity ?? 0))
}
