import { apiClient } from '@/libs/axios'
import type {
  ProductWithStock,
  VariantsMeta,
  ImportStockResponse,
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
  PositiveAdjustmentRequest,
  AddStockResponse,
  TransferStockRequest,
  StockTransfer,
  StockMovementsResponse
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

  // Paginado por producto. Devuelve la misma info de stock que getAllVariants;
  // lo que cambia es la unidad de paginacion (producto, no color).
  async getProductsWithStock(
    page: number = 1,
    limit: number = 10,
    search: string = '',
    branchId?: number
  ): Promise<{ data: ProductWithStock[]; meta: VariantsMeta }> {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      ...(search && { search }),
      ...(branchId && { branchId: branchId.toString() })
    })

    const response = await apiClient.get(`/api/variants/products?${params}`)

    return response.data
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

  async positiveAdjustment({ branchId, ...body }: PositiveAdjustmentRequest): Promise<AddStockResponse> {
    const response = await apiClient.post<AddStockResponse>('/api/variants/positive-adjustment', body, {
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

  // Kardex de una talla en una sucursal (acepta la bodega central)
  async getMovements(
    variantId: number,
    branchId?: number,
    page: number = 1,
    limit: number = 20
  ): Promise<StockMovementsResponse> {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      ...(branchId && { branchId: branchId.toString() })
    })

    const response = await apiClient.get<StockMovementsResponse>(
      `/api/variants/${variantId}/movements?${params.toString()}`
    )

    return response.data
  }

  // --- Ingreso masivo por Excel: todo entra al deposito de la bodega principal ---

  async getImportStockTemplate(): Promise<Blob> {
    const response = await apiClient.get('/api/variants/import-stock/template', { responseType: 'blob' })

    return response.data
  }

  // dryRun SIEMPRE explicito: omitirlo importa de verdad, y cualquier valor que
  // no sea true/false literal es un 400
  async importStock(file: File, dryRun: boolean): Promise<ImportStockResponse> {
    const form = new FormData()

    form.append('file', file)

    const response = await apiClient.post<ImportStockResponse>('/api/variants/import-stock', form, {
      // El apiClient fuerza application/json: sin pisarlo, el boundary del
      // multipart no se arma y el back responde "Falta el archivo Excel"
      headers: { 'Content-Type': 'multipart/form-data' },
      params: { dryRun: dryRun ? 'true' : 'false' }
    })

    return response.data
  }

  async exportToExcel(branchId?: number): Promise<Blob> {
    const response = await apiClient.get('/api/variants/export/exel', {
      responseType: 'blob',
      params: branchId ? { branchId } : undefined
    })

    return response.data
  }

  async exportTransactionsToExcel(branchId?: number): Promise<Blob> {
    const response = await apiClient.get('/api/variants/export/transactions/exel', {
      responseType: 'blob',
      params: branchId ? { branchId } : undefined
    })

    return response.data
  }

  // La bodega central no acepta total-sales (no vende): va solo con sucursales
  async exportTotalSalesToExcel(startDate?: string, endDate?: string, branchId?: number): Promise<Blob> {
    const params = new URLSearchParams()

    if (startDate) params.append('startDate', startDate)
    if (endDate) params.append('endDate', endDate)
    if (branchId) params.append('branchId', branchId.toString())

    const response = await apiClient.get(`/api/variants/export/total-sales/exel?${params}`, {
      responseType: 'blob'
    })

    return response.data
  }

  async exportCriticalStock(branchId?: number): Promise<Blob> {
    const response = await apiClient.get('/api/variants/export/stock-critico', {
      responseType: 'blob',
      params: branchId ? { branchId } : undefined
    })

    return response.data
  }
}

export const variantService = new VariantServiceClass()
