'use client'

import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Skeleton from '@mui/material/Skeleton'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

import { useBranchContext } from '@/contexts/BranchContext'

const BranchTabs = () => {
  const { branches, selectedBranch, setSelectedBranch, isLoading, isAdmin } = useBranchContext()

  if (!isAdmin) return null

  if (isLoading) {
    return (
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'center', gap: 2 }}>
        {[1, 2, 3].map(i => (
          <Skeleton key={i} variant='rounded' width={120} height={42} />
        ))}
      </Box>
    )
  }

  if (branches.length === 0) return null

  const handleChange = (_: React.MouseEvent<HTMLElement>, newValue: number | null) => {
    if (newValue === null) return

    const branch = branches.find(b => b.id === newValue)

    if (branch) {
      setSelectedBranch(branch)
    }
  }

  return (
    <Box sx={{ mb: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
      <Typography variant='body2' color='text.secondary'>
        Sucursal
      </Typography>
      <ToggleButtonGroup
        value={selectedBranch?.id ?? branches[0]?.id}
        exclusive
        onChange={handleChange}
        aria-label='Selector de sucursal'
        sx={{
          '& .MuiToggleButton-root': {
            px: 3,
            py: 1,
            textTransform: 'none',
            fontWeight: 500,
            borderRadius: '8px !important',
            border: '1px solid',
            borderColor: 'divider',
            mx: 0.5,
            '&.Mui-selected': {
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              borderColor: 'primary.main',
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

export default BranchTabs
