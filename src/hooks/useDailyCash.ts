import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

import { dailyCashService } from '@/services/dailyCashService'
import type { OpenDailyCashRequest, CloseDailyCashRequest } from '@/types/api/dailyCash'

export const useDailyCash = () => {
  return useQuery({
    queryKey: ['dailyCash'],
    queryFn: () => dailyCashService.getCurrentDailyCash(),
    retry: false, // No reintentar si falla
    refetchOnWindowFocus: false
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
