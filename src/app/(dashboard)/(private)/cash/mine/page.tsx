import Grid from '@mui/material/Grid2'
import Typography from '@mui/material/Typography'

import DailyCashHistoryTable from '@/views/Dashboard/cash/DailyCashHistoryTable'

// Las cajas del usuario logueado (MANAGER/CASHIER). Es la misma tabla que
// /cash, pero pidiendo GET /dailyCash/mine en vez del historial de la sucursal.
const MyCashPage = () => {
  return (
    <Grid container spacing={6}>
      <Grid size={{ xs: 12 }}>
        <Typography variant='h4' sx={{ paddingLeft: '20px' }}>
          Mis cajas
        </Typography>
      </Grid>
      <Grid size={{ xs: 12 }}>
        <DailyCashHistoryTable scope='mine' />
      </Grid>
    </Grid>
  )
}

export default MyCashPage
