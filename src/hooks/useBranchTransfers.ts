'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'

import { branchTransferService } from '@/services/branchTransferService'
import type {
  BranchTransferListParams,
  CancelTransferRequest,
  CentralDispatchRequest,
  CreateBranchRequest,
  DispatchRequest,
  PickupRequest,
  QuoteRequest,
  RefundRequest,
  MarkLostTransferRequest,
  ReceiveTransferRequest,
  ReplenishmentRequest,
  AttendReplenishmentRequest,
  ReviewTransferRequest
} from '@/types/api/branchTransfer'

// Un traslado mueve mercaderia (y a veces plata), asi que toca varias vistas a
// la vez: la lista y el detalle del traslado, el stock por sucursal, el de la
// bodega central, la variante y su historial de movimientos. Centralizado acá
// para que agregar una pantalla nueva no obligue a recordar cada mutacion.
const CLAVES_TRASLADO = [
  'branch-transfers', // lista + contador de pendientes
  'branch-transfer', // el detalle abierto
  'branch-stock', // que sucursales tienen la variante
  'central-warehouse', // stock de la bodega principal
  'variants',
  'variant',
  'variant-movements' // el historial que se ve en MovementsModal
]

const invalidarTraslados = (queryClient: QueryClient, tambienCaja = false) => {
  CLAVES_TRASLADO.forEach(key => queryClient.invalidateQueries({ queryKey: [key] }))

  // Cobrar un pedido o devolver un anticipo cambia lo esperado en caja
  if (tambienCaja) queryClient.invalidateQueries({ queryKey: ['dailyCash'] })
}

export const useCentralWarehouse = (enabled: boolean = true) => {
  return useQuery({
    queryKey: ['central-warehouse'],
    queryFn: () => branchTransferService.getCentralWarehouse(),
    staleTime: 1000 * 60 * 30,
    enabled
  })
}

export const useBranchTransfers = (params: BranchTransferListParams = {}, enabled: boolean = true) => {
  return useQuery({
    queryKey: ['branch-transfers', params],
    queryFn: () => branchTransferService.getTransfers(params),
    staleTime: 30000,
    enabled
  })
}

// pending-count no separa envios de pedidos (toReceive los suma): para el badge de cada
// menu se cuenta con el listado filtrado, pidiendo una sola fila y leyendo meta.total
export const useTransferCount = (params: BranchTransferListParams, enabled: boolean = true) => {
  const query = useQuery({
    queryKey: ['branch-transfers', 'count', params],
    queryFn: () => branchTransferService.getTransfers({ ...params, page: 1, limit: 1 }),
    refetchInterval: 30000,
    enabled
  })

  return query.data?.meta?.total || 0
}

export const useBranchTransfer = (transferId: number | null) => {
  return useQuery({
    queryKey: ['branch-transfer', transferId],
    queryFn: () => branchTransferService.getTransfer(transferId!),
    enabled: !!transferId
  })
}

// Sin websockets: el badge se refresca solo cada 30s
export const usePendingCount = (branchId?: number, enabled: boolean = true) => {
  return useQuery({
    queryKey: ['branch-transfers', 'pending-count', branchId],
    queryFn: () => branchTransferService.getPendingCount(branchId),
    refetchInterval: 30000,
    enabled
  })
}

export const useCentralDispatch = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CentralDispatchRequest) => branchTransferService.centralDispatch(data),
    onSuccess: () => {
      invalidarTraslados(queryClient)
    }
  })
}

export const useReceiveTransfer = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ transferId, data }: { transferId: number; data: ReceiveTransferRequest }) =>
      branchTransferService.receive(transferId, data),
    onSuccess: () => {
      invalidarTraslados(queryClient)
    }
  })
}

export const useCancelTransfer = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ transferId, data }: { transferId: number; data?: CancelTransferRequest }) =>
      branchTransferService.cancel(transferId, data),
    onSuccess: () => {
      invalidarTraslados(queryClient)
    }
  })
}

export const useMarkLostTransfer = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ transferId, data }: { transferId: number; data: MarkLostTransferRequest }) =>
      branchTransferService.markLost(transferId, data),
    onSuccess: () => {
      invalidarTraslados(queryClient)
    }
  })
}

export const useReviewTransfer = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ transferId, data }: { transferId: number; data: ReviewTransferRequest }) =>
      branchTransferService.review(transferId, data),
    onSuccess: () => {
      invalidarTraslados(queryClient)
    }
  })
}

export const useRenameCentralWarehouse = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (name: string) => branchTransferService.renameCentralWarehouse(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['central-warehouse'] })
    }
  })
}

// Sin branchId devuelve todas las tiendas (el POS lo usa asi para elegir a
// cual pedirle). Con branchId, solo esa.
export const useBranchStock = (variantId: number | null, branchId?: number) => {
  return useQuery({
    queryKey: ['branch-stock', variantId, branchId],
    queryFn: () => branchTransferService.getBranchStock(variantId!, branchId),
    enabled: !!variantId
  })
}

export const useCreateBranchRequest = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateBranchRequest) => branchTransferService.createRequest(data),
    onSuccess: () => {
      invalidarTraslados(queryClient, true)
    }
  })
}

export const useDispatchTransfer = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ transferId, data }: { transferId: number; data?: DispatchRequest }) =>
      branchTransferService.dispatch(transferId, data),
    onSuccess: () => {
      invalidarTraslados(queryClient)
    }
  })
}

export const useMarkPickup = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ transferId, data }: { transferId: number; data: PickupRequest }) =>
      branchTransferService.markPickup(transferId, data),
    onSuccess: () => {
      invalidarTraslados(queryClient)
    }
  })
}

// Pedidos recibidos que esperan a su cliente y contienen alguna de estas tallas.
// Solo lectura: sirve para avisarle al cajero que la prenda del carrito ya esta apartada.
export const useAwaitingPickupFor = (variantIds: number[]) => {
  const ids = [...new Set(variantIds)].sort((a, b) => a - b).join(',')

  return useQuery({
    queryKey: ['branch-transfers', 'awaiting-pickup', ids],
    queryFn: () => branchTransferService.getTransfers({ awaitingPickup: true, variantIds: ids }),
    enabled: ids.length > 0,
    staleTime: 30000
  })
}

export const useQuoteBranchRequest = () => {
  return useMutation({
    mutationFn: (data: QuoteRequest) => branchTransferService.quoteRequest(data)
  })
}

export const useGenerateRequestQr = () => {
  return useMutation({
    mutationFn: ({ transferId, gloss }: { transferId: number; gloss?: string }) =>
      branchTransferService.generateRequestQr(transferId, gloss)
  })
}

// Mientras el pedido espera el pago se consulta cada 3s, como pide el doc.
// Al salir de pending_payment el polleo se corta solo.
export const useWatchTransferPayment = (transferId: number | null, enabled: boolean) => {
  return useQuery({
    queryKey: ['branch-transfer', transferId],
    queryFn: () => branchTransferService.getTransfer(transferId!),
    enabled: !!transferId && enabled,
    refetchInterval: query => (query.state.data?.status === 'pending_payment' ? 3000 : false)
  })
}

export const useRefundRequest = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ transferId, data }: { transferId: number; data?: RefundRequest }) =>
      branchTransferService.refundRequest(transferId, data),
    onSuccess: () => {
      invalidarTraslados(queryClient, true)
    }
  })
}

export const useRequestReplenishment = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: ReplenishmentRequest) => branchTransferService.requestReplenishment(data),
    onSuccess: () => {
      invalidarTraslados(queryClient)
    }
  })
}

export const useRemoveReplenishmentItem = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ transferId, itemId }: { transferId: number; itemId: number }) =>
      branchTransferService.removeReplenishmentItem(transferId, itemId),
    onSuccess: () => {
      invalidarTraslados(queryClient)
    }
  })
}

export const useAttendReplenishment = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ transferId, data }: { transferId: number; data: AttendReplenishmentRequest }) =>
      branchTransferService.attendReplenishment(transferId, data),
    onSuccess: () => {
      invalidarTraslados(queryClient)
    }
  })
}

export const usePickupStats = (from: string, to: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: ['pickup-stats', from, to],
    queryFn: () => branchTransferService.getPickupStats(from, to),
    enabled: enabled && !!from && !!to,
    staleTime: 1000 * 60 * 5
  })
}
