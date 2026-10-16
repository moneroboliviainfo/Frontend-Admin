'use client'

import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Skeleton from '@mui/material/Skeleton'

import { useBranchContext } from '@/contexts/BranchContext'

const BranchSwitcher = () => {
  const { branches, selectedBranch, setSelectedBranch, isLoading, isAdmin, branchesError } = useBranchContext()

  if (!isAdmin) return null

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

  const handleChange = (_: React.MouseEvent<HTMLElement>, newValue: number | null) => {
    if (newValue === null) return

    const branch = branches.find(b => b.id === newValue)

    if (branch) setSelectedBranch(branch)
  }

  return (
    <Box className='flex items-center gap-2'>
      <Typography variant='body2' color='text.secondary' className='max-sm:hidden'>
        Sucursal:
      </Typography>
      <ToggleButtonGroup
        value={selectedBranch?.id ?? branches[0]?.id}
        exclusive
        size='small'
        onChange={handleChange}
        aria-label='Selector de sucursal'
        sx={{
          '& .MuiToggleButton-root': {
            paddingBlock: '4px',
            paddingInline: '10px',
            textTransform: 'none',
            fontWeight: 500,
            lineHeight: 1.3,
            '&.Mui-selected': {
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              '&:hover': {
                bgcolor: 'primary.dark'
              }
            }
          }
        }}
      >
        {branches.map(branch => (
          <ToggleButton key={branch.id} value={branch.id}>
            {branch.name}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </Box>
  )
}

export default BranchSwitcher
