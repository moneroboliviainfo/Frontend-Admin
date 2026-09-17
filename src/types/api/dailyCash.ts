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
  expectedAmount: string | null
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
