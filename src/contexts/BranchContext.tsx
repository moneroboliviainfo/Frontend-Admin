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
}

const BranchContext = createContext<BranchContextType | null>(null)

const fetchBranches = async (): Promise<BranchListItem[]> => {
  const response = await apiClient.get<BranchListResponse>('/api/branches')

  return response.data.data.filter(b => b.active)
}

export const BranchProvider = ({ children }: { children: ReactNode }) => {
  const { user, isLoading: isAuthLoading } = useAuthContext()
  const isAdmin = user?.role === 'ADMIN'

  const [selectedBranch, setSelectedBranchState] = useState<BranchListItem | null>(null)

  const { data: branches = [], isLoading: isBranchesLoading } = useQuery({
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

  // isReady: true cuando podemos hacer peticiones con branchId correcto
  const isReady = !isAuthLoading && (!isAdmin || selectedBranchId !== null)

  return (
    <BranchContext.Provider
      value={{
        branches,
        selectedBranch,
        selectedBranchId,
        setSelectedBranch,
        isLoading,
        isAdmin,
        isReady
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
