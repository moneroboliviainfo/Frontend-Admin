import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

import { dailyCashService } from '@/services/dailyCashService'
import type { CreateDailyCashRequest } from '@/types/api/dailyCash'

export const useDailyCash = () => {
  return useQuery({
    queryKey: ['dailyCash'],
    queryFn: () => dailyCashService.getDailyCash(),
    retry: false, // No reintentar si falla
    refetchOnWindowFocus: false
  })
}

export const useCreateDailyCash = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateDailyCashRequest) => dailyCashService.createDailyCash(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dailyCash'] })
    },
    onError: (error: any) => {
      console.error('Error creating daily cash:', error)
      throw error
    }
  })
}
