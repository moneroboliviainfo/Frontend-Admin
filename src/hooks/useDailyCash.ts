import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

import { dailyCashService } from '@/services/dailyCashService'
import type {
  DailyCashListParams,
  OpenDailyCashRequest,
  CloseDailyCashRequest,
  CountDailyCashRequest
} from '@/types/api/dailyCash'

export const useDailyCash = () => {
  return useQuery({
    queryKey: ['dailyCash'],
    queryFn: () => dailyCashService.getCurrentDailyCash(),
    retry: false, // No reintentar si falla
    refetchOnWindowFocus: false
  })
}

// La caja propia cerrada automaticamente que espera conteo. Se consulta al
// entrar al POS: mientras haya una, POST /dailyCash/open responde 409 y el
// cajero no puede vender, asi que primero hay que pedirle el conteo.
export const usePendingCountDailyCash = (enabled: boolean = true) => {
  return useQuery({
    queryKey: ['dailyCash', 'pending-count'],
    queryFn: () => dailyCashService.getPendingCount(),
    enabled,
    retry: false,
    refetchOnWindowFocus: false
  })
}

export const useCountDailyCash = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: CountDailyCashRequest }) =>
      dailyCashService.countDailyCash(id, data),
    onSuccess: () => {
      // Al contarla se libera la apertura: las dos consultas quedan viejas
      queryClient.invalidateQueries({ queryKey: ['dailyCash'] })
    }
  })
}

export const useOpenDailyCash = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: OpenDailyCashRequest) => dailyCashService.openDailyCash(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dailyCash'] })
    },
    onError: (error: any) => {
      console.error('Error opening daily cash:', error)
      throw error
    }
  })
}

export const useCloseDailyCash = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: CloseDailyCashRequest }) =>
      dailyCashService.closeDailyCash(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dailyCash'] })
    },
    onError: (error: any) => {
      console.error('Error closing daily cash:', error)
      throw error
    }
  })
}

// Las cajas del usuario logueado: lo que ve el cajero en "Mis cajas"
export const useMyDailyCashHistory = (params: DailyCashListParams = {}, enabled: boolean = true) => {
  return useQuery({
    queryKey: ['dailyCash', 'mine', params],
    queryFn: () => dailyCashService.getMyHistory(params),
    enabled,
    staleTime: 30000
  })
}

export const useDailyCashHistory = (params: DailyCashListParams = {}, enabled: boolean = true) => {
  return useQuery({
    queryKey: ['dailyCash', 'history', params],
    queryFn: () => dailyCashService.getHistory(params),
    enabled,
    staleTime: 30000
  })
}
