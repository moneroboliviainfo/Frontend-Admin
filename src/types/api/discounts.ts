export interface BaseDiscount {
  description: string
  isActive: boolean
  value: number
}

export interface PermanentDiscountRequest extends BaseDiscount {}

export interface SeasonalDiscountRequest extends BaseDiscount {
  startDate: string
  endDate: string
}

export interface DiscountResponse {
  id: number
  description: string
  isActive: boolean
  value: number
  startDate?: string
  endDate?: string
  createdAt?: string
  updatedAt?: string
}

export interface AddDiscountsToProductsRequest {
  productsIds: number[]
  discountId: number
}

export interface AddDiscountsToProductsResponse {
  success: boolean
  message?: string
  updatedProducts?: number
}

export interface RemoveDiscountRequest {
  discount: null
}
export interface ApplyDiscountToAllRequest {
  discountId: number
}
