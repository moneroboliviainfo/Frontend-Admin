'use client'

// Direccion a la que se envia la orden.
//
// Solo lectura: recibe la orden y la dibuja. Se extrajo de SaleDetailsModal tal
// cual estaba, sin tocar condiciones ni formato.

import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Grid from '@mui/material/Grid2'
import Typography from '@mui/material/Typography'

import type { Order } from '@/types/api/sales'

const OrderShippingAddress = ({ order }: { order: Order }) => {
  return (
    <Card variant='outlined'>
      <CardContent>
        <Typography variant='h6' className='mb-4 text-textPrimary'>
          Dirección de Envío
        </Typography>
        <Grid container spacing={3}>
          {order.address.address && (
            <Grid size={{ xs: 12 }}>
              <Typography variant='overline' className='text-textSecondary text-xs font-medium block'>
                Dirección
              </Typography>
              <Typography variant='body1' className='font-medium mt-1' style={{ whiteSpace: 'pre-line' }}>
                {order.address.address}
              </Typography>
            </Grid>
          )}
          {order.address.city && (
            <Grid size={{ xs: 12, sm: 6 }}>
              <Typography variant='overline' className='text-textSecondary text-xs font-medium block'>
                Ciudad
              </Typography>
              <Typography variant='body1' className='font-semibold mt-1'>
                {order.address.city}
              </Typography>
            </Grid>
          )}
          {order.address.country && (
            <Grid size={{ xs: 12, sm: 6 }}>
              <Typography variant='overline' className='text-textSecondary text-xs font-medium block'>
                País
              </Typography>
              <Typography variant='body1' className='font-semibold mt-1'>
                {order.address.country}
              </Typography>
            </Grid>
          )}
          {order.address.postal_code && (
            <Grid size={{ xs: 12, sm: 6 }}>
              <Typography variant='overline' className='text-textSecondary text-xs font-medium block'>
                Código Postal
              </Typography>
              <Typography variant='body1' className='font-medium mt-1'>
                {order.address.postal_code}
              </Typography>
            </Grid>
          )}
          {order.address.type && (
            <Grid size={{ xs: 12, sm: 6 }}>
              <Typography variant='overline' className='text-textSecondary text-xs font-medium block'>
                Tipo de Envío
              </Typography>
              <Typography variant='body1' className='font-medium mt-1'>
                {order.address.type === 'national' ? 'Nacional' : 'Internacional'}
              </Typography>
            </Grid>
          )}
        </Grid>
      </CardContent>
    </Card>
  )
}

export default OrderShippingAddress
