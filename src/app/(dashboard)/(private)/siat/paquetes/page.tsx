// MUI Imports
import Grid from '@mui/material/Grid2'
import { Typography } from '@mui/material'

// Component Imports
import PaquetesList from '@views/Dashboard/siat/paquetes/PaquetesList'

const PaquetesPage = () => {
  return (
    <Grid container spacing={6}>
      <Grid size={{ xs: 12 }}>
        <Typography variant='h4' sx={{ paddingLeft: '20px' }}>
          Paquetes de Contingencia
        </Typography>
        <Typography sx={{ paddingLeft: '20px' }}>
          <code>Crea y envía paquetes</code> con facturas pendientes al SIAT.
        </Typography>
      </Grid>
      <Grid size={{ xs: 12 }}>
        <PaquetesList />
      </Grid>
    </Grid>
  )
}

export default PaquetesPage
