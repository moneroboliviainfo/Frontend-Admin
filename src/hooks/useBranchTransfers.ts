'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { branchTransferService } from '@/services/branchTransferService'
import type {
  BranchTransferListParams,
  CancelTransferRequest,
  CentralDispatchRequest,
  MarkLostTransferRequest,
  ReceiveTransferRequest,
  ReviewTransferRequest
} from '@/types/api/branchTransfer'

export const useCentralWarehouse = (enabled: boolean = true) => {
  return useQuery({
    queryKey: ['central-warehouse'],
    queryFn: () => branchTransferService.getCentralWarehouse(),
    staleTime: 1000 * 60 * 30,
    enabled
  })
}

export const useBranchTransfers = (params: BranchTransferListParams = {}, enabled: boolean = true) => {
  return useQuery({
    queryKey: ['branch-transfers', params],
    queryFn: () => branchTransferService.getTransfers(params),
    staleTime: 30000,
    enabled
  })
}

export const useBranchTransfer = (transferId: number | null) => {
  return useQuery({
    queryKey: ['branch-transfer', transferId],
    queryFn: () => branchTransferService.getTransfer(transferId!),
    enabled: !!transferId
  })
}

// Sin websockets: el badge se refresca solo cada 30s
export const usePendingCount = (branchId?: number, enabled: boolean = true) => {
  return useQuery({
    queryKey: ['branch-transfers', 'pending-count', branchId],
    queryFn: () => branchTransferService.getPendingCount(branchId),
    refetchInterval: 30000,
    enabled
  })
}

export const useCentralDispatch = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CentralDispatchRequest) => branchTransferService.centralDispatch(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branch-transfers'] })
      queryClient.invalidateQueries({ queryKey: ['variants'] })
    }
  })
}

export const useReceiveTransfer = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ transferId, data }: { transferId: number; data: ReceiveTransferRequest }) =>
      branchTransferService.receive(transferId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branch-transfers'] })
      queryClient.invalidateQueries({ queryKey: ['variants'] })
    }
  })
}

export const useCancelTransfer = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ transferId, data }: { transferId: number; data?: CancelTransferRequest }) =>
      branchTransferService.cancel(transferId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branch-transfers'] })
      queryClient.invalidateQueries({ queryKey: ['variants'] })
    }
  })
}

export const useMarkLostTransfer = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ transferId, data }: { transferId: number; data: MarkLostTransferRequest }) =>
      branchTransferService.markLost(transferId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branch-transfers'] })
    }
  })
}

export const useReviewTransfer = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ transferId, data }: { transferId: number; data: ReviewTransferRequest }) =>
      branchTransferService.review(transferId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branch-transfers'] })
      queryClient.invalidateQueries({ queryKey: ['variants'] })
    }
  })
}

export const useRenameCentralWarehouse = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (name: string) => branchTransferService.renameCentralWarehouse(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['central-warehouse'] })
    }
  })
}
