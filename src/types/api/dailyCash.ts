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

// Salidas de efectivo del cajon que NO son ventas ni devoluciones. Se restan
// del efectivo esperado, asi que entran en el arqueo.
export type DailyCashExpenseType = 'expense' | 'withdrawal'

// Solo para los gastos: un retiro no lleva categoria (el back da 400 si se manda)
export type DailyCashExpenseCategory = 'transport' | 'cleaning' | 'supplies' | 'food' | 'other'

export interface DailyCashExpense {
  id: number
  type: DailyCashExpenseType
  category: DailyCashExpenseCategory | null
  amount: string
  description: string
  createdAt: string

  // Anular NO borra: el movimiento queda con fecha y deja de restar. Se muestra
  // tachado o se oculta, pero no se saca de la lista
  voidedAt: string | null

  dailyCashId: number
  createdById: number
  createdBy?: { id: number; name?: string }
}

export interface CreateDailyCashExpenseRequest {
  type: DailyCashExpenseType

  // Obligatoria en un gasto, prohibida en un retiro
  category?: DailyCashExpenseCategory
  amount: string
  description: string
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

  // Gastos y retiros de esta caja. `null` en las cerradas antes del 8/11/2026:
  // ahi se muestran como 0
  expensesAmount?: string | null
  withdrawalsAmount?: string | null

  // El efectivo que tiene que haber EN EL CAJON:
  //   apertura + cashAmount - expensesAmount - withdrawalsAmount
  // Lo calcula el back: no sumarlo a mano o los gastos quedarian afuera y
  // apareceria un faltante falso.
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

  // Los movimientos de esta caja, anulados incluidos. Vienen en open, close,
  // count, pending-count y current; el historial trae solo los totales y el
  // detalle se pide con GET /dailyCash/:id/expenses
  expenses?: DailyCashExpense[]

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

  // Gastos y retiros del turno. `byMethod.cash` es lo que ENTRO en efectivo:
  // estos se restan aparte
  expenses: string
  withdrawals: string

  // apertura + byMethod.cash - gastos - retiros: lo que tiene que estar en el
  // cajon. Es contra esto que se compara el conteo
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
