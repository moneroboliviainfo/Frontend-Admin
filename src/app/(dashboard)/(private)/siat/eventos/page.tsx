// MUI Imports
import Grid from '@mui/material/Grid2'
import { Typography } from '@mui/material'

// Component Imports
import EventosList from '@views/Dashboard/siat/eventos/EventosList'

const EventosPage = () => {
  return (
    <Grid container spacing={6}>
      <Grid size={{ xs: 12 }}>
        <Typography variant='h4' sx={{ paddingLeft: '20px' }}>
          Eventos Significativos
        </Typography>
        <Typography sx={{ paddingLeft: '20px' }}>
          <code>Registra eventos</code> para justificar la facturación por contingencia.
        </Typography>
      </Grid>
      <Grid size={{ xs: 12 }}>
        <EventosList />
      </Grid>
    </Grid>
  )
}

export default EventosPage
