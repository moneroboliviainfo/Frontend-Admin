import Grid from '@mui/material/Grid2'
import Typography from '@mui/material/Typography'

import BranchListTable from '@views/Dashboard/branches/list/BranchListTable'

const BranchesPage = () => {
  return (
    <Grid container spacing={6}>
      <Grid size={{ xs: 12 }}>
        <Typography variant='h4' sx={{ paddingLeft: '20px' }}>
          Sucursales
        </Typography>
        <Typography sx={{ paddingLeft: '20px' }}>
          Gestioná las sucursales y sus datos de facturación SIAT.
        </Typography>
      </Grid>
      <Grid size={{ xs: 12 }}>
        <BranchListTable />
      </Grid>
    </Grid>
  )
}

export default BranchesPage
