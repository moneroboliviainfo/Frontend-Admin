'use client'

import { useMemo } from 'react'

import { useQuery, useMutation, useQueryClient, useInfiniteQuery, keepPreviousData } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'

import { variantService } from '@/services/variantService'
import type {
  CreateVariantDto,
  UpdateVariantDto,
  CreateBrandDto,
  AddStockRequest,
  SubtractStockRequest,
  TransferStockRequest,
  PositiveAdjustmentRequest
} from '@/types/api/variants'

export const useVariantsByProduct = (productId: string | number | undefined) => {
  const numericProductId = useMemo(() => {
    if (!productId) return 0

    return typeof productId === 'string' ? parseInt(productId, 10) : productId
  }, [productId])

  return useQuery({
    queryKey: ['variants', 'product', numericProductId],
    queryFn: () => variantService.getVariantsByProduct(numericProductId),
    enabled: !!productId && numericProductId > 0 && !isNaN(numericProductId),
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always'
  })
}

export const useVariantById = (variantId: number | null, branchId?: number) => {
  return useQuery({
    // branchId en la queryKey: si el admin cambia de sucursal en la navbar, refetchea solo
    queryKey: ['variant', variantId, branchId],
    queryFn: () => variantService.getVariantById(variantId!, branchId),
    enabled: !!variantId && variantId > 0,
    staleTime: 0,
    gcTime: 0
  })
}

export const useColorById = (colorId: number | null) => {
  return useQuery({
    queryKey: ['color', colorId],
    queryFn: () => variantService.getColorById(colorId!),
    enabled: !!colorId && colorId > 0
  })
}

export const useCreateVariant = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateVariantDto) => variantService.createVariant(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['variants', 'product', variables.productId],
        refetchType: 'active'
      })
    }
  })
}

export const useUpdateVariant = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateVariantDto }) => variantService.updateVariant(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['variants', 'product', variables.data.productId],
        refetchType: 'active'
      })
    }
  })
}

// Mover stock deja rastro en varias vistas: la variante, el listado, el stock
// por sucursal, la bodega principal y el historial de movimientos. Este ultimo
// era el que faltaba: dar de baja no refrescaba MovementsModal.
const CLAVES_STOCK = ['variants', 'variant', 'branch-stock', 'central-warehouse', 'variant-movements']

const invalidarStock = (queryClient: QueryClient) => {
  CLAVES_STOCK.forEach(key => queryClient.invalidateQueries({ queryKey: [key], refetchType: 'active' }))
}

export const useAddStock = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: AddStockRequest) => variantService.addStock(data),
    onSuccess: () => {
      invalidarStock(queryClient)
    },
    onError: error => {
      console.error('Error adding stock:', error)
    }
  })
}

export const useSubtractStock = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: SubtractStockRequest) => variantService.subtractStock(data),
    onSuccess: () => {
      invalidarStock(queryClient)
    },
    onError: error => {
      console.error('Error subtracting stock:', error)
    }
  })
}

export const useTransferStock = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: TransferStockRequest) => variantService.transferStock(data),
    onSuccess: () => {
      invalidarStock(queryClient)
    },
    onError: error => {
      console.error('Error transferring stock:', error)
    }
  })
}

export const useDeleteVariant = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => variantService.deleteVariant(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['variants', 'product'],
        refetchType: 'active'
      })
    }
  })
}

export const useUploadMultimedia = () => {
  return useMutation({
    mutationFn: (files: File[]) => variantService.uploadMultimedia(files),
    onError: error => {
      console.error('Error uploading files:', error)
    }
  })
}

export const useColors = () => {
  return useQuery({
    queryKey: ['colors'],
    queryFn: () => variantService.getColors(),
    staleTime: 10 * 60 * 1000
  })
}

export const useBrands = () => {
  return useQuery({
    queryKey: ['brands'],
    queryFn: () => variantService.getBrands(),
    staleTime: 10 * 60 * 1000
  })
}

export const useCreateBrand = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateBrandDto) => variantService.createBrand(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brands'] })
    },
    onError: error => {
      console.error('Error creating brand:', error)
    }
  })
}

export const useVariants = (
  page: number = 1,
  limit: number = 10,
  search: string = '',
  branchId?: number,
  enabled: boolean = true,
  keepPrevious: boolean = false
) => {
  return useQuery({
    queryKey: ['variants', 'paginated', page, limit, search, branchId],
    queryFn: () => variantService.getAllVariants(page, limit, search, branchId),
    staleTime: 30000,
    enabled,

    // Mantiene la pagina anterior en pantalla mientras llega la nueva (sin volver al skeleton)
    placeholderData: keepPrevious ? keepPreviousData : undefined
  })
}

export const useInfiniteVariants = (limit: number = 6, search: string = '') => {
  return useInfiniteQuery({
    queryKey: ['variants', 'infinite', limit, search],
    queryFn: ({ pageParam = 1 }) => variantService.getAllVariants(pageParam, limit, search),
    getNextPageParam: lastPage => {
      return lastPage.meta.hasNextPage ? lastPage.meta.page + 1 : undefined
    },
    initialPageParam: 1,
    staleTime: 30000
  })
}

export const useDeleteMultimedia = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (urls: string[]) => variantService.deleteMultimedia(urls),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['variant'],
        refetchType: 'active'
      })
    },
    onError: error => {
      console.error('Error deleting multimedia:', error)
    }
  })
}

export const useVariantMovements = (
  variantId: number | null,
  branchId?: number,
  page: number = 1,
  limit: number = 20
) => {
  return useQuery({
    queryKey: ['variant-movements', variantId, branchId, page, limit],
    queryFn: () => variantService.getMovements(variantId!, branchId, page, limit),
    enabled: !!variantId
  })
}

export const usePositiveAdjustment = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: PositiveAdjustmentRequest) => variantService.positiveAdjustment(data),
    onSuccess: () => {
      invalidarStock(queryClient)
    }
  })
}
