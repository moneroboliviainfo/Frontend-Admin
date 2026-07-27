// MUI Imports
import Grid from '@mui/material/Grid2'
import { Typography } from '@mui/material'

// Component Imports
import CafcList from '@views/Dashboard/siat/cafc/CafcList'

const CafcPage = () => {
  return (
    <Grid container spacing={6}>
      <Grid size={{ xs: 12 }}>
        <Typography variant='h4' sx={{ paddingLeft: '20px' }}>
          Códigos CAFC
        </Typography>
        <Typography sx={{ paddingLeft: '20px' }}>
          <code>Gestiona códigos</code> de autorización para facturación por contingencia.
        </Typography>
      </Grid>
      <Grid size={{ xs: 12 }}>
        <CafcList />
      </Grid>
    </Grid>
  )
}

export default CafcPage
