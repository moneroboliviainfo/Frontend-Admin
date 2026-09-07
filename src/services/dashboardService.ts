import { apiClient } from '@/libs/axios'
import type { BestsellerItem, LowStockItem } from '@/types/api/dashboard'

class DashboardServiceClass {
  async getBestsellers(branchId?: number | null): Promise<BestsellerItem[]> {
    const params = branchId ? { branchId } : {}
    const response = await apiClient.get<BestsellerItem[]>('/api/variants/dashboard/bestsellers', { params })

    return response.data
  }

  async getLowStock(branchId?: number | null): Promise<LowStockItem[]> {
    const params = branchId ? { branchId } : {}
    const response = await apiClient.get<LowStockItem[]>('/api/variants/dashboard/lowStock', { params })

    return response.data
  }

  async getOrdersCount(branchId?: number | null): Promise<number> {
    const params: Record<string, unknown> = { page: 1, limit: 1 }

    if (branchId) params.branchId = branchId

    const response = await apiClient.get<{ meta: { total: number } }>('/api/orders', { params })

    return response.data.meta.total
  }

  // Estos endpoints no soportan branchId
  async getCustomersCount(): Promise<number> {
    const response = await apiClient.get<{ meta: { total: number } }>('/api/customers', {
      params: { page: 1, limit: 1 }
    })

    return response.data.meta.total
  }

  async getProductsCount(): Promise<number> {
    const response = await apiClient.get<{ meta: { total: number } }>('/api/products', {
      params: { page: 1, limit: 1 }
    })

    return response.data.meta.total
  }
}

export const dashboardService = new DashboardServiceClass()
