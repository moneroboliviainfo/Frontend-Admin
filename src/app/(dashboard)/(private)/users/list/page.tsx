import Grid from '@mui/material/Grid2'
import Typography from '@mui/material/Typography'

import UserListTable from '@views/Dashboard/users/list/UserListTable'

const UsersPage = () => {
  return (
    <Grid container spacing={6}>
      <Grid size={{ xs: 12 }}>
        <Typography variant='h4' sx={{ paddingLeft: '20px' }}>
          Usuarios
        </Typography>
        <Typography sx={{ paddingLeft: '20px' }}>
          Gestioná el personal (Administradores, Encargados y Cajeros) y su sucursal asignada.
        </Typography>
      </Grid>
      <Grid size={{ xs: 12 }}>
        <UserListTable />
      </Grid>
    </Grid>
  )
}

export default UsersPage
