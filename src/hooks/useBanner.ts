'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

import { bannerService } from '@/services/bannerService'
import type { UpdateBannerPayload } from '@/types/api/banner'

export const useBanners = () => {
  return useQuery({
    queryKey: ['banners'],
    queryFn: () => bannerService.getBanners(),
    staleTime: 5 * 60 * 1000
  })
}

export const useBanner = (id: number, enabled: boolean = true) => {
  return useQuery({
    queryKey: ['banner', id],
    queryFn: () => bannerService.getBannerById(id),
    enabled,
    staleTime: 5 * 60 * 1000
  })
}

export const useUpdateBanner = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateBannerPayload }) =>
      bannerService.updateBanner(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['banners'] })
    }
  })
}
