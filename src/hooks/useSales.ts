import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

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
    mutationFn: ({
      token,
      branchTransferId,
      branchId
    }: {
      token: string
      branchTransferId?: number
      branchId?: number
    }) => cartService.repriceCart(token, branchTransferId, branchId),
    onError: (error: any) => {
      console.error('Error repricing cart:', error)
      throw error
    }
  })
}

export const useCreateOrder = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateOrderRequest) => cartService.createOrder(data),

    // La orden reserva stock: sin esto el catalogo sigue mostrando el numero viejo
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['variants'] })
    },
    onError: (error: any) => {
      console.error('Error creating order:', error)
      throw error
    }
  })
}

export const useConfirmOrder = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ orderId, data }: { orderId: number; data?: ConfirmOrderRequest }) =>
      cartService.confirmOrder(orderId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['variants'] })
      queryClient.invalidateQueries({ queryKey: ['branch-transfers'] })
    },
    onError: (error: any) => {
      console.error('Error confirming order:', error)
      throw error
    }
  })
}

export const useCancelOrder = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (orderId: number) => cartService.cancelOrder(orderId),

    // Cancelar libera la reserva: el stock vuelve a estar disponible
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['variants'] })
    },
    onError: (error: any) => {
      console.error('Error cancelling order:', error)
      throw error
    }
  })
}

export const useOrders = (params: OrdersListParams, enabled: boolean = true) => {
  return useQuery({
    queryKey: ['orders', params],
    queryFn: () => cartService.getOrders(params),
    staleTime: 30000,
    refetchOnWindowFocus: true,
    enabled
  })
}

export const useSendOrder = () => {
  return useMutation({
    mutationFn: ({ orderId, trackingCode }: { orderId: number; trackingCode?: string }) =>
      cartService.sendOrder(orderId, trackingCode),
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
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: BillingInfo) => cartService.createOrUpdateBilling(data),
    onSuccess: () => {
      // El POS busca los datos de facturacion por CI: sin esto, al volver a
      // consultar el mismo CI devolvia los datos viejos desde la cache.
      queryClient.invalidateQueries({ queryKey: ['billing'] })
    },
    onError: (error: any) => {
      console.error('Error creating/updating billing:', error)
      throw error
    }
  })
}

// Hook para obtener tipos de documento de identidad del SIAT
// `branchId`: obligatorio para ADMIN/SUPERVISOR (sin sucursal elegida, no se pide); M/C lo omiten
export const useTiposDocumentoIdentidad = (branchId?: number, enabled: boolean = true) => {
  return useQuery({
    enabled,
    queryKey: ['tipos-documento-identidad', branchId],
    queryFn: () => cartService.getTiposDocumentoIdentidad(branchId),
    staleTime: 1000 * 60 * 60, // Cache 1 hora
    retry: 2
  })
}

// Hook para obtener tipos de eventos significativos del catálogo SIAT
export const useEventosSignificativosParametricas = (branchId?: number, enabled: boolean = true) => {
  return useQuery({
    enabled,
    queryKey: ['eventos-significativos-parametricas', branchId],
    queryFn: () => cartService.getEventosSignificativosParametricas(branchId),
    staleTime: 1000 * 60 * 60, // Cache 1 hora
    retry: 2
  })
}

// Hook para obtener actividades económicas del SIAT
export const useActividades = (branchId?: number, enabled: boolean = true) => {
  return useQuery({
    enabled,
    queryKey: ['actividades-economicas', branchId],
    queryFn: () => cartService.getActividades(branchId),
    staleTime: 1000 * 60 * 60, // Cache 1 hora
    retry: 2
  })
}

// Hook para verificar NIT con el SIAT
export const useVerificarNit = () => {
  return useMutation({
    mutationFn: ({ nit, branchId }: { nit: number; branchId?: number }) => cartService.verificarNit(nit, branchId),
    onError: (error: any) => {
      console.error('Error verificando NIT:', error)
    }
  })
}

// Hook para obtener sucursales
// `enabled`: todos los endpoints de /branches son ADMIN/SUPERVISOR; a un cajero
// o encargado les responden 403. Su sucursal ya viene en el login.
export const useBranches = (enabled: boolean = true) => {
  return useQuery({
    enabled,
    queryKey: ['branches'],
    queryFn: () => cartService.getBranches(),
    staleTime: 1000 * 60 * 60, // Cache 1 hora
    retry: 2
  })
}

// Todas las sucursales que pueden facturar: las tiendas y las de solo
// facturacion. `GET /branches` sin parametro deja fuera a las segundas, que son
// justo donde vive buena parte de las facturas.
// `enabled`: todos los endpoints de /branches son ADMIN/SUPERVISOR. A un cajero
// le responden 403, asi que ni se pregunta: su sucursal sale del login.
export const useBillingBranches = (enabled: boolean = true) => {
  return useQuery({
    enabled,
    queryKey: ['branches', 'billing'],
    queryFn: async () => {
      const [tiendas, soloFacturacion] = await Promise.all([
        cartService.getBranches(),
        cartService.getBranches('billing_only')
      ])

      return [...tiendas, ...soloFacturacion]
    },
    staleTime: 1000 * 60 * 60,
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
export const useCufds = (
  branchId?: number,
  codigoPuntoVenta?: number,
  enabled: boolean = true
) => {
  return useQuery({
    queryKey: ['cufds', branchId, codigoPuntoVenta],
    queryFn: () => cartService.getCufds(branchId, codigoPuntoVenta),
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
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CafcCreateRequest) => cartService.createCafc(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cafcs'] })
    },
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

// Hook para obtener eventos significativos por sucursal (para contingencia)
// `branchId`: obligatorio para ADMIN/SUPERVISOR; M/C lo omiten (doc 10)
export const useEventosSignificativosBySucursal = (
  branchId?: number,
  codigoPuntoVenta?: number,
  enabled: boolean = true
) => {
  return useQuery({
    queryKey: ['eventos-significativos-sucursal', branchId, codigoPuntoVenta],
    queryFn: () => cartService.getEventosSignificativosBySucursal(branchId, codigoPuntoVenta),
    enabled,
    staleTime: 1000 * 60 * 2
  })
}

// Hook para crear evento significativo
export const useCrearEventoSignificativo = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      data,
      branchId,
      codigoPuntoVenta
    }: {
      data: EventoSignificativoRequest
      branchId?: number
      codigoPuntoVenta?: number
    }) => cartService.crearEventoSignificativo(data, branchId, codigoPuntoVenta),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['eventos-significativos'] })
      queryClient.invalidateQueries({ queryKey: ['eventos-significativos-sucursal'] })
      queryClient.invalidateQueries({ queryKey: ['eventos-by-cafc'] })
    },
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
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: PaqueteContingenciaRequest) => cartService.crearPaqueteContingencia(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['paquetes'] })
    },
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

// Hook para obtener Eventos Significativos disponibles por CAFC
export const useEventosByCafc = (
  cafc: string,
  branchId?: number,
  codigoPuntoVenta?: number,
  enabled: boolean = true
) => {
  return useQuery({
    queryKey: ['eventos-by-cafc', cafc, branchId, codigoPuntoVenta],
    queryFn: () => cartService.getEventosByCafc(cafc, branchId, codigoPuntoVenta),
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
      branchId,
      codigoPuntoVenta
    }: {
      data: FacturacionOnlineRequest
      branchId?: number
      codigoPuntoVenta?: number
    }) => cartService.facturarOnline(data, branchId, codigoPuntoVenta),
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
    enabled: enabled && !!params.branchId,
    staleTime: 1000 * 60 * 2
  })
}
