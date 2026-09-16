import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { userService } from '@/services/userService'
import type { CreateAdminDto, CreateStaffDto, UpdateUserDto, ChangeMyPasswordDto, UsersParams } from '@/types/api/staffUser'

export const useUsers = (params: UsersParams = {}) => {
  return useQuery({
    queryKey: ['users', params],
    queryFn: () => userService.getUsers(params),
    placeholderData: previousData => previousData,
    staleTime: 30000
  })
}

export const useUser = (id: number | null) => {
  return useQuery({
    queryKey: ['user', id],
    queryFn: () => userService.getUserById(id!),
    enabled: id !== null
  })
}

export const useCreateAdmin = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateAdminDto) => userService.createAdmin(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
    }
  })
}

export const useCreateStaff = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateStaffDto) => userService.createStaff(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
    }
  })
}

export const useUpdateUser = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateUserDto }) => userService.updateUser(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
    }
  })
}

export const useChangeMyPassword = () => {
  return useMutation({
    mutationFn: (data: ChangeMyPasswordDto) => userService.changeMyPassword(data)
  })
}
