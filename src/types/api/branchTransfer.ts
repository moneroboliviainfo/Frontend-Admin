// `central_return`: la tienda devuelve stock a la bodega principal. Va al
// reves de un envio y solo lo crea la tienda (doc 16).
export type BranchTransferType = 'central_dispatch' | 'branch_request' | 'central_return'

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

  // null en una reposicion: la tienda pide la variante sin cantidad, la decide la central
  quantity: number | null
  dispatchedQuantity: number | null

  // De donde sale la prenda al despachar. El back descuenta primero de la
  // bodega de la tienda origen y recien cuando no alcanza toma del salon:
  // { fromWarehouse: 0, fromSalesFloor: 1 } = no habia en bodega.
  fromWarehouse?: number
  fromSalesFloor?: number
  receivedQuantity: number | null
  reviewOutcome: ReviewOutcome | null
  reviewNote: string | null
}

export interface BranchTransfer {
  id: number
  type: BranchTransferType

  // true = envio de la central que pidio la tienda (reposicion)
  replenishment?: boolean
  status: BranchTransferStatus
  discrepancyStatus: DiscrepancyStatus

  // Calculados por el back segun quien mira: usarlos para la etiqueta y los botones
  stage?: string
  stageLabel?: string
  allowedActions?: TransferAction[]
  pendingReview?: boolean
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
  notFoundBy: TransferActor | null
  notFoundAt: string | null
  notFoundNote: string | null

  // Solo en pedidos entre sucursales (branch_request)
  customerName: string | null
  customerPhone: string | null
  customerCi: string | null
  pickupStatus: PickupStatus
  pickupOrderId: number | null
  pickupNote: string | null

  // Fechas fijadas al recibir: no recalcularlas desde receivedAt
  holdUntil: string | null
  pickupDeadline: string | null

  // Cobro al encargar (pedidos con anticipo)
  advanceAmount: string | null
  advancePaidAt: string | null
  qrExpiresAt: string | null

  // true = el QR vencio y la prenda dejo de estar apartada (el pedido NO se anula solo)
  paymentExpired: boolean | null
  refundOwed: string | null

  // Lo que falta devolver: es el valor del boton "Devolver"
  refundPending: string | null
  refunded: boolean | null
  advanceForfeited: boolean | null
  items: BranchTransferItem[]
}

export type PickupStatus = 'picked_up' | 'not_picked_up' | null

export type TransferAction =
  | 'dispatch'
  | 'attend'
  | 'receive'
  | 'cancel'
  | 'markLost'
  | 'review'
  | 'refund'
  | 'generateQr'
  | 'pickupInPos'
  | 'markNotPickedUp'
  | 'linkPickupSale'
  | 'addVariants'
  | 'removeVariant'

// Reposicion: la tienda pide variantes sin cantidad. Si ya tiene una abierta, se agregan ahi
export interface ReplenishmentRequest {
  variantIds: number[]
  note?: string
}

// La central atiende: todas las lineas, cada una con su cantidad (0 = no se manda).
// Todo en 0 = rechazada, y ahi la nota es obligatoria
export interface AttendReplenishmentRequest {
  items: { transferItemId: number; quantity: number }[]
  note?: string
}

export interface CreateBranchRequest {
  sourceBranchId: number
  items: { variantId: number; quantity: number }[]

  // Con paymentType el pedido se cobra al encargarlo; ahi expectedTotal y los
  // datos del cliente pasan a ser obligatorios, y la caja debe estar abierta
  paymentType?: 'cash' | 'card' | 'qr'
  expectedTotal?: number
  customerName?: string
  customerPhone?: string
  customerCi?: string
  note?: string
}

export interface QuoteRequest {
  sourceBranchId: number
  items: { variantId: number; quantity: number }[]
}

export interface QuoteResponse {
  sourceBranch: TransferBranch
  items: {
    variantId: number
    quantity: number
    unitPrice: string
    discountValue: number
    totalPrice: string
    available: number
  }[]

  // No recalcular en el front: este total es el que se manda como expectedTotal
  total: string
}

export interface DispatchRequest {

  // Vacio = sale todo lo pedido. Con items: cantidad por linea (0 = no se encontro)
  items?: { transferItemId: number; quantity: number }[]
  note?: string
}

export interface PickupRequest {
  status: 'picked_up' | 'not_picked_up'

  // Obligatorio con picked_up: la venta de esta tienda que se lo lleva
  orderId?: number
  note?: string
}

// Disponibilidad de una talla en cada tienda (no incluye la bodega principal)
export interface BranchStockItem {
  branch: TransferBranch
  salesFloor: number
  warehouse: number
  reserved: number
  heldForRequests: number

  // Lo unico que se puede pedir: piso - reserved - heldForRequests
  availableToRequest: number
  inTransit: number
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

  // Solo envios de la central: todo entra al deposito (por defecto) o directo a la tienda
  location?: 'warehouse' | 'sales_floor'
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
  awaitingPickup?: boolean
  pendingRefund?: boolean

  // true = solo reposiciones, false = sin reposiciones, omitido = todo
  replenishment?: boolean
  variantIds?: string

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

  // Devoluciones en camino a la central. Sin branchId (central) son todas;
  // para una tienda siempre 0, su devolucion ya cuenta en inTransit.
  returnsToReceive?: number

  // Tienda: 1 si tiene su reposicion abierta. Central: cuantas tiendas esperan ser atendidas
  replenishmentsPending?: number
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

// Igual que el QR de una venta, mas los datos del pedido
export interface RequestQrResponse {
  id: string
  qr: string
  success: boolean
  message: string
  gloss: string
  branchTransferId: number
  qrExpiresAt: string
}

export interface RefundRequest {
  note?: string
}

// Estadistica de retiro por par de sucursales, en un rango de fechas de recepcion
export interface PickupStatsItem {
  sourceBranch: TransferBranch
  destinationBranch: TransferBranch
  received: number
  pickedUp: number
  notPickedUp: number
  notPickedUpMarked: number
  notPickedUpExpired: number
  waiting: number
}

// --- Devoluciones a la bodega principal (doc 16) ---

export interface CreateReturnRequest {

  // Cada variante una sola vez, con su cantidad total
  items: { variantId: number; quantity: number }[]

  // De donde sale en la tienda. Por defecto 'warehouse'. Una devolucion sale
  // de UNA sola ubicacion: para las dos, se hacen dos devoluciones.
  location?: 'warehouse' | 'sales_floor'
  note?: string
}

export interface ReceiveReturnRequest {

  // Todas las lineas, una sola vez. Si llego menos, la nota es obligatoria.
  items: { transferItemId: number; quantity: number }[]
  note?: string
}
