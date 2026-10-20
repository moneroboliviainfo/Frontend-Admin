'use client'

import Typography from '@mui/material/Typography'
import MenuItem from '@mui/material/MenuItem'
import Skeleton from '@mui/material/Skeleton'

import CustomTextField from '@core/components/mui/TextField'
import { useBranchContext } from '@/contexts/BranchContext'
import { useBranchScope } from '@/contexts/BranchScopeContext'

const BranchSwitcher = () => {
  const { branches, selectedBranch, setSelectedBranch, isLoading, isAdmin, branchesError } = useBranchContext()
  const branchScoped = useBranchScope()

  if (!isAdmin) return null

  // En una vista general el selector no cambia nada de lo que se ve: mostrarlo
  // hace creer que sí. Misma lista que decide el color del tema.
  if (!branchScoped) return null

  if (isLoading) {
    return <Skeleton variant='rounded' width={220} height={34} />
  }

  if (branchesError || branches.length === 0) {
    return (
      <Typography variant='body2' color='error' className='max-sm:hidden'>
        {branchesError ? 'No se pudieron cargar las sucursales' : 'Sin sucursales disponibles'}
      </Typography>
    )
  }

  const handleChange = (value: string) => {
    const branch = branches.find(b => b.id === Number(value))

    if (branch) setSelectedBranch(branch)
  }

  // El nombre de la sucursal no se muestra acá: va en BranchIndicator, al
  // centro de la navbar. Este componente solo cambia de sucursal.
  return (
    <CustomTextField
      select
      size='small'
      value={selectedBranch?.id ?? branches[0]?.id ?? ''}
      onChange={e => handleChange(e.target.value)}
      aria-label='Selector de sucursal'
      sx={{ inlineSize: 150 }}
    >
      {branches.map(branch => (
        <MenuItem key={branch.id} value={branch.id}>
          {branch.name}
        </MenuItem>
      ))}
    </CustomTextField>
  )
}

export default BranchSwitcher
