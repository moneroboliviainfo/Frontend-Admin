import { apiClient } from '@/libs/axios'
import type {
  BranchTransfer,
  BranchTransferListParams,
  BranchTransferListResponse,
  CancelTransferRequest,
  CentralDispatchRequest,
  CentralWarehouse,
  MarkLostTransferRequest,
  PendingCount,
  ReceiveTransferRequest,
  ReviewTransferRequest
} from '@/types/api/branchTransfer'

class BranchTransferServiceClass {
  // La bodega central no aparece en GET /branches: su id se pide solo por acá
  async getCentralWarehouse(): Promise<CentralWarehouse> {
    const response = await apiClient.get<CentralWarehouse>('/api/central-warehouse')

    return response.data
  }

  async renameCentralWarehouse(name: string): Promise<CentralWarehouse> {
    const response = await apiClient.patch<CentralWarehouse>('/api/central-warehouse', { name })

    return response.data
  }

  // Envío de la bodega central a una sucursal (varias variantes en un solo envío)
  async centralDispatch(data: CentralDispatchRequest): Promise<BranchTransfer> {
    const response = await apiClient.post<BranchTransfer>('/api/branch-transfers/central-dispatch', data)

    return response.data
  }

  async receive(transferId: number, data: ReceiveTransferRequest): Promise<BranchTransfer> {
    const response = await apiClient.post<BranchTransfer>(`/api/branch-transfers/receive/${transferId}`, data)

    return response.data
  }

  // Solo mientras esta in_transit: todo vuelve al deposito de la bodega
  async cancel(transferId: number, data: CancelTransferRequest = {}): Promise<BranchTransfer> {
    const response = await apiClient.post<BranchTransfer>(`/api/branch-transfers/cancel/${transferId}`, data)

    return response.data
  }

  async markLost(transferId: number, data: MarkLostTransferRequest): Promise<BranchTransfer> {
    const response = await apiClient.post<BranchTransfer>(`/api/branch-transfers/mark-lost/${transferId}`, data)

    return response.data
  }

  // Se revisa recien con el traslado cerrado (received, not_found o lost)
  async review(transferId: number, data: ReviewTransferRequest): Promise<BranchTransfer> {
    const response = await apiClient.post<BranchTransfer>(`/api/branch-transfers/review/${transferId}`, data)

    return response.data
  }

  async getTransfers(params: BranchTransferListParams = {}): Promise<BranchTransferListResponse> {
    const response = await apiClient.get<BranchTransferListResponse>('/api/branch-transfers', { params })

    return response.data
  }

  async getTransfer(transferId: number): Promise<BranchTransfer> {
    const response = await apiClient.get<BranchTransfer>(`/api/branch-transfers/${transferId}`)

    return response.data
  }

  async getPendingCount(branchId?: number): Promise<PendingCount> {
    const response = await apiClient.get<PendingCount>('/api/branch-transfers/pending-count', {
      params: branchId ? { branchId } : undefined
    })

    return response.data
  }
}

export const branchTransferService = new BranchTransferServiceClass()
