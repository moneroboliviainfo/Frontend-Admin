import Grid from '@mui/material/Grid2'
import Typography from '@mui/material/Typography'

import BranchRequestsView from '@/views/Dashboard/branch-requests/BranchRequestsView'

const BranchRequestsPage = () => {
  return (
    <Grid container spacing={6}>
      <Grid size={{ xs: 12 }}>
        <Typography variant='h4' sx={{ paddingLeft: '20px' }}>
          Pedidos entre sucursales
        </Typography>
      </Grid>
      <Grid size={{ xs: 12 }}>
        <BranchRequestsView />
      </Grid>
    </Grid>
  )
}

export default BranchRequestsPage
