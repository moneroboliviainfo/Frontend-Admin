import { apiClient } from '@/libs/axios'
import type {
  BranchStockItem,
  BranchTransfer,
  BranchTransferListParams,
  BranchTransferListResponse,
  CancelTransferRequest,
  CentralDispatchRequest,
  CreateBranchRequest,
  DispatchRequest,
  PickupRequest,
  QuoteRequest,
  PickupStatsItem,
  RefundRequest,
  RequestQrResponse,
  QuoteResponse,
  CentralWarehouse,
  MarkLostTransferRequest,
  PendingCount,
  ReceiveTransferRequest,
  ReplenishmentRequest,
  AttendReplenishmentRequest,
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

  // Disponibilidad de una talla en cada tienda, para pedirle a otra sucursal
  async getBranchStock(variantId: number, branchId?: number): Promise<BranchStockItem[]> {
    const response = await apiClient.get<BranchStockItem[]>(`/api/variants/branch-stock/${variantId}`, {
      params: branchId ? { branchId } : undefined
    })

    return response.data
  }

  // Cotiza sin reservar nada: su total es el expectedTotal que pide createRequest
  async quoteRequest(data: QuoteRequest): Promise<QuoteResponse> {
    const response = await apiClient.post<QuoteResponse>('/api/branch-transfers/requests/quote', data)

    return response.data
  }

  async createRequest(data: CreateBranchRequest): Promise<BranchTransfer> {
    const response = await apiClient.post<BranchTransfer>('/api/branch-transfers/requests', data)

    return response.data
  }

  // Sin items sale todo lo pedido; con items, la cantidad por linea (0 = no estaba)
  async dispatch(transferId: number, data: DispatchRequest = {}): Promise<BranchTransfer> {
    const response = await apiClient.post<BranchTransfer>(`/api/branch-transfers/dispatch/${transferId}`, data)

    return response.data
  }

  async markPickup(transferId: number, data: PickupRequest): Promise<BranchTransfer> {
    const response = await apiClient.post<BranchTransfer>(`/api/branch-transfers/pickup/${transferId}`, data)

    return response.data
  }

  // QR del anticipo de un pedido. Cada llamada renueva el apartado y anula en
  // BNB los QR anteriores del mismo pedido.
  async generateRequestQr(transferId: number, gloss?: string): Promise<RequestQrResponse> {
    const response = await apiClient.post<RequestQrResponse>(
      `/api/payments/generate-qr/request/${transferId}`,
      gloss ? { gloss } : {}
    )

    return response.data
  }

  // Devuelve TODO lo pendiente de una vez y siempre en efectivo, desde la caja
  // de la tienda que pidio (tiene que estar abierta)
  async refundRequest(transferId: number, data: RefundRequest = {}): Promise<BranchTransfer> {
    const response = await apiClient.post<BranchTransfer>(`/api/branch-transfers/requests/${transferId}/refund`, data)

    return response.data
  }

  // La tienda pide variantes a la central. Si ya tiene una reposicion abierta, se suman ahi
  async requestReplenishment(data: ReplenishmentRequest): Promise<BranchTransfer> {
    const response = await apiClient.post<BranchTransfer>('/api/branch-transfers/replenishments', data)

    return response.data
  }

  // itemId es el id de la linea, no el variantId. Quitar la ultima anula la reposicion
  async removeReplenishmentItem(transferId: number, itemId: number): Promise<BranchTransfer> {
    const response = await apiClient.delete<BranchTransfer>(
      `/api/branch-transfers/replenishments/${transferId}/items/${itemId}`
    )

    return response.data
  }

  // La central atiende (algo > 0, sale de la bodega ahora) o rechaza (todo en 0, nota obligatoria)
  async attendReplenishment(transferId: number, data: AttendReplenishmentRequest): Promise<BranchTransfer> {
    const response = await apiClient.post<BranchTransfer>(
      `/api/branch-transfers/replenishments/${transferId}/dispatch`,
      data
    )

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

  async getPickupStats(from: string, to: string): Promise<PickupStatsItem[]> {
    const response = await apiClient.get<PickupStatsItem[]>('/api/branch-transfers/pickup-stats', {
      params: { from, to }
    })

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
