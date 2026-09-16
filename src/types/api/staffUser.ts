import type { BackendRole } from './auth'

export interface StaffUserBranch {
  id: number
  name: string
}

export interface StaffUser {
  id: number
  name: string
  email: string
  rol: BackendRole
  enabled: boolean

  // Ausente en GET /users (lista); presente (o null) en GET /users/:id
  branch?: StaffUserBranch | null
  sessionId: string | null
  createdAt?: string
}

export interface CreateAdminDto {
  name: string
  email: string
  password: string
}

export interface CreateStaffDto {
  name: string
  email: string
  password: string
  rol: 'manager' | 'cashier'
  branchId: number
}

export interface UpdateUserDto {
  name?: string
  email?: string
  password?: string
  branchId?: number
  enabled?: boolean
}

export interface ChangeMyPasswordDto {
  currentPassword: string
  newPassword: string
}

export interface UsersParams {
  limit?: number
  page?: number
}

export interface UsersApiResponse {
  data: StaffUser[]
  meta: {
    total: number
    page: number
    lastPage: number
    limit: number
    offset: number
    hasNextPage: boolean
    hasPreviousPage: boolean
  }
}

export interface UsersResponse {
  users: StaffUser[]
  total: number
  page: number
  limit: number
}
