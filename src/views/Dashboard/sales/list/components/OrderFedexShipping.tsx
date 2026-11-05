'use client'

// Guia de FedEx: numero de seguimiento y PDF de la etiqueta.
//
// Solo lectura: recibe la orden y la dibuja. Se extrajo de SaleDetailsModal tal
// cual estaba, sin tocar condiciones ni formato.

import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Grid from '@mui/material/Grid2'
import Typography from '@mui/material/Typography'

import type { Order } from '@/types/api/sales'
import { getFedexPdfUrl, getFedexTrackingNumber } from './orderFormatters'

const OrderFedexShipping = ({ order }: { order: Order }) => {
  return (
    <Card variant='outlined'>
      <CardContent>
        <Typography variant='h6' className='mb-4 text-textPrimary'>
          Envío FedEx
        </Typography>
        <Grid container spacing={3}>
          {getFedexTrackingNumber(order) && (
            <Grid size={{ xs: 12, sm: 4 }}>
              <Typography variant='overline' className='text-textSecondary text-xs font-medium block'>
                Código de Seguimiento
              </Typography>
              <Typography variant='h6' className='font-bold mt-1'>
                {getFedexTrackingNumber(order)}
              </Typography>
            </Grid>
          )}
          {order.fedex_shipping_data && (
            <>
              <Grid size={{ xs: 6, sm: 4 }}>
                <Typography variant='overline' className='text-textSecondary text-xs font-medium block'>
                  Cantidad de Bultos
                </Typography>
                <Typography variant='h6' className='font-bold mt-1'>
                  {order.fedex_shipping_data.packageCount}
                </Typography>
              </Grid>
              <Grid size={{ xs: 6, sm: 4 }}>
                <Typography variant='overline' className='text-textSecondary text-xs font-medium block'>
                  Peso
                </Typography>
                <Typography variant='h6' className='font-bold mt-1'>
                  {order.fedex_shipping_data.calculatedWeightKg} kg
                </Typography>
              </Grid>
            </>
          )}
          {getFedexPdfUrl(order) && (
            <Grid size={{ xs: 12 }}>
              <Button
                component='a'
                href={getFedexPdfUrl(order)!}
                target='_blank'
                rel='noopener noreferrer'
                variant='outlined'
                startIcon={<i className='tabler-file-download' />}
              >
                Descargar PDF
              </Button>
            </Grid>
          )}
        </Grid>
      </CardContent>
    </Card>
  )
}

export default OrderFedexShipping
