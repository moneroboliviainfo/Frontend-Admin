import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { branchService } from '@/services/branchService'
import type { CreateBranchDto, UpdateBranchDto, BranchesParams } from '@/types/api/branch'

export const useBranchesAdmin = (params: BranchesParams = {}) => {
  return useQuery({
    queryKey: ['branches-admin', params],
    queryFn: () => branchService.getBranches(params),
    placeholderData: previousData => previousData,
    staleTime: 30000
  })
}

export const useBranchAdmin = (id: number | null) => {
  return useQuery({
    queryKey: ['branch-admin', id],
    queryFn: () => branchService.getBranchById(id!),
    enabled: id !== null
  })
}

export const useCreateBranch = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateBranchDto) => branchService.createBranch(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches-admin'] })
      queryClient.invalidateQueries({ queryKey: ['branches-list'] })
    }
  })
}

export const useUpdateBranch = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateBranchDto }) => branchService.updateBranch(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches-admin'] })
      queryClient.invalidateQueries({ queryKey: ['branches-list'] })
    }
  })
}
