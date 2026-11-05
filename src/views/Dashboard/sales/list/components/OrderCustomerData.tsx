'use client'

// Datos de facturacion cargados en la orden.
//
// Solo lectura: recibe la orden y la dibuja. Se extrajo de SaleDetailsModal tal
// cual estaba, sin tocar condiciones ni formato.

import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Grid from '@mui/material/Grid2'
import Typography from '@mui/material/Typography'

import type { Order } from '@/types/api/sales'

const OrderCustomerData = ({ order }: { order: Order }) => {
  // El padre ya lo envuelve en {order.billing && ...}; esto lo hace valido por
  // si solo y le da a TypeScript la certeza de que billing existe
  if (!order.billing) return null

  return (
    <Card variant='outlined'>
      <CardContent>
        <Typography variant='h6' className='mb-4 text-textPrimary'>
          Datos del Cliente
        </Typography>
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Typography variant='overline' className='text-textSecondary text-xs font-medium block'>
              CI / NIT
            </Typography>
            <Typography variant='body1' className='font-semibold mt-1'>
              {order.billing.ci}
            </Typography>
          </Grid>
          {order.billing.name && (
            <Grid size={{ xs: 12, sm: 6 }}>
              <Typography variant='overline' className='text-textSecondary text-xs font-medium block'>
                Nombre
              </Typography>
              <Typography variant='body1' className='font-semibold mt-1'>
                {order.billing.name}
              </Typography>
            </Grid>
          )}
          {order.billing.phone && (
            <Grid size={{ xs: 12, sm: 6 }}>
              <Typography variant='overline' className='text-textSecondary text-xs font-medium block'>
                Teléfono
              </Typography>
              <Typography variant='body1' className='font-medium mt-1'>
                {order.billing.phone}
              </Typography>
            </Grid>
          )}
          {order.billing.email && (
            <Grid size={{ xs: 12, sm: 6 }}>
              <Typography variant='overline' className='text-textSecondary text-xs font-medium block'>
                Email
              </Typography>
              <Typography variant='body1' className='font-medium mt-1'>
                {order.billing.email}
              </Typography>
            </Grid>
          )}
          {order.billing.complemento && (
            <Grid size={{ xs: 12, sm: 6 }}>
              <Typography variant='overline' className='text-textSecondary text-xs font-medium block'>
                Complemento
              </Typography>
              <Typography variant='body1' className='font-medium mt-1'>
                {order.billing.complemento}
              </Typography>
            </Grid>
          )}
        </Grid>
      </CardContent>
    </Card>
  )
}

export default OrderCustomerData
