import Grid from '@mui/material/Grid2'
import Typography from '@mui/material/Typography'

import ReplenishmentsView from '@/views/Dashboard/replenishments/ReplenishmentsView'

const ReplenishmentsPage = () => {
  return (
    <Grid container spacing={6}>
      <Grid size={{ xs: 12 }}>
        <Typography variant='h4' sx={{ paddingLeft: '20px' }}>
          Reposiciones
        </Typography>
      </Grid>
      <Grid size={{ xs: 12 }}>
        <ReplenishmentsView />
      </Grid>
    </Grid>
  )
}

export default ReplenishmentsPage
