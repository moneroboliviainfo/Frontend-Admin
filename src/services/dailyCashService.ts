import { apiClient } from '@/libs/axios'
import type {
  DailyCash,
  DailyCashListParams,
  DailyCashListResponse,
  OpenDailyCashRequest,
  CloseDailyCashRequest,
  CountDailyCashRequest
} from '@/types/api/dailyCash'

class DailyCashServiceClass {
  // Historial de cajas: el MANAGER ve la suya, ADMIN/SUPERVISOR filtran por sucursal
  async getHistory(params: DailyCashListParams = {}): Promise<DailyCashListResponse> {
    const response = await apiClient.get<DailyCashListResponse>('/api/dailyCash', { params })

    return response.data
  }

  async getCurrentDailyCash(): Promise<DailyCash> {
    const response = await apiClient.get<DailyCash>('/api/dailyCash/current')

    return response.data
  }

  async openDailyCash(data: OpenDailyCashRequest): Promise<DailyCash> {
    const response = await apiClient.post<DailyCash>('/api/dailyCash/open', data)

    return response.data
  }

  // Historial de las cajas del usuario logueado (M, C). Misma info que el del
  // admin, pero sin poder ver las de otros
  async getMyHistory(params: DailyCashListParams = {}): Promise<DailyCashListResponse> {
    const response = await apiClient.get<DailyCashListResponse>('/api/dailyCash/mine', { params })

    return response.data
  }

  // La caja propia que se cerro sola y espera conteo, o null si no hay.
  // Hay que consultarla ANTES de ofrecer "Abrir caja": con una pendiente,
  // POST /dailyCash/open responde 409
  async getPendingCount(): Promise<DailyCash | null> {
    const response = await apiClient.get<DailyCash | null>('/api/dailyCash/pending-count')

    return response.data || null
  }

  // Registrar el conteo de una caja cerrada automaticamente (solo la propia)
  async countDailyCash(id: number, data: CountDailyCashRequest): Promise<DailyCash> {
    const response = await apiClient.post<DailyCash>(`/api/dailyCash/${id}/count`, data)

    return response.data
  }

  async closeDailyCash(id: number, data: CloseDailyCashRequest): Promise<DailyCash> {
    const response = await apiClient.post<DailyCash>(`/api/dailyCash/${id}/close`, data)

    return response.data
  }
}

export const dailyCashService = new DailyCashServiceClass()
