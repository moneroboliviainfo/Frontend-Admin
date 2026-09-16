// MUI Imports
import Grid from '@mui/material/Grid2'

// Components Imports
import CongratulationsJohn from '@views/Dashboard/ecommerce/Congratulations'
import StatisticsCard from '@views/Dashboard/ecommerce/StatisticsCard'
import LowStock from '@/views/Dashboard/ecommerce/LowStock'
import BestSellers from '@/views/Dashboard/ecommerce/BestSellers'

const EcommerceDashboard = () => {
  return (
    <>
      <Grid container spacing={6}>
        <Grid size={{ xs: 12, md: 4 }}>
          <CongratulationsJohn />
        </Grid>
        <Grid size={{ xs: 12, md: 8 }}>
          <StatisticsCard />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <LowStock />
        </Grid>
        <Grid size={{ xs: 12, md: 8 }}>
          <BestSellers />
        </Grid>
      </Grid>
    </>
  )
}

export default EcommerceDashboard
