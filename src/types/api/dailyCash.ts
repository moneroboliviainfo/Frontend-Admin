export type DailyCashStatus = 'open' | 'closed'

export interface DailyCashBranch {
  id: number
  name?: string
  active?: boolean
  createdAt?: string
}

export interface DailyCashUser {
  id: number
  name?: string
  email?: string
  rol?: string
  createdAt?: string
  sessionId?: string
  enabled?: boolean
}

export interface DailyCash {
  id: number
  status: DailyCashStatus
  openingAmount: string

  // expectedAmount = apertura + salesAmount + advancesAmount - refundsAmount.
  // Las cajas cerradas antes de este cambio traen los tres desgloses en null.
  //
  // OJO: `expectedAmount` incluye tarjeta y QR, que NO estan en el cajon. Para
  // comparar contra lo contado va `expectedCashAmount` (ver abajo).
  expectedAmount: string | null
  salesAmount: string | null
  advancesAmount: string | null
  refundsAmount: string | null

  // Totales por medio de pago, guardados al cerrar. Cada uno es
  // ventas + anticipos - devoluciones de esa caja. Las cajas cerradas antes del
  // 7/11/2026 los traen en null: ahi se compara contra `expectedAmount`.
  cashAmount?: string | null
  cardAmount?: string | null
  qrAmount?: string | null

  // El efectivo que tiene que haber EN EL CAJON = apertura + cashAmount.
  // Sobrante/faltante = closingAmount - expectedCashAmount
  expectedCashAmount?: string | null

  // Lo contado por el cajero: SOLO efectivo
  closingAmount: string | null
  closingNote: string | null

  // La cerro el sistema a las 00:00 (hora Bolivia) con la caja todavia abierta.
  // En ese caso `closedBy` viene null y `closingAmount` tambien: nadie conto
  autoClosed?: boolean

  // Cuando su dueño registro el conteo (POST /dailyCash/:id/count)
  countedAt?: string | null

  // Se cerro sola y su dueño todavia no la conto. Hasta que lo haga no puede
  // abrir otra caja, y sin caja no puede vender
  countPending?: boolean

  openedAt: string
  closedAt: string | null
  branch: DailyCashBranch

  // Solo en GET /dailyCash/current: el resumen en vivo, antes de cerrar
  summary?: DailyCashSummary

  openedBy?: DailyCashUser
  closedBy?: DailyCashUser
}

// Totales en vivo de la caja abierta (GET /dailyCash/current). Sirve para
// mostrarle al cajero cuanto deberia haber ANTES de contar.
export interface DailyCashAmountsByMethod {
  cash: string
  card: string
  qr: string
  total: string
}

export interface DailyCashSummary {
  sales: DailyCashAmountsByMethod
  advances: DailyCashAmountsByMethod
  refunds: DailyCashAmountsByMethod
  byMethod: DailyCashAmountsByMethod

  // apertura + byMethod.cash: lo que tiene que estar en el cajon
  expectedCash: string

  // apertura + todo (= expectedAmount). No sirve para contar el cajon
  expected: string
}

export interface OpenDailyCashRequest {
  openingAmount: string
}

export interface CloseDailyCashRequest {
  closingAmount: string
  closingNote?: string
}

// Conteo de una caja que se cerro sola. Mismo cuerpo que el cierre normal,
// pero va a POST /dailyCash/:id/count
export interface CountDailyCashRequest {
  closingAmount: string
  closingNote?: string
}

export interface DailyCashListParams {
  page?: number
  limit?: number

  // 'open' = las cajas abiertas ahora, una por cajero
  status?: DailyCashStatus

  // Las cajas de un usuario puntual
  userId?: number

  // Solo ADMIN/SUPERVISOR: el MANAGER siempre ve la de su sucursal
  branchId?: number
}

export interface DailyCashListResponse {
  data: DailyCash[]
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
