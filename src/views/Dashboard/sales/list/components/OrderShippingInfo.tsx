'use client'

// Metodo y costo de envio.
//
// Solo lectura: recibe la orden y la dibuja. Se extrajo de SaleDetailsModal tal
// cual estaba, sin tocar condiciones ni formato.

import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Grid from '@mui/material/Grid2'
import Typography from '@mui/material/Typography'

import type { Order } from '@/types/api/sales'

const OrderShippingInfo = ({ order }: { order: Order }) => {
  return (
    <Card variant='outlined'>
      <CardContent>
        <Typography variant='h6' className='mb-4 text-textPrimary'>
          Información de Envío
        </Typography>
        <Grid container spacing={3}>
          {order.shipment.name && (
            <Grid size={{ xs: 12, sm: 6 }}>
              <Typography variant='overline' className='text-textSecondary text-xs font-medium block'>
                Tipo de Envío
              </Typography>
              <Typography variant='body1' className='font-semibold mt-1'>
                {order.shipment.name}
              </Typography>
            </Grid>
          )}
          {order.shipment.price && (
            <Grid size={{ xs: 12, sm: 6 }}>
              <Typography variant='overline' className='text-textSecondary text-xs font-medium block'>
                Costo de Envío
              </Typography>
              <Typography variant='h6' className='font-bold text-primary mt-1'>
                Bs. {parseFloat(order.shipment.price).toFixed(2)}
              </Typography>
            </Grid>
          )}
        </Grid>
      </CardContent>
    </Card>
  )
}

export default OrderShippingInfo
