import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { discountService } from '@/services/discountService'
import type {
  PermanentDiscountRequest,
  SeasonalDiscountRequest,
  AddDiscountsToProductsRequest,
  UpdatePermanentDiscountRequest,
  UpdateSeasonalDiscountRequest
} from '@/types/api/discounts'

// La lista de descuentos con sus sucursales. La pantalla de Descuentos lista
// PRODUCTOS; esto es para gestionar los descuentos en si
export const useDiscountsList = (enabled: boolean = true) => {
  return useQuery({
    queryKey: ['discounts'],
    queryFn: () => discountService.getDiscounts(),
    enabled,
    staleTime: 30000
  })
}

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

// Editar un descuento. Se invalidan tambien los descuentos: la lista de la
// pantalla tiene que reflejar las sucursales nuevas, no solo los precios
export const useUpdatePermanentDiscount = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdatePermanentDiscountRequest }) =>
      discountService.updatePermanentDiscount(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['discounts'] })
    }
  })
}

export const useUpdateSeasonalDiscount = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateSeasonalDiscountRequest }) =>
      discountService.updateSeasonalDiscount(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['discounts'] })
    }
  })
}

// Borra UNO. El equivalente masivo es useDeleteAllPermanentDiscounts, que borra
// todos los de su tipo en TODAS las sucursales
export const useDeleteDiscount = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => discountService.deleteDiscount(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['discounts'] })
    }
  })
}

export const useDeleteAllPermanentDiscounts = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => discountService.deleteAllPermanentDiscounts(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
    }
  })
}

export const useDeleteAllSeasonalDiscounts = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => discountService.deleteAllSeasonalDiscounts(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
    }
  })
}
