// services/cartService.ts

import { apiClient } from '@/libs/axios'
import type {
  CartRequest,
  CartResponse,
  RepriceResponse,
  Order,
  CreateOrderRequest,
  ConfirmOrderRequest,
  ConfirmOrderResponse,
  CancelOrderResponse,
  OrdersListParams,
  OrdersListResponse,
  GenerateQRRequest,
  GenerateQRResponse,
  VerifyPaymentResponse
} from '@/types/api/sales'

class CartServiceClass {
  //Agregar items al carrito
  async addToCart(data: CartRequest): Promise<CartResponse> {
    const response = await apiClient.post<CartResponse>('/api/cart', data)

    return response.data
  }

  //  Verificar disponibilidad y obtener precios actualizados

  async repriceCart(token: string): Promise<RepriceResponse> {
    const response = await apiClient.post<RepriceResponse>(`/api/orders/reprice/${token}`)

    return response.data
  }

  //Crear orden

  async createOrder(data: CreateOrderRequest): Promise<Order> {
    const response = await apiClient.post<Order>('/api/orders/in-store', data)

    return response.data
  }

  //Confirmar orden y pagar

  async confirmOrder(orderId: number, data?: ConfirmOrderRequest): Promise<ConfirmOrderResponse> {
    const response = await apiClient.post<ConfirmOrderResponse>(`/api/orders/confirm/${orderId}`, data || {})

    return response.data
  }

  async cancelOrder(orderId: number): Promise<CancelOrderResponse> {
    const response = await apiClient.post<CancelOrderResponse>(`/api/orders/cancel/${orderId}`)

    return response.data
  }

  async getOrders(params: OrdersListParams): Promise<OrdersListResponse> {
    const response = await apiClient.get<OrdersListResponse>('/api/orders', { params })

    return response.data
  }

  async sendOrder(orderId: number, dhlCode?: string): Promise<Order> {
    const payload = dhlCode ? { dhl_code: dhlCode } : {}
    const response = await apiClient.put<Order>(`/api/orders/${orderId}`, payload)

    return response.data
  }

  // Generar código QR para pago
  async generateQR(data: GenerateQRRequest): Promise<GenerateQRResponse> {
    const response = await apiClient.post<GenerateQRResponse>('/api/payments/generate-qr', data)

    return response.data
  }

  // Verificar si el pago con QR fue completado
  async verifyPayment(paymentId: string): Promise<VerifyPaymentResponse> {
    const response = await apiClient.get<VerifyPaymentResponse>(`/api/payments/verify/${paymentId}`)

    return response.data
  }

  // Exportar órdenes a Excel
  async exportToExcel(params: OrdersListParams): Promise<Blob> {
    const response = await apiClient.get('/api/orders/export/exel', {
      params,
      responseType: 'blob'
    })

    return response.data
  }

  // Cancelar orden para editar
  async cancelOrderForEdit(orderId: number): Promise<Order> {
    const response = await apiClient.post<Order>(`/api/orders/cancel-for-edit/${orderId}`)

    return response.data
  }

  // Obtener una orden específica
  async getOrder(orderId: number): Promise<Order> {
    const response = await apiClient.get<Order>(`/api/orders/${orderId}`)

    return response.data
  }

  // Actualizar orden (editar items)
  async updateOrder(orderId: number, items: string): Promise<Order> {
    const response = await apiClient.patch<Order>(`/api/orders/${orderId}`, { items })

    return response.data
  }
}

export const cartService = new CartServiceClass()
