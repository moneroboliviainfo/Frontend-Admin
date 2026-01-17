import { useMutation, useQueryClient } from '@tanstack/react-query'

import { discountService } from '@/services/discountService'
import type {
  PermanentDiscountRequest,
  SeasonalDiscountRequest,
  AddDiscountsToProductsRequest
} from '@/types/api/discounts'

export const useCreatePermanentDiscount = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: PermanentDiscountRequest) => discountService.createPermanentDiscount(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
    }
  })
}

export const useCreateSeasonalDiscount = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: SeasonalDiscountRequest) => discountService.createSeasonalDiscount(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
    }
  })
}

export const useAddDiscountsToProducts = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: AddDiscountsToProductsRequest) => discountService.addDiscountsToProducts(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
    }
  })
}

export const useApplyDiscountToAll = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (discountId: number) => discountService.applyDiscountToAll({ discountId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
    }
  })
}

export const useRemoveDiscountFromProduct = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (productId: number) => discountService.removeDiscountFromProduct(productId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
    }
  })
}
