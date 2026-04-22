import { useMutation, useQuery } from '@tanstack/react-query'

import { cartService } from '@/services/salesService'
import type {
  CartRequest,
  CreateOrderRequest,
  ConfirmOrderRequest,
  OrdersListParams,
  GenerateQRRequest
} from '@/types/api/sales'

export const useAddToCart = () => {
  return useMutation({
    mutationFn: (data: CartRequest) => cartService.addToCart(data),
    onError: (error: any) => {
      console.error('Error adding to cart:', error)
    }
  })
}

export const useRepriceCart = () => {
  return useMutation({
    mutationFn: (token: string) => cartService.repriceCart(token),
    onError: (error: any) => {
      console.error('Error repricing cart:', error)
      throw error
    }
  })
}

export const useCreateOrder = () => {
  return useMutation({
    mutationFn: (data: CreateOrderRequest) => cartService.createOrder(data),
    onError: (error: any) => {
      console.error('Error creating order:', error)
      throw error
    }
  })
}

export const useConfirmOrder = () => {
  return useMutation({
    mutationFn: ({ orderId, data }: { orderId: number; data?: ConfirmOrderRequest }) =>
      cartService.confirmOrder(orderId, data),
    onError: (error: any) => {
      console.error('Error confirming order:', error)
      throw error
    }
  })
}

export const useCancelOrder = () => {
  return useMutation({
    mutationFn: (orderId: number) => cartService.cancelOrder(orderId),
    onError: (error: any) => {
      console.error('Error cancelling order:', error)
      throw error
    }
  })
}

export const useOrders = (params: OrdersListParams) => {
  return useQuery({
    queryKey: ['orders', params],
    queryFn: () => cartService.getOrders(params),
    staleTime: 30000,
    refetchOnWindowFocus: true
  })
}

export const useSendOrder = () => {
  return useMutation({
    mutationFn: ({ orderId, dhlCode }: { orderId: number; dhlCode?: string }) =>
      cartService.sendOrder(orderId, dhlCode),
    onError: (error: any) => {
      console.error('Error sending order:', error)
      throw error
    }
  })
}

// Hook para generar QR de pago
export const useGenerateQR = () => {
  return useMutation({
    mutationFn: (data: GenerateQRRequest) => cartService.generateQR(data),
    onError: (error: any) => {
      console.error('Error generating QR:', error)
      throw error
    }
  })
}

// Hook para verificar pago QR
export const useVerifyPayment = (paymentId: string, enabled: boolean = false) => {
  return useQuery({
    queryKey: ['verify-payment', paymentId],
    queryFn: () => cartService.verifyPayment(paymentId),
    enabled: enabled && !!paymentId,
    refetchInterval: 3000, // Polling cada 3 segundos
    refetchIntervalInBackground: true,
    retry: false
  })
}

// Hook para cancelar orden y preparar para edición
export const useCancelOrderForEdit = () => {
  return useMutation({
    mutationFn: (orderId: number) => cartService.cancelOrderForEdit(orderId),
    onError: (error: any) => {
      console.error('Error cancelling order for edit:', error)
      throw error
    }
  })
}

// Hook para obtener una orden específica
export const useGetOrder = (orderId: number | null, enabled: boolean = true) => {
  return useQuery({
    queryKey: ['order', orderId],
    queryFn: () => cartService.getOrder(orderId!),
    enabled: enabled && !!orderId,
    retry: false
  })
}

// Hook para actualizar orden (editar items)
export const useUpdateOrder = () => {
  return useMutation({
    mutationFn: ({ orderId, items }: { orderId: number; items: string }) => cartService.updateOrder(orderId, items),
    onError: (error: any) => {
      console.error('Error updating order:', error)
      throw error
    }
  })
}
