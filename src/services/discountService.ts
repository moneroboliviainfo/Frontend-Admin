import { apiClient } from '@/libs/axios'
import type {
  PermanentDiscountRequest,
  SeasonalDiscountRequest,
  DiscountResponse,
  AddDiscountsToProductsRequest,
  AddDiscountsToProductsResponse,
  RemoveDiscountRequest,
  ApplyDiscountToAllRequest
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

  async deleteAllPermanentDiscounts(): Promise<void> {
    await apiClient.delete('/api/discounts/permanents')
  }

  async deleteAllSeasonalDiscounts(): Promise<void> {
    await apiClient.delete('/api/discounts/seasonals')
  }
}

export const discountService = new DiscountServiceClass()
