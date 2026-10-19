import Grid from '@mui/material/Grid2'
import Typography from '@mui/material/Typography'

import DailyCashHistoryTable from '@/views/Dashboard/cash/DailyCashHistoryTable'

const CashPage = () => {
  return (
    <Grid container spacing={6}>
      <Grid size={{ xs: 12 }}>
        <Typography variant='h4' sx={{ paddingLeft: '20px' }}>
          Caja
        </Typography>
      </Grid>
      <Grid size={{ xs: 12 }}>
        <DailyCashHistoryTable />
      </Grid>
    </Grid>
  )
}

export default CashPage
