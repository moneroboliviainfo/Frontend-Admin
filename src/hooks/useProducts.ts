'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

import { productService } from '@/services/productService'
import type { CreateProductDto, UpdateProductDto, ProductsParams } from '@/types/api/product'

export const useProducts = (params: ProductsParams = {}) => {
  return useQuery({
    queryKey: [
      'products',
      {
        page: params.page || 1,
        limit: params.limit || 10,
        search: params.search || ''
      }
    ],
    queryFn: () => productService.getProducts(params),
    placeholderData: previousData => previousData,
    staleTime: 5 * 60 * 1000,
    retry: 2
  })
}

export const useProduct = (id: number) => {
  return useQuery({
    queryKey: ['product', id],
    queryFn: () => productService.getProductById(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000
  })
}

export const useCreateProduct = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateProductDto) => productService.createProduct(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
    }
  })
}

export const useUpdateProduct = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateProductDto }) => productService.updateProduct(id, data),
    onSuccess: updatedProduct => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['product', updatedProduct.id] })
    }
  })
}

export const useDeleteProduct = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => productService.deleteProduct(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
    }
  })
}

// Hook para obtener lista de productos SIN (SIAT)
export const useProductosSIN = () => {
  return useQuery({
    queryKey: ['productos-sin'],
    queryFn: () => productService.getProductosSIN(),
    staleTime: 1000 * 60 * 60, // Cache 1 hora
    retry: 2
  })
}
