'use client'

// Datos de cabecera de la orden: numero, estado, tipo, pago y fechas.
//
// Solo lectura: recibe la orden y la dibuja. Se extrajo de SaleDetailsModal tal
// cual estaba, sin tocar condiciones ni formato.

import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Grid from '@mui/material/Grid2'
import Typography from '@mui/material/Typography'

import type { Order } from '@/types/api/sales'
import { formatDate, getEstadoColor, getEstadoLabel, getPaymentLabel, getTipoLabel } from './orderFormatters'

const OrderGeneralInfo = ({ order }: { order: Order }) => {
  return (
    <Card variant='outlined'>
      <CardContent>
        <Typography variant='h6' className='mb-4 text-textPrimary'>
          Información General
        </Typography>

        <Grid container spacing={3}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Box className='space-y-4'>
              <Box>
                <Typography variant='overline' className='text-textSecondary text-xs font-medium'>
                  ID de Orden
                </Typography>
                <Typography variant='h6' className='font-bold mt-1'>
                  #{order.inherited_id || order.id}
                </Typography>
              </Box>

              <Box>
                <Typography variant='overline' className='text-textSecondary text-xs font-medium'>
                  Tipo de Venta
                </Typography>
                <Typography variant='body1' className='font-semibold mt-1'>
                  {getTipoLabel(order.type)}
                </Typography>
              </Box>

              <Box>
                <Typography variant='overline' className='text-textSecondary text-xs font-medium'>
                  Método de Pago
                </Typography>
                <Typography variant='body1' className='font-semibold mt-1'>
                  {order.payment_type ? getPaymentLabel(order.payment_type) : 'N/A'}
                </Typography>
              </Box>

              <Box>
                <Typography variant='overline' className='text-textSecondary text-xs font-medium'>
                  Fecha de Creación
                </Typography>
                <Typography variant='body1' className='font-medium mt-1'>
                  {order.createdAt ? formatDate(order.createdAt) : 'N/A'}
                  {order.createdBy && ` · por ${order.createdBy.name}`}
                </Typography>
              </Box>

              {order.paidAt && (
                <Box>
                  <Typography variant='overline' className='text-textSecondary text-xs font-medium'>
                    Pagada
                  </Typography>
                  <Typography variant='body1' className='font-medium mt-1'>
                    {formatDate(order.paidAt)}
                  </Typography>
                </Box>
              )}

              {(order.sentAt || order.sentBy) && (
                <Box>
                  <Typography variant='overline' className='text-textSecondary text-xs font-medium'>
                    Despachada
                  </Typography>
                  <Typography variant='body1' className='font-medium mt-1'>
                    {order.sentAt ? formatDate(order.sentAt) : ''}
                    {order.sentBy && ` · por ${order.sentBy.name}`}
                  </Typography>
                </Box>
              )}

              {(order.cancelledAt || order.cancelledBy) && (
                <Box>
                  <Typography variant='overline' className='text-textSecondary text-xs font-medium'>
                    Cancelada
                  </Typography>
                  <Typography variant='body1' className='font-medium mt-1 text-error'>
                    {order.cancelledAt ? formatDate(order.cancelledAt) : ''}
                    {order.cancelledBy ? ` · por ${order.cancelledBy.name}` : ' · por el sistema'}
                  </Typography>
                </Box>
              )}

              {order.editedBy && (
                <Box>
                  <Typography variant='overline' className='text-textSecondary text-xs font-medium'>
                    Editada por
                  </Typography>
                  <Typography variant='body1' className='font-medium mt-1'>
                    {order.editedBy.name}
                  </Typography>
                </Box>
              )}

              {order.expiresAt && (
                <Box>
                  <Typography variant='overline' className='text-textSecondary text-xs font-medium'>
                    Expira en
                  </Typography>
                  <Typography variant='body1' className='font-medium mt-1 text-error'>
                    {formatDate(order.expiresAt)}
                  </Typography>
                </Box>
              )}
            </Box>
          </Grid>

          <Grid size={{ xs: 12, sm: 6 }}>
            <Box className='space-y-4'>
              <Box>
                <Typography variant='overline' className='text-textSecondary text-xs font-medium'>
                  Total
                </Typography>
                <Typography variant='h5' className='font-bold text-primary mt-1'>
                  Bs. {parseFloat(order.totalPrice).toFixed(2)}
                </Typography>
              </Box>

              {order.shipment_price !== undefined && order.shipment_price > 0 && (
                <Box>
                  <Typography variant='overline' className='text-textSecondary text-xs font-medium'>
                    Costo de Envío
                  </Typography>
                  <Typography variant='body1' className='font-semibold text-warning mt-1'>
                    Bs. {parseFloat(String(order.shipment_price)).toFixed(2)}
                  </Typography>
                </Box>
              )}

              <Box>
                <Typography variant='overline' className='text-textSecondary text-xs font-medium'>
                  Estado
                </Typography>
                <Box className='mt-1'>
                  <Chip
                    label={getEstadoLabel(order.status)}
                    variant='tonal'
                    color={getEstadoColor(order.status)}
                    size='medium'
                  />
                </Box>
              </Box>

              <Box>
                <Typography variant='overline' className='text-textSecondary text-xs font-medium'>
                  Orden Editada
                </Typography>
                <Box className='mt-1'>
                  {order.edited ? (
                    <Chip label='Sí' color='warning' variant='tonal' size='small' />
                  ) : (
                    <Typography variant='body1' className='font-medium'>
                      No
                    </Typography>
                  )}
                </Box>
              </Box>
            </Box>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  )
}

export default OrderGeneralInfo
