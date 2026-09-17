import { apiClient } from '@/libs/axios'
import type {
  Variant,
  CreateVariantDto,
  UpdateVariantDto,
  Color,
  Brand,
  CreateBrandDto,
  MultimediaUploadResponse,
  VariantsResponse,
  BrandsResponse,
  AddStockRequest,
  SubtractStockRequest,
  AddStockResponse,
  TransferStockRequest,
  StockTransfer
} from '@/types/api/variants'

class VariantServiceClass {
  async getVariantsByProduct(productId: number): Promise<VariantsResponse> {
    const response = await apiClient.get(`/api/products/${productId}`)

    const productColors = response.data.productColors || []

    return {
      variants: productColors,
      total: productColors.length
    }
  }
  async getVariantById(variantId: number, branchId?: number): Promise<Variant> {
    const response = await apiClient.get(`/api/variants/${variantId}`, {
      params: branchId ? { branchId } : undefined
    })

    return response.data
  }
  async getColorById(colorId: number): Promise<Color> {
    const response = await apiClient.get<Color>(`/api/colors/${colorId}`)

    return response.data
  }

  async createVariant(data: CreateVariantDto): Promise<Variant> {
    const response = await apiClient.post<Variant>('/api/variants', data)

    return response.data
  }
  async addStock({ branchId, ...body }: AddStockRequest): Promise<AddStockResponse> {
    const response = await apiClient.post<AddStockResponse>('/api/variants/addstock', body, {
      params: branchId ? { branchId } : undefined
    })

    return response.data
  }

  async subtractStock({ branchId, ...body }: SubtractStockRequest): Promise<AddStockResponse> {
    const response = await apiClient.post<AddStockResponse>('/api/variants/subtractstock', body, {
      params: branchId ? { branchId } : undefined
    })

    return response.data
  }

  async transferStock({ branchId, ...body }: TransferStockRequest): Promise<StockTransfer> {
    const response = await apiClient.post<StockTransfer>('/api/stock-transfers', body, {
      params: branchId ? { branchId } : undefined
    })

    return response.data
  }

  async updateVariant(id: number, data: UpdateVariantDto): Promise<Variant> {
    const response = await apiClient.patch<Variant>(`/api/variants/${id}`, data)

    return response.data
  }

  async deleteVariant(id: number): Promise<void> {
    await apiClient.delete(`/api/variants/${id}`)
  }

  async uploadMultimedia(files: File[]): Promise<MultimediaUploadResponse[]> {
    const formData = new FormData()

    files.forEach(file => {
      formData.append('files', file)
    })

    const response = await apiClient.post<MultimediaUploadResponse[]>('/api/multimedia', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      timeout: 300000
    })

    return response.data
  }

  async getColors(): Promise<Color[]> {
    // Confirmado con response real: NO está paginado, devuelve el array directo (el doc estaba desactualizado)
    const response = await apiClient.get<Color[]>('/api/colors')

    return response.data
  }

  async getBrands(): Promise<BrandsResponse> {
    // GET /brands también está paginado (doc backend); mismo caso que getColors
    const response = await apiClient.get<{ data: Brand[]; meta: { total: number } }>('/api/brands', {
      params: { limit: 1000, page: 1 }
    })

    return {
      brands: response.data.data,
      total: response.data.meta.total
    }
  }

  async createBrand(data: CreateBrandDto): Promise<Brand> {
    const response = await apiClient.post<Brand>('/api/brands', data)

    return response.data
  }
  async deleteMultimedia(urls: string[]): Promise<void> {
    await apiClient.delete('/api/multimedia', {
      data: urls
    })
  }

  async getAllVariants(
    page: number = 1,
    limit: number = 6,
    search: string = '',
    branchId?: number
  ): Promise<{
    data: Variant[]
    meta: {
      total: number
      page: number
      lastPage: number
      limit: number
      offset: number
      hasNextPage: boolean
      hasPreviousPage: boolean
    }
  }> {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      ...(search && { search }),
      ...(branchId && { branchId: branchId.toString() })
    })

    const response = await apiClient.get(`/api/variants?${params}`)

    return response.data
  }

  async exportToExcel(): Promise<Blob> {
    const response = await apiClient.get('/api/variants/export/exel', {
      responseType: 'blob'
    })

    return response.data
  }

  async exportTransactionsToExcel(): Promise<Blob> {
    const response = await apiClient.get('/api/variants/export/transactions/exel', {
      responseType: 'blob'
    })

    return response.data
  }

  async exportTotalSalesToExcel(startDate?: string, endDate?: string): Promise<Blob> {
    const params = new URLSearchParams()

    if (startDate) params.append('startDate', startDate)
    if (endDate) params.append('endDate', endDate)

    const response = await apiClient.get(`/api/variants/export/total-sales/exel?${params}`, {
      responseType: 'blob'
    })

    return response.data
  }

  async exportCriticalStock(): Promise<Blob> {
    const response = await apiClient.get('/api/variants/export/stock-critico', {
      responseType: 'blob'
    })

    return response.data
  }
}

export const variantService = new VariantServiceClass()
