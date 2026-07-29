// MUI Imports
import Grid from '@mui/material/Grid2'
import { Typography } from '@mui/material'

// Component Imports
import FacturacionList from '@views/Dashboard/siat/facturacion/FacturacionList'

const FacturacionPage = () => {
  return (
    <Grid container spacing={6}>
      <Grid size={{ xs: 12 }}>
        <Typography variant='h4' sx={{ paddingLeft: '20px' }}>
          Facturación Online
        </Typography>
        <Typography sx={{ paddingLeft: '20px' }}>
          <code>Emita facturas</code> para otras sucursales desde aquí.
        </Typography>
      </Grid>
      <Grid size={{ xs: 12 }}>
        <FacturacionList />
      </Grid>
    </Grid>
  )
}

export default FacturacionPage
