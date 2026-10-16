'use client'

// MUI Imports
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Box from '@mui/material/Box'
import Grid from '@mui/material/Grid2'

import { useUserRole } from '@/hooks/useUserRole'
import { useBranchContext } from '@/contexts/BranchContext'

const roleLabels: Record<string, string> = {
  ADMIN: 'Administrador',
  SUPERVISOR: 'Supervisor',
  MANAGER: 'Encargado',
  CASHIER: 'Cajero'
}

const BienvenidaAdmin = () => {
  const { user, role, isManager } = useUserRole()
  const { selectedBranch, isAdmin } = useBranchContext()

  const branchName = isAdmin ? selectedBranch?.name : user?.branch?.name

  return (
    <Card>
      <Grid container>
        <Grid size={{ xs: 8 }}>
          <CardContent>
            <Typography variant='h5' className='mbe-0.5'>
              ¡Bienvenido de nuevo{user?.name ? `, ${user.name}` : ''}! 👋
            </Typography>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, mt: 1 }}>
              {branchName && (
                <Chip label={branchName} color='primary' sx={{ fontWeight: 'bold', fontSize: '0.9rem' }} />
              )}
              {role && <Chip label={roleLabels[role]} color='secondary' variant='outlined' size='small' />}
            </Box>

            <Typography variant='subtitle1' className='mbe-2'>
              Panel de Administración
            </Typography>
            <Typography variant='body2' color='text.secondary' className='mbe-3'>
              Gestiona tu tienda y supervisa todas las operaciones desde aquí
            </Typography>
            {isManager && (
              <Button variant='contained' color='primary' href='/sales/instore'>
                Venta en Tienda
              </Button>
            )}
          </CardContent>
        </Grid>
        <Grid size={{ xs: 4 }}>
          <div className='relative bs-full is-full'>
            <img
              alt='Bienvenida Administrador'
              src='/images/apps/ecommerce/img.png'
              className='max-bs-[150px] absolute block-end-5 inline-end-6 max-is-full'
            />
          </div>
        </Grid>
      </Grid>
    </Card>
  )
}

export default BienvenidaAdmin
