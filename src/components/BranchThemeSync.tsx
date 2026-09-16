'use client'

import { useEffect } from 'react'

import { useBranchContext } from '@/contexts/BranchContext'
import { useSettings } from '@core/hooks/useSettings'
import { getBranchColor } from '@/utils/branchColor'

// Sincroniza el color primario del tema con la sucursal seleccionada (solo ADMIN).
// Vive dentro de Providers, debajo de BranchProvider y SettingsProvider a la vez,
// porque ninguno de esos dos contextos puede leer al otro directamente.
const BranchThemeSync = () => {
  const { branches, selectedBranch, isAdmin } = useBranchContext()
  const { updateSettings } = useSettings()

  useEffect(() => {
    if (isAdmin && selectedBranch) {
      const branchIndex = branches.findIndex(b => b.id === selectedBranch.id)

      updateSettings({ primaryColor: getBranchColor(branchIndex === -1 ? 0 : branchIndex) })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBranch, branches, isAdmin])

  return null
}

export default BranchThemeSync
