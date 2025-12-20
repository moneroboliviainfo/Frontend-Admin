// Component Imports
import { Typography } from '@mui/material'

import Grid from '@mui/material/Grid2'

import BannerManager from '@views/Dashboard/banners/BannerManager'

const BannersPage = () => {
  return (
    <Grid container spacing={6}>
      <Grid size={{ xs: 12 }}>
        <Typography variant='h4' sx={{ paddingLeft: '20px' }}>
          Banners
        </Typography>
        <Typography sx={{ paddingLeft: '20px' }}>
          Gestiona los videos de banners para cada tipo y género. <code>Tamaño máximo: 3MB, formato: MP4</code>
        </Typography>
      </Grid>
      <Grid size={{ xs: 12 }}>
        <BannerManager />
      </Grid>
    </Grid>
  )
}

export default BannersPage
