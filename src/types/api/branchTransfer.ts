export type BranchTransferType = 'central_dispatch' | 'branch_request'

export type BranchTransferStatus =
  | 'pending_payment'
  | 'pending_dispatch'
  | 'in_transit'
  | 'not_found'
  | 'received'
  | 'lost'
  | 'cancelled'

export type DiscrepancyStatus = 'pending_review' | 'reviewed' | null

export interface TransferActor {
  id: number
  name: string
}

export interface TransferBranch {
  id: number
  name: string
}

export interface BranchTransferItem {

  // Este id es el transferItemId que piden dispatch/receive/review (no es el variantId)
  id: number
  variantId: number
  variant: {
    id: number
    size: { id: number; name: string }
    productColor: {
      id: number
      product: { id: number; name: string }
      color: { id: number; name: string; code: string }
    }
  }
  quantity: number
  dispatchedQuantity: number | null
  receivedQuantity: number | null
  reviewOutcome: ReviewOutcome | null
  reviewNote: string | null
}

export interface BranchTransfer {
  id: number
  type: BranchTransferType
  status: BranchTransferStatus
  discrepancyStatus: DiscrepancyStatus
  note: string | null
  sourceBranchId: number | null
  sourceBranch: TransferBranch | null
  destinationBranchId: number
  destinationBranch: TransferBranch
  requestedBy: TransferActor | null
  requestedAt: string | null
  dispatchedBy: TransferActor | null
  dispatchedAt: string | null
  receivedBy: TransferActor | null
  receivedAt: string | null
  receiveNote: string | null
  cancelledBy: TransferActor | null
  cancelledAt: string | null
  cancelNote: string | null
  lostBy: TransferActor | null
  lostAt: string | null
  lostNote: string | null
  items: BranchTransferItem[]
}

export type ReviewOutcome = 'lost' | 'found_at_destination' | 'found_at_origin'

export interface CentralDispatchRequest {
  destinationBranchId: number
  items: { variantId: number; quantity: number }[]
  note?: string
}

export interface ReceiveTransferRequest {

  // Hay que mandar TODAS las lineas despachadas, una vez cada una
  items: { transferItemId: number; quantity: number }[]
  note?: string
}

export interface CancelTransferRequest {
  note?: string
}

export interface MarkLostTransferRequest {
  note: string
}

export interface ReviewTransferRequest {

  // Cada linea se revisa una sola vez; se pueden revisar algunas ahora y otras despues
  items: { transferItemId: number; outcome: ReviewOutcome }[]
  note: string
}

export interface BranchTransferListParams {
  page?: number
  limit?: number
  direction?: 'incoming' | 'outgoing'
  status?: BranchTransferStatus
  type?: BranchTransferType
  discrepancyStatus?: 'pending_review' | 'reviewed'

  // Solo ADMIN/SUPERVISOR; acepta la bodega central
  branchId?: number
}

export interface BranchTransferListResponse {
  data: BranchTransfer[]
  meta: {
    total: number
    page: number
    lastPage: number
    limit: number
    offset: number
    hasNextPage: boolean
    hasPreviousPage: boolean
  }
}

export interface PendingCount {
  toDispatch: number
  toReceive: number
  inTransit: number
  pendingReview: number
  awaitingPickup: number
  pendingRefunds: number
}

export interface CentralWarehouse {
  id: number
  name: string
}
