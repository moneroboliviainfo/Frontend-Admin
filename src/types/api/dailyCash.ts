export interface DailyCash {
  id: number
  quantity: string
  date: string
  createdAt: string
  updatedAt: string
}

export interface CreateDailyCashRequest {
  quantity: string
}

export interface DailyCashResponse extends DailyCash {}
