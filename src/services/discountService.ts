import { apiClient } from '@/libs/axios'
import type {
  PermanentDiscountRequest,
  SeasonalDiscountRequest,
  DiscountResponse,
  AddDiscountsToProductsRequest,
  AddDiscountsToProductsResponse,
  RemoveDiscountRequest,
  ApplyDiscountToAllRequest,
  UpdatePermanentDiscountRequest,
  UpdateSeasonalDiscountRequest
} from '@/types/api/discounts'

class DiscountServiceClass {
  async createPermanentDiscount(data: PermanentDiscountRequest): Promise<DiscountResponse> {
    const response = await apiClient.post<DiscountResponse>('/api/discounts/permanent', data)

    return response.data
  }

  async createSeasonalDiscount(data: SeasonalDiscountRequest): Promise<DiscountResponse> {
    const response = await apiClient.post<DiscountResponse>('/api/discounts/seasonal', data)

    return response.data
  }

  async addDiscountsToProducts(data: AddDiscountsToProductsRequest): Promise<AddDiscountsToProductsResponse> {
    const response = await apiClient.put<AddDiscountsToProductsResponse>('/api/products/add-discounts', data)

    return response.data
  }
  async applyDiscountToAll(data: ApplyDiscountToAllRequest): Promise<AddDiscountsToProductsResponse> {
    const response = await apiClient.put<AddDiscountsToProductsResponse>('/api/products/add-discounts/all', data)

    return response.data
  }

  async removeDiscountFromProduct(productId: number): Promise<void> {
    const data: RemoveDiscountRequest = { discount: null }

    await apiClient.patch(`/api/products/${productId}`, data)
  }

  // Los descuentos que existen, con sus sucursales por canal. Sin paginar: trae
  // permanentes y de temporada juntos
  async getDiscounts(): Promise<DiscountResponse[]> {
    const response = await apiClient.get<DiscountResponse[]>('/api/discounts')

    return response.data || []
  }

  // Editar: lo que se usa para sacar un descuento de UNA sucursal sin tocar las
  // demas (se manda la lista sin esa sucursal)
  async updatePermanentDiscount(id: number, data: UpdatePermanentDiscountRequest): Promise<DiscountResponse> {
    const response = await apiClient.patch<DiscountResponse>(`/api/discounts/permanent/${id}`, data)

    return response.data
  }

  async updateSeasonalDiscount(id: number, data: UpdateSeasonalDiscountRequest): Promise<DiscountResponse> {
    const response = await apiClient.patch<DiscountResponse>(`/api/discounts/seasonal/${id}`, data)

    return response.data
  }

  // Borra UN descuento. No confundir con los de abajo, que borran todos los de
  // su tipo en todas las sucursales
  async deleteDiscount(id: number): Promise<void> {
    await apiClient.delete(`/api/discounts/${id}`)
  }

  async deleteAllPermanentDiscounts(): Promise<void> {
    await apiClient.delete('/api/discounts/permanents')
  }

  async deleteAllSeasonalDiscounts(): Promise<void> {
    await apiClient.delete('/api/discounts/seasonals')
  }
}

export const discountService = new DiscountServiceClass()
