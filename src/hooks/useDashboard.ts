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

// branchId explicito para pantallas que no miran la sucursal de la navbar (la bodega central)
export const useLowStock = (branchId?: number, enabled: boolean = true) => {
  const { selectedBranchId, isReady } = useBranchContext()

  const targetBranchId = branchId ?? selectedBranchId

  return useQuery({
    queryKey: ['dashboard', 'lowStock', targetBranchId],
    queryFn: () => dashboardService.getLowStock(targetBranchId),
    enabled: isReady && enabled
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
