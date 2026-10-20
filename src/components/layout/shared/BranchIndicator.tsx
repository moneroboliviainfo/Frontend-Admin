'use client'

import Chip from '@mui/material/Chip'

import { useBranchContext } from '@/contexts/BranchContext'
import { useBranchScope } from '@/contexts/BranchScopeContext'

// El nombre de la sucursal sobre la que se está actuando, al centro de la
// navbar y en su color. Es solo lectura: para cambiarla está BranchSwitcher.
const BranchIndicator = () => {
  const { selectedBranch, isAdmin } = useBranchContext()
  const branchScoped = useBranchScope()

  if (!isAdmin || !selectedBranch) return null

  // Misma regla que el selector y el color del tema: en una vista general no
  // hay sucursal sobre la que se esté actuando.
  if (!branchScoped) return null

  return (
    <Chip
      label={selectedBranch.name}
      color='primary'
      variant='tonal'
      className='max-sm:hidden'
      sx={{
        blockSize: 38,
        fontSize: '1.125rem',

        // Mayúsculas y negrita: es el dato que hay que leer de un vistazo. El
        // espaciado acompaña a las mayúsculas, que sin él se apelmazan.
        fontWeight: 800,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        '& .MuiChip-label': { paddingInline: 4 }
      }}
    />
  )
}

export default BranchIndicator
