'use client'

import { useMemo } from 'react'

import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query'

import { variantService } from '@/services/variantService'
import type { CreateVariantDto, UpdateVariantDto, CreateBrandDto, AddStockRequest } from '@/types/api/variants'

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

export const useVariantById = (variantId: number | null) => {
  return useQuery({
    queryKey: ['variant', variantId],
    queryFn: () => variantService.getVariantById(variantId!),
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

export const useAddStock = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: AddStockRequest) => variantService.addStock(data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['variants'],
        refetchType: 'active'
      })
      queryClient.invalidateQueries({
        queryKey: ['variant'],
        refetchType: 'active'
      })
    },
    onError: error => {
      console.error('Error adding stock:', error)
    }
  })
}

export const useSubtractStock = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: { variantId: number; quantity: number; reason?: string }) =>
      variantService.subtractStock(data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['variants'],
        refetchType: 'active'
      })
      queryClient.invalidateQueries({
        queryKey: ['variant'],
        refetchType: 'active'
      })
    },
    onError: error => {
      console.error('Error subtracting stock:', error)
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

export const useVariants = (page: number = 1, limit: number = 10, search: string = '') => {
  return useQuery({
    queryKey: ['variants', 'paginated', page, limit, search],
    queryFn: () => variantService.getAllVariants(page, limit, search),
    staleTime: 30000
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
