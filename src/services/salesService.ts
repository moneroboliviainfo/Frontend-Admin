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
  VerifyPaymentResponse,
  BillingInfo,
  BillingSearchResponse,
  ParametricasResponse,
  ParametricasRequest,
  ActividadesResponse,
  VerificarNitResponse,
  VerificarNitRequest,
  Branch,
  FacturarRequest,
  FacturarResponse,
  Factura,
  Cufd,
  Cafc,
  CafcCreateRequest,
  FacturarContingenciaRequest,
  EventoSignificativo,
  EventoSignificativoRequest,
  Paquete,
  PaqueteContingenciaRequest,
  PaquetesListResponse,
  PaquetesListParams,
  CufdByCafc,
  EventoByCafc,
  FacturacionOnlineRequest,
  FacturacionListParams,
  FacturacionListResponse
} from '@/types/api/sales'

class CartServiceClass {
  //Agregar items al carrito
  async addToCart(data: CartRequest): Promise<CartResponse> {
    const response = await apiClient.post<CartResponse>('/api/cart', data)

    return response.data
  }

  //  Verificar disponibilidad y obtener precios actualizados

  async repriceCart(token: string): Promise<RepriceResponse> {
    const response = await apiClient.post<RepriceResponse>(`/api/orders/reprice/${token}?type=in_store`)

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

  // Buscar datos de facturación por CI
  async searchBilling(ci: string): Promise<BillingSearchResponse | null> {
    const response = await apiClient.get<BillingSearchResponse>(`/api/billing/${ci}`)

    return response.data
  }

  // Crear o actualizar datos de facturación (upsert)
  async createOrUpdateBilling(data: BillingInfo): Promise<BillingSearchResponse> {
    const response = await apiClient.post<BillingSearchResponse>('/api/billing', data)

    return response.data
  }

  // Obtener tipos de documento de identidad del SIAT
  async getTiposDocumentoIdentidad(): Promise<ParametricasResponse> {
    const response = await apiClient.post<ParametricasResponse>(
      '/api/catalogos/parametricas',
      { metodo: 'sincronizarParametricaTipoDocumentoIdentidad' } as ParametricasRequest,
      { params: { codigoSucursal: 0, codigoPuntoVenta: 0 } }
    )

    return response.data
  }

  // Obtener tipos de eventos significativos del SIAT
  async getEventosSignificativosParametricas(): Promise<ParametricasResponse> {
    const response = await apiClient.post<ParametricasResponse>(
      '/api/catalogos/parametricas',
      { metodo: 'sincronizarParametricaEventosSignificativos' } as ParametricasRequest,
      { params: { codigoSucursal: 0, codigoPuntoVenta: 0 } }
    )

    return response.data
  }

  // Obtener actividades económicas del SIAT
  async getActividades(): Promise<ActividadesResponse> {
    const response = await apiClient.post<ActividadesResponse>(
      '/api/catalogos/parametricas',
      { metodo: 'sincronizarActividades' } as ParametricasRequest,
      { params: { codigoSucursal: 0, codigoPuntoVenta: 0 } }
    )

    return response.data
  }

  // Verificar NIT con el SIAT
  async verificarNit(nit: number): Promise<VerificarNitResponse> {
    const response = await apiClient.post<VerificarNitResponse>(
      '/api/codigos/verificar-nit',
      { nitParaVerificacion: nit } as VerificarNitRequest,
      { params: { codigoSucursal: 0, codigoPuntoVenta: 0 } }
    )

    return response.data
  }

  // Obtener lista de sucursales
  async getBranches(): Promise<Branch[]> {
    const response = await apiClient.get<Branch[]>('/api/branches')

    return response.data
  }

  // Emitir factura para una orden
  async facturar(orderId: number, data: FacturarRequest): Promise<FacturarResponse> {
    const response = await apiClient.post<FacturarResponse>(`/api/orders/${orderId}/facturar`, data)

    return response.data
  }

  // Obtener lista de CUFDs
  async getCufds(codigoSucursal: number, codigoPuntoVenta: number): Promise<Cufd[]> {
    const response = await apiClient.get<Cufd[]>('/api/codigos/cufd/all', {
      params: { codigoSucursal, codigoPuntoVenta }
    })

    return response.data
  }

  // Obtener lista de CAFCs
  async getCafcs(): Promise<Cafc[]> {
    const response = await apiClient.get<Cafc[]>('/api/cafc')

    return response.data
  }

  // Crear nuevo CAFC
  async createCafc(data: CafcCreateRequest): Promise<Cafc> {
    const response = await apiClient.post<Cafc>('/api/cafc', data)

    return response.data
  }

  // Emitir factura por contingencia
  async facturarContingencia(orderId: number, data: FacturarContingenciaRequest): Promise<Factura> {
    const response = await apiClient.post<Factura>(`/api/orders/${orderId}/facturar-contingencia`, data)

    return response.data
  }

  // ============ SIAT: Eventos Significativos ============

  // Obtener lista de eventos significativos
  async getEventosSignificativos(): Promise<EventoSignificativo[]> {
    const response = await apiClient.get<EventoSignificativo[]>('/api/operaciones/evento-significativo')

    return response.data
  }

  // Obtener eventos significativos por sucursal y punto de venta
  async getEventosSignificativosBySucursal(
    codigoSucursal: number,
    codigoPuntoVenta: number
  ): Promise<EventoSignificativo[]> {
    const response = await apiClient.get<EventoSignificativo[]>('/api/operaciones/evento-significativo', {
      params: { codigoSucursal, codigoPuntoVenta }
    })

    return response.data
  }

  // Registrar nuevo evento significativo
  async crearEventoSignificativo(
    data: EventoSignificativoRequest,
    codigoSucursal: number = 0,
    codigoPuntoVenta: number = 0
  ): Promise<EventoSignificativo> {
    const response = await apiClient.post<EventoSignificativo>('/api/operaciones/evento-significativo', data, {
      params: { codigoSucursal, codigoPuntoVenta }
    })

    return response.data
  }

  // ============ SIAT: Paquetes de Contingencia ============

  // Obtener lista de paquetes
  async getPaquetes(params: PaquetesListParams = {}): Promise<PaquetesListResponse> {
    const response = await apiClient.get<PaquetesListResponse>('/api/paquetes', {
      params: {
        codigoSucursal: params.codigoSucursal ?? 0,
        codigoPuntoVenta: params.codigoPuntoVenta ?? 0,
        page: params.page ?? 1,
        limit: params.limit ?? 10
      }
    })

    return response.data
  }

  // Obtener un paquete específico
  async getPaquete(id: number): Promise<Paquete> {
    const response = await apiClient.get<Paquete>(`/api/paquetes/${id}`)

    return response.data
  }

  // Crear paquete de contingencia
  async crearPaqueteContingencia(data: PaqueteContingenciaRequest): Promise<Paquete> {
    const response = await apiClient.post<Paquete>('/api/paquetes/contingencia', data)

    return response.data
  }

  // Obtener CUFDs disponibles por CAFC para paquetes de contingencia
  async getCufdsByCafc(cafc: string): Promise<CufdByCafc[]> {
    const response = await apiClient.get<CufdByCafc[]>(`/api/paquetes/contingencia/${cafc}/cufds`)

    return response.data
  }

  // Obtener eventos significativos disponibles por CAFC para paquetes de contingencia
  async getEventosByCafc(
    cafc: string,
    codigoSucursal: number,
    codigoPuntoVenta: number
  ): Promise<EventoByCafc[]> {
    const response = await apiClient.get<EventoByCafc[]>(`/api/paquetes/contingencia/${cafc}/eventos`, {
      params: { codigoSucursal, codigoPuntoVenta }
    })

    return response.data
  }

  // Enviar paquete a SIAT para validación
  async validarPaquete(paqueteId: number): Promise<Paquete> {
    const response = await apiClient.post<Paquete>(`/api/paquetes/validacion/${paqueteId}`)

    return response.data
  }

  // Anular factura
  async anularFactura(facturaId: number, codigoMotivo: number): Promise<Factura> {
    const response = await apiClient.post<Factura>('/api/facturacion/facturacion/anulacion', {
      codigoMotivo,
      facturaId
    })

    return response.data
  }

  // Revertir anulación de factura (solo se puede usar una vez por factura)
  async revertirAnulacion(facturaId: number): Promise<Factura> {
    const response = await apiClient.post<Factura>('/api/facturacion/facturacion/reversion', {
      facturaId
    })

    return response.data
  }

  // ============ Facturación Online (otras sucursales) ============

  // Emitir factura online para otras sucursales
  async facturarOnline(
    data: FacturacionOnlineRequest,
    codigoSucursal: number,
    codigoPuntoVenta: number
  ): Promise<FacturarResponse> {
    const response = await apiClient.post<FacturarResponse>('/api/facturacion/facturacion/online', data, {
      params: { codigoSucursal, codigoPuntoVenta }
    })

    return response.data
  }

  // Listar facturas de una sucursal
  async getFacturas(params: FacturacionListParams): Promise<FacturacionListResponse> {
    const response = await apiClient.get<FacturacionListResponse>('/api/facturacion/facturacion', {
      params: {
        codigoSucursal: params.codigoSucursal,
        codigoPuntoVenta: params.codigoPuntoVenta,
        search: params.search,
        page: params.page ?? 1,
        limit: params.limit ?? 10,
        fechaInicio: params.fechaInicio,
        fechaFin: params.fechaFin
      }
    })

    return response.data
  }
}

export const cartService = new CartServiceClass()
