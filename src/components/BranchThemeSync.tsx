'use client'

import { useEffect } from 'react'

import { useBranchContext } from '@/contexts/BranchContext'
import { useSettings } from '@core/hooks/useSettings'
import { getBranchColor, GENERAL_COLOR } from '@/utils/branchColor'
import { useBranchScope } from '@/contexts/BranchScopeContext'

// Sincroniza el color primario del tema con la sucursal seleccionada (solo ADMIN).
// Vive dentro de Providers, debajo de BranchProvider y SettingsProvider a la vez,
// porque ninguno de esos dos contextos puede leer al otro directamente.
const BranchThemeSync = () => {
  const { branches, selectedBranch, isAdmin } = useBranchContext()
  const { updateSettings } = useSettings()
  const branchScoped = useBranchScope()

  useEffect(() => {
    if (!isAdmin) return

    // Vista general: azul fijo. Sin tocar la cookie, para no perder cuál era la
    // sucursal elegida al volver a una vista que sí depende de ella.
    if (!branchScoped) {
      updateSettings({ primaryColor: GENERAL_COLOR }, { updateCookie: false })

      return
    }

    if (!selectedBranch) return

    const branchIndex = branches.findIndex(b => b.id === selectedBranch.id)

    updateSettings({ primaryColor: getBranchColor(branchIndex === -1 ? 0 : branchIndex) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBranch, branches, isAdmin, branchScoped])

  return null
}

export default BranchThemeSync
