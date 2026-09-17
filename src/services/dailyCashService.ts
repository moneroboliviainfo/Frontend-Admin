import { apiClient } from '@/libs/axios'
import type { DailyCash, OpenDailyCashRequest, CloseDailyCashRequest } from '@/types/api/dailyCash'

class DailyCashServiceClass {
  async getCurrentDailyCash(): Promise<DailyCash> {
    const response = await apiClient.get<DailyCash>('/api/dailyCash/current')

    return response.data
  }

  async openDailyCash(data: OpenDailyCashRequest): Promise<DailyCash> {
    const response = await apiClient.post<DailyCash>('/api/dailyCash/open', data)

    return response.data
  }

  async closeDailyCash(id: number, data: CloseDailyCashRequest): Promise<DailyCash> {
    const response = await apiClient.post<DailyCash>(`/api/dailyCash/${id}/close`, data)

    return response.data
  }
}

export const dailyCashService = new DailyCashServiceClass()
