import { useMutation, useQuery } from '@tanstack/react-query'

import { cartService } from '@/services/salesService'
import type {
  CartRequest,
  CreateOrderRequest,
  ConfirmOrderRequest,
  OrdersListParams,
  GenerateQRRequest,
  FacturarRequest,
  FacturarContingenciaRequest,
  EventoSignificativoRequest,
  PaqueteContingenciaRequest,
  PaquetesListParams,
  CafcCreateRequest,
  FacturacionOnlineRequest,
  FacturacionListParams,
  BillingInfo
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

// Hook para buscar datos de facturación por CI
export const useSearchBilling = (ci: string) => {
  return useQuery({
    queryKey: ['billing', ci],
    queryFn: () => cartService.searchBilling(ci),
    enabled: ci.length >= 5,
    staleTime: 1000 * 60 * 5,
    retry: false
  })
}

// Hook para crear o actualizar datos de facturación (upsert)
export const useCreateOrUpdateBilling = () => {
  return useMutation({
    mutationFn: (data: BillingInfo) => cartService.createOrUpdateBilling(data),
    onError: (error: any) => {
      console.error('Error creating/updating billing:', error)
      throw error
    }
  })
}

// Hook para obtener tipos de documento de identidad del SIAT
export const useTiposDocumentoIdentidad = () => {
  return useQuery({
    queryKey: ['tipos-documento-identidad'],
    queryFn: () => cartService.getTiposDocumentoIdentidad(),
    staleTime: 1000 * 60 * 60, // Cache 1 hora
    retry: 2
  })
}

// Hook para obtener tipos de eventos significativos del catálogo SIAT
export const useEventosSignificativosParametricas = () => {
  return useQuery({
    queryKey: ['eventos-significativos-parametricas'],
    queryFn: () => cartService.getEventosSignificativosParametricas(),
    staleTime: 1000 * 60 * 60, // Cache 1 hora
    retry: 2
  })
}

// Hook para obtener actividades económicas del SIAT
export const useActividades = () => {
  return useQuery({
    queryKey: ['actividades-economicas'],
    queryFn: () => cartService.getActividades(),
    staleTime: 1000 * 60 * 60, // Cache 1 hora
    retry: 2
  })
}

// Hook para verificar NIT con el SIAT
export const useVerificarNit = () => {
  return useMutation({
    mutationFn: (nit: number) => cartService.verificarNit(nit),
    onError: (error: any) => {
      console.error('Error verificando NIT:', error)
    }
  })
}

// Hook para obtener sucursales
export const useBranches = () => {
  return useQuery({
    queryKey: ['branches'],
    queryFn: () => cartService.getBranches(),
    staleTime: 1000 * 60 * 60, // Cache 1 hora
    retry: 2
  })
}

// Hook para emitir factura
export const useFacturar = () => {
  return useMutation({
    mutationFn: ({ orderId, data }: { orderId: number; data: FacturarRequest }) =>
      cartService.facturar(orderId, data),
    onError: (error: any) => {
      console.error('Error emitiendo factura:', error)
    }
  })
}

// Hook para obtener CUFDs
export const useCufds = (codigoSucursal: number, codigoPuntoVenta: number, enabled: boolean = true) => {
  return useQuery({
    queryKey: ['cufds', codigoSucursal, codigoPuntoVenta],
    queryFn: () => cartService.getCufds(codigoSucursal, codigoPuntoVenta),
    enabled,
    staleTime: 1000 * 60 * 5
  })
}

// Hook para obtener CAFCs
export const useCafcs = () => {
  return useQuery({
    queryKey: ['cafcs'],
    queryFn: () => cartService.getCafcs(),
    staleTime: 1000 * 60 * 5
  })
}

// Hook para crear CAFC
export const useCreateCafc = () => {
  return useMutation({
    mutationFn: (data: CafcCreateRequest) => cartService.createCafc(data),
    onError: (error: any) => {
      console.error('Error creando CAFC:', error)
    }
  })
}

// Hook para emitir factura por contingencia
export const useFacturarContingencia = () => {
  return useMutation({
    mutationFn: ({ orderId, data }: { orderId: number; data: FacturarContingenciaRequest }) =>
      cartService.facturarContingencia(orderId, data),
    onError: (error: any) => {
      console.error('Error emitiendo factura por contingencia:', error)
    }
  })
}

// ============ SIAT: Eventos Significativos ============

// Hook para obtener eventos significativos
export const useEventosSignificativos = () => {
  return useQuery({
    queryKey: ['eventos-significativos'],
    queryFn: () => cartService.getEventosSignificativos(),
    staleTime: 1000 * 60 * 5
  })
}

// Hook para crear evento significativo
export const useCrearEventoSignificativo = () => {
  return useMutation({
    mutationFn: ({
      data,
      codigoSucursal,
      codigoPuntoVenta
    }: {
      data: EventoSignificativoRequest
      codigoSucursal?: number
      codigoPuntoVenta?: number
    }) => cartService.crearEventoSignificativo(data, codigoSucursal, codigoPuntoVenta),
    onError: (error: any) => {
      console.error('Error creando evento significativo:', error)
    }
  })
}

// ============ SIAT: Paquetes de Contingencia ============

// Hook para obtener paquetes
export const usePaquetes = (params: PaquetesListParams = {}) => {
  return useQuery({
    queryKey: ['paquetes', params],
    queryFn: () => cartService.getPaquetes(params),
    staleTime: 1000 * 60 * 2
  })
}

// Hook para obtener un paquete específico
export const usePaquete = (id: number, enabled: boolean = true) => {
  return useQuery({
    queryKey: ['paquete', id],
    queryFn: () => cartService.getPaquete(id),
    enabled: enabled && !!id,
    staleTime: 1000 * 60 * 5
  })
}

// Hook para crear paquete de contingencia
export const useCrearPaqueteContingencia = () => {
  return useMutation({
    mutationFn: (data: PaqueteContingenciaRequest) => cartService.crearPaqueteContingencia(data),
    onError: (error: any) => {
      console.error('Error creando paquete de contingencia:', error)
    }
  })
}

// Hook para obtener CUFDs disponibles por CAFC
export const useCufdsByCafc = (cafc: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: ['cufds-by-cafc', cafc],
    queryFn: () => cartService.getCufdsByCafc(cafc),
    enabled: enabled && !!cafc,
    staleTime: 1000 * 60 * 2
  })
}

// Hook para validar paquete (enviar a SIAT)
export const useValidarPaquete = () => {
  return useMutation({
    mutationFn: (paqueteId: number) => cartService.validarPaquete(paqueteId),
    onError: (error: any) => {
      console.error('Error validando paquete:', error)
    }
  })
}

// Hook para anular factura
export const useAnularFactura = () => {
  return useMutation({
    mutationFn: ({ facturaId, codigoMotivo }: { facturaId: number; codigoMotivo: number }) =>
      cartService.anularFactura(facturaId, codigoMotivo),
    onError: (error: any) => {
      console.error('Error anulando factura:', error)
    }
  })
}

// Hook para revertir anulación de factura (solo una vez por factura)
export const useRevertirAnulacion = () => {
  return useMutation({
    mutationFn: (facturaId: number) => cartService.revertirAnulacion(facturaId),
    onError: (error: any) => {
      console.error('Error revirtiendo anulación:', error)
    }
  })
}

// ============ Facturación Online (otras sucursales) ============

// Hook para emitir factura online
export const useFacturarOnline = () => {
  return useMutation({
    mutationFn: ({
      data,
      codigoSucursal,
      codigoPuntoVenta
    }: {
      data: FacturacionOnlineRequest
      codigoSucursal: number
      codigoPuntoVenta: number
    }) => cartService.facturarOnline(data, codigoSucursal, codigoPuntoVenta),
    onError: (error: any) => {
      console.error('Error emitiendo factura online:', error)
    }
  })
}

// Hook para listar facturas
export const useFacturas = (params: FacturacionListParams, enabled: boolean = true) => {
  return useQuery({
    queryKey: ['facturas', params],
    queryFn: () => cartService.getFacturas(params),
    enabled: enabled && params.codigoSucursal !== undefined,
    staleTime: 1000 * 60 * 2
  })
}
