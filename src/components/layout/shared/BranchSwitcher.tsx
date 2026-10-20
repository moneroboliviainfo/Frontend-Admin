'use client'

import { usePathname } from 'next/navigation'

import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import MenuItem from '@mui/material/MenuItem'
import Skeleton from '@mui/material/Skeleton'

import CustomTextField from '@core/components/mui/TextField'
import { useBranchContext } from '@/contexts/BranchContext'
import { isBranchScoped } from '@/utils/branchScope'

const BranchSwitcher = () => {
  const { branches, selectedBranch, setSelectedBranch, isLoading, isAdmin, branchesError } = useBranchContext()
  const pathname = usePathname()

  if (!isAdmin) return null

  // En una vista general el selector no cambia nada de lo que se ve: mostrarlo
  // hace creer que sí. Misma lista que decide el color del tema.
  if (!isBranchScoped(pathname)) return null

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

  return (
    <Box className='flex items-center gap-3'>
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

      {/* El nombre repetido en grande: el color del tema ya cambió, pero el
          cajero necesita leer sobre qué sucursal está actuando. */}
      <Typography variant='h5' color='primary.main' className='font-medium max-sm:hidden'>
        {selectedBranch?.name}
      </Typography>
    </Box>
  )
}

export default BranchSwitcher
