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
  closingAmount: string | null

  // expectedAmount = apertura + salesAmount + advancesAmount - refundsAmount.
  // Las cajas cerradas antes de este cambio traen los tres desgloses en null.
  expectedAmount: string | null
  salesAmount: string | null
  advancesAmount: string | null
  refundsAmount: string | null
  closingNote: string | null
  openedAt: string
  closedAt: string | null
  branch: DailyCashBranch
  openedBy?: DailyCashUser
  closedBy?: DailyCashUser
}

export interface OpenDailyCashRequest {
  openingAmount: string
}

export interface CloseDailyCashRequest {
  closingAmount: string
  closingNote?: string
}

export interface DailyCashListParams {
  page?: number
  limit?: number

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
