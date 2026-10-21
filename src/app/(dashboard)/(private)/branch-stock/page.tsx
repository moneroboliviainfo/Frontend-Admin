import Grid from '@mui/material/Grid2'
import Typography from '@mui/material/Typography'

import BranchStockAdminTable from '@/views/Dashboard/branch-stock/BranchStockAdminTable'

const BranchStockPage = () => {
  return (
    <Grid container spacing={6}>
      <Grid size={{ xs: 12 }}>
        <Typography variant='h4' sx={{ paddingLeft: '20px' }}>
          Stock de sucursales
        </Typography>
      </Grid>
      <Grid size={{ xs: 12 }}>
        <BranchStockAdminTable />
      </Grid>
    </Grid>
  )
}

export default BranchStockPage
