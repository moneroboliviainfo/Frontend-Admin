import { apiClient } from '@/libs/axios'
import type { DailyCashResponse, CreateDailyCashRequest } from '@/types/api/dailyCash'

class DailyCashServiceClass {
  async getDailyCash(): Promise<DailyCashResponse> {
    const response = await apiClient.get<DailyCashResponse>('/api/dailyCash')

    return response.data
  }

  async createDailyCash(data: CreateDailyCashRequest): Promise<DailyCashResponse> {
    const response = await apiClient.post<DailyCashResponse>('/api/dailyCash', data)

    return response.data
  }
}

export const dailyCashService = new DailyCashServiceClass()
