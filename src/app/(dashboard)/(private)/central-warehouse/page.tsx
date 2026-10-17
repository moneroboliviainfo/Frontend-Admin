import Grid from '@mui/material/Grid2'
import Typography from '@mui/material/Typography'

import CentralWarehouseView from '@/views/Dashboard/central-warehouse/CentralWarehouseView'

const CentralWarehousePage = () => {
  return (
    <Grid container spacing={6}>
      <Grid size={{ xs: 12 }}>
        <Typography variant='h4' sx={{ paddingLeft: '20px' }}>
          Bodega Central
        </Typography>
      </Grid>
      <Grid size={{ xs: 12 }}>
        <CentralWarehouseView />
      </Grid>
    </Grid>
  )
}

export default CentralWarehousePage
