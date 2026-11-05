'use client'

// Datos del cliente. Si la compra fue como invitado, los datos salen del billing.
//
// Solo lectura: recibe la orden y la dibuja. Se extrajo de SaleDetailsModal tal
// cual estaba, sin tocar condiciones ni formato.

import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Grid from '@mui/material/Grid2'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'

import type { Order } from '@/types/api/sales'

const OrderCustomerInfo = ({ order }: { order: Order }) => {
  return (
    <Card variant='outlined'>
      <CardContent>
        <Typography variant='h6' className='mb-4 text-textPrimary'>
          Información del Cliente
        </Typography>
        <Grid container spacing={3}>
          {(() => {
            const isGuestCustomer = order.customer.email === 'guest@moneroget.com'

            // Si es invitado, usar datos del billing; si no, usar datos del customer
            const displayName = isGuestCustomer ? order.billing?.name || '-' : order.customer.name

            const displayEmail = isGuestCustomer
              ? order.billing?.email || order.email || '-'
              : order.customer.email

            const displayPhone = isGuestCustomer ? order.billing?.phone || null : order.customer.phone

            return (
              <>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant='overline' className='text-textSecondary text-xs font-medium block'>
                    Nombre
                  </Typography>
                  <Typography variant='body1' className='font-semibold mt-1'>
                    {displayName || '-'}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant='overline' className='text-textSecondary text-xs font-medium block'>
                    Email
                  </Typography>
                  <Typography variant='body1' className='font-medium mt-1'>
                    {displayEmail || '-'}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant='overline' className='text-textSecondary text-xs font-medium block'>
                    Teléfono
                  </Typography>
                  {displayPhone ? (
                    <Box className='flex items-center gap-2 mt-1'>
                      <Typography variant='body1' className='font-medium'>
                        {displayPhone}
                      </Typography>
                      <IconButton
                        size='small'
                        color='success'
                        href={`https://wa.me/${displayPhone.replace(/[^0-9]/g, '')}`}
                        target='_blank'
                        rel='noopener noreferrer'
                        sx={{
                          bgcolor: '#25D366',
                          color: 'white',
                          width: 32,
                          height: 32,
                          '&:hover': {
                            bgcolor: '#128C7E'
                          }
                        }}
                      >
                        <i className='tabler-brand-whatsapp' style={{ fontSize: '1.25rem' }} />
                      </IconButton>
                    </Box>
                  ) : (
                    <Typography variant='body1' className='font-medium mt-1'>
                      -
                    </Typography>
                  )}
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant='overline' className='text-textSecondary text-xs font-medium block'>
                    Tipo de Cliente
                  </Typography>
                  <Typography variant='body1' className='font-medium mt-1'>
                    {isGuestCustomer
                      ? 'Invitado'
                      : order.customer.type === 'registered'
                        ? 'Registrado'
                        : 'Suscriptor'}
                  </Typography>
                </Grid>
              </>
            )
          })()}
        </Grid>
      </CardContent>
    </Card>
  )
}

export default OrderCustomerInfo
