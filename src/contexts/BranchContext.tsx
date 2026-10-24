'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'

import { useQuery } from '@tanstack/react-query'

import { apiClient } from '@/libs/axios'
import { useAuthContext } from './AuthContext'
import type { BranchListItem, BranchListResponse } from '@/types/api/auth'

interface BranchContextType {
  branches: BranchListItem[]
  selectedBranch: BranchListItem | null
  selectedBranchId: number | null
  setSelectedBranch: (branch: BranchListItem) => void
  isLoading: boolean
  isAdmin: boolean
  isReady: boolean
  branchesError: boolean
}

const BranchContext = createContext<BranchContextType | null>(null)

// Las de solo facturacion no vienen en GET /branches: se piden aparte. Sin
// esto no se les puede asignar un cajero desde el formulario de usuarios.
export const fetchBillingOnlyBranches = async (): Promise<BranchListItem[]> => {
  const response = await apiClient.get<BranchListResponse>('/api/branches', {
    params: { type: 'billing_only' }
  })

  return response.data.data.filter(b => b.active)
}

const fetchBranches = async (): Promise<BranchListItem[]> => {
  const response = await apiClient.get<BranchListResponse>('/api/branches')

  return response.data.data.filter(b => b.active)
}

export const BranchProvider = ({ children }: { children: ReactNode }) => {
  const { user, isLoading: isAuthLoading } = useAuthContext()

  // isAdmin = no tiene sucursal fija, la elige con ?branchId=
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPERVISOR'

  const [selectedBranch, setSelectedBranchState] = useState<BranchListItem | null>(null)

  const {
    data: branches = [],
    isLoading: isBranchesLoading,
    isError: branchesError,
    isFetched: branchesFetched
  } = useQuery({
    queryKey: ['branches-list'],
    queryFn: fetchBranches,
    enabled: isAdmin && !isAuthLoading,
    staleTime: 1000 * 60 * 30
  })

  useEffect(() => {
    if (isAdmin && branches.length > 0 && !selectedBranch) {
      setSelectedBranchState(branches[0])
    }
  }, [isAdmin, branches, selectedBranch])

  const setSelectedBranch = useCallback((branch: BranchListItem) => {
    setSelectedBranchState(branch)
  }, [])

  const selectedBranchId = isAdmin ? selectedBranch?.id ?? null : null

  const isLoading = isAuthLoading || (isAdmin && isBranchesLoading)

  // Si no hay ninguna sucursal para elegir (fallo la carga o vino vacia) se libera
  // igual: asi las pantallas muestran su error en vez de cargar para siempre
  const hasNoBranchAvailable = branchesFetched && branches.length === 0

  const isReady = !isAuthLoading && (!isAdmin || selectedBranchId !== null || hasNoBranchAvailable)

  return (
    <BranchContext.Provider
      value={{
        branches,
        selectedBranch,
        selectedBranchId,
        setSelectedBranch,
        isLoading,
        isAdmin,
        isReady,
        branchesError
      }}
    >
      {children}
    </BranchContext.Provider>
  )
}

export const useBranchContext = () => {
  const context = useContext(BranchContext)

  if (!context) {
    throw new Error('useBranchContext must be used within BranchProvider')
  }

  return context
}
