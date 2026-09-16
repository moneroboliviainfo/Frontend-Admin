import { apiClient } from '@/libs/axios'
import type {
  StaffUser,
  CreateAdminDto,
  CreateStaffDto,
  UpdateUserDto,
  ChangeMyPasswordDto,
  UsersParams,
  UsersApiResponse,
  UsersResponse
} from '@/types/api/staffUser'

class UserServiceClass {
  async getUsers(params: UsersParams = {}): Promise<UsersResponse> {
    const { limit = 10, page = 1 } = params

    // TODO: agregar `search` cuando el backend lo soporte en GET /users
    const searchParams = new URLSearchParams({
      limit: limit.toString(),
      page: page.toString()
    })

    const response = await apiClient.get<UsersApiResponse>(`/api/users?${searchParams.toString()}`)

    return {
      users: response.data.data,
      total: response.data.meta.total,
      page: response.data.meta.page,
      limit: response.data.meta.limit
    }
  }

  async getUserById(id: number): Promise<StaffUser> {
    const response = await apiClient.get<StaffUser>(`/api/users/${id}`)

    return response.data
  }

  async createAdmin(data: CreateAdminDto): Promise<StaffUser> {
    const response = await apiClient.post<StaffUser>('/api/users/admin', data)

    return response.data
  }

  async createStaff(data: CreateStaffDto): Promise<StaffUser> {
    const response = await apiClient.post<StaffUser>('/api/users/staff', data)

    return response.data
  }

  async updateUser(id: number, data: UpdateUserDto): Promise<StaffUser> {
    const response = await apiClient.patch<StaffUser>(`/api/users/${id}`, data)

    return response.data
  }

  async changeMyPassword(data: ChangeMyPasswordDto): Promise<void> {
    await apiClient.patch('/api/users/me/password', data)
  }
}

export const userService = new UserServiceClass()
