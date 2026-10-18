import { apiClient } from '@/libs/axios'
import type { Settings, UpdateSettingsRequest } from '@/types/api/settings'

class SettingsServiceClass {
  // Lo leen los cuatro roles; solo ADMIN/SUPERVISOR lo editan
  async getSettings(): Promise<Settings> {
    const response = await apiClient.get<Settings>('/api/settings')

    return response.data
  }

  async updateSettings(data: UpdateSettingsRequest): Promise<Settings> {
    const response = await apiClient.patch<Settings>('/api/settings', data)

    return response.data
  }
}

export const settingsService = new SettingsServiceClass()
