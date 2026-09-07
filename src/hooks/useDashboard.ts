'use client'

import { useQuery } from '@tanstack/react-query'

import { dashboardService } from '@/services/dashboardService'
import { useBranchContext } from '@/contexts/BranchContext'

export const useBestsellers = () => {
  const { selectedBranchId, isReady } = useBranchContext()

  return useQuery({
    queryKey: ['dashboard', 'bestsellers', selectedBranchId],
    queryFn: () => dashboardService.getBestsellers(selectedBranchId),
    enabled: isReady
  })
}

export const useLowStock = () => {
  const { selectedBranchId, isReady } = useBranchContext()

  return useQuery({
    queryKey: ['dashboard', 'lowStock', selectedBranchId],
    queryFn: () => dashboardService.getLowStock(selectedBranchId),
    enabled: isReady
  })
}

export const useDashboardOrdersCount = () => {
  const { selectedBranchId, isReady } = useBranchContext()

  return useQuery({
    queryKey: ['dashboard', 'ordersCount', selectedBranchId],
    queryFn: () => dashboardService.getOrdersCount(selectedBranchId),
    enabled: isReady
  })
}

// Estos no requieren branchId
export const useDashboardCustomersCount = () => {
  return useQuery({
    queryKey: ['dashboard', 'customersCount'],
    queryFn: () => dashboardService.getCustomersCount()
  })
}

export const useDashboardProductsCount = () => {
  return useQuery({
    queryKey: ['dashboard', 'productsCount'],
    queryFn: () => dashboardService.getProductsCount()
  })
}
