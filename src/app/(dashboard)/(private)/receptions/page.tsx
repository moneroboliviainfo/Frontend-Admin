import Grid from '@mui/material/Grid2'
import Typography from '@mui/material/Typography'

import InventoryView from '@/views/Dashboard/receptions/InventoryView'

const ReceptionsPage = () => {
  return (
    <Grid container spacing={6}>
      <Grid size={{ xs: 12 }}>
        <Typography variant='h4' sx={{ paddingLeft: '20px' }}>
          Inventario
        </Typography>
      </Grid>
      <Grid size={{ xs: 12 }}>
        <InventoryView />
      </Grid>
    </Grid>
  )
}

export default ReceptionsPage
