'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { settingsService } from '@/services/settingsService'
import type { UpdateSettingsRequest } from '@/types/api/settings'

// Configuracion del negocio (plazos de pedidos). No confundir con useSettings
// de @core/hooks, que es la del tema visual.
export const useAppSettings = () => {
  return useQuery({
    queryKey: ['app-settings'],
    queryFn: () => settingsService.getSettings(),
    staleTime: 1000 * 60 * 5
  })
}

export const useUpdateAppSettings = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: UpdateSettingsRequest) => settingsService.updateSettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app-settings'] })
    }
  })
}
