import Grid from '@mui/material/Grid2'
import Typography from '@mui/material/Typography'

import BranchRequestSettings from '@/views/Dashboard/settings/BranchRequestSettings'

const SettingsPage = () => {
  return (
    <Grid container spacing={6}>
      <Grid size={{ xs: 12 }}>
        <Typography variant='h4' sx={{ paddingLeft: '20px' }}>
          Configuración
        </Typography>
      </Grid>
      <Grid size={{ xs: 12 }}>
        <BranchRequestSettings />
      </Grid>
    </Grid>
  )
}

export default SettingsPage
