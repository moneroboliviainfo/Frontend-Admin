import { apiClient } from '@/libs/axios'
import type { Banner, UpdateBannerPayload } from '@/types/api/banner'

class BannerServiceClass {
  async getBanners(): Promise<Banner[]> {
    const response = await apiClient.get<Banner[]>('/api/banners')

    return response.data
  }

  async getBannerById(id: number): Promise<Banner> {
    const response = await apiClient.get<Banner>(`/api/banners/${id}`)

    return response.data
  }

  async updateBanner(id: number, data: UpdateBannerPayload): Promise<Banner> {
    const response = await apiClient.patch<Banner>(`/api/banners/${id}`, data)

    return response.data
  }

  async uploadVideo(file: File): Promise<{ url: string }> {
    const formData = new FormData()

    formData.append('files', file)

    const response = await apiClient.post<string[]>('/api/multimedia', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })

    return { url: response.data[0] }
  }

  async deleteMultimedia(urls: string[]): Promise<void> {
    await apiClient.delete('/api/multimedia', {
      data: urls
    })
  }
}

export const bannerService = new BannerServiceClass()
