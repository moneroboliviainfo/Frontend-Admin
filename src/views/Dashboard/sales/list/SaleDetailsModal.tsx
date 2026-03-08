'use client'

import { useState } from 'react'

import { useRouter } from 'next/navigation'

import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Grid from '@mui/material/Grid2'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Paper from '@mui/material/Paper'
import TextField from '@mui/material/TextField'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import Snackbar from '@mui/material/Snackbar'

import { useQueryClient } from '@tanstack/react-query'

import { useCancelOrder, useSendOrder, useCancelOrderForEdit } from '@/hooks/useSales'
import type { Order } from '@/types/api/sales'

interface SnackbarMessage {
  message: string
  severity: 'success' | 'error' | 'info' | 'warning'
  key: number
}

type OrderDetailsModalProps = {
  open: boolean
  onClose: () => void
  order: Order | null
}

const getEstadoColor = (estado: string): 'primary' | 'error' | 'success' | 'warning' => {
  switch (estado) {
    case 'pending':
      return 'warning'
    case 'cancelled':
      return 'error'
    case 'paid':
    case 'completed':
      return 'success'
    case 'confirmed':
      return 'primary'
    case 'sent':
      return 'primary'
    case 'expired':
      return 'error'
    case 'cancelled_for_edit':
      return 'warning'
    default:
      return 'primary'
  }
}

const getEstadoLabel = (estado: string): string => {
  const labels: Record<string, string> = {
    pending: 'Pendiente',
    cancelled: 'Cancelado',
    paid: 'Pagado',
    completed: 'Completado',
    confirmed: 'Confirmado',
    sent: 'Enviado',
    expired: 'Expirado',
    cancelled_for_edit: 'En Edición'
  }

  return labels[estado] || estado
}

const getPaymentLabel = (paymentType: string): string => {
  const labels: Record<string, string> = {
    cash: 'Efectivo',
    card: 'Tarjeta',
    qr: 'QR'
  }

  return labels[paymentType] || paymentType
}

const getTipoLabel = (tipo: string): string => {
  return tipo === 'in_store' ? 'En Tienda' : 'En Línea'
}

const formatDate = (dateString: string): string => {
  const date = new Date(dateString)

  return date.toLocaleDateString('es-BO', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const OrderDetailsModal = ({ open, onClose, order }: OrderDetailsModalProps) => {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [dhlCode, setDhlCode] = useState('')
  const [showDhlInput, setShowDhlInput] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [showEditConfirm, setShowEditConfirm] = useState(false)
  const [snackPack, setSnackPack] = useState<SnackbarMessage[]>([])
  const [messageInfo, setMessageInfo] = useState<SnackbarMessage | undefined>(undefined)
  const [snackbarOpen, setSnackbarOpen] = useState(false)

  const cancelOrderMutation = useCancelOrder()
  const sendOrderMutation = useSendOrder()
  const cancelForEditMutation = useCancelOrderForEdit()

  if (!open || !order) return null

  const showMessage = (message: string, severity: 'success' | 'error' | 'info' | 'warning') => {
    setSnackPack(prev => [...prev, { message, severity, key: new Date().getTime() }])
  }

  const handleSnackbarClose = (_?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') {
      return
    }

    setSnackbarOpen(false)
  }

  const handleExited = () => {
    setMessageInfo(undefined)
  }

  const handleCancelar = async () => {
    setShowCancelConfirm(false)

    try {
      await cancelOrderMutation.mutateAsync(order.id)
      showMessage('Orden cancelada exitosamente', 'success')
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      setTimeout(() => {
        onClose()
      }, 1500)
    } catch (error: any) {
      showMessage(error?.response?.data?.message || 'Error al cancelar la orden', 'error')
    }
  }

  const handleSendOrder = async () => {
    try {
      await sendOrderMutation.mutateAsync({
        orderId: order.id,
        dhlCode: dhlCode.trim() || undefined
      })
      showMessage('Orden enviada exitosamente', 'success')
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      setShowDhlInput(false)
      setDhlCode('')
      setTimeout(() => {
        onClose()
      }, 1500)
    } catch (error: any) {
      showMessage(error?.response?.data?.message || 'Error al enviar la orden', 'error')
    }
  }

  const handleEditOrder = () => {
    setShowEditConfirm(true)
  }

  const handleEditOrderConfirm = async () => {
    setShowEditConfirm(false)

    if (order.status === 'cancelled_for_edit') {
      showMessage('Cargando orden para editar...', 'info')
      setTimeout(() => {
        onClose()
        router.push(`/sales/instore?editOrderId=${order.id}`)
      }, 500)

      return
    }

    try {
      await cancelForEditMutation.mutateAsync(order.id)
      showMessage('Preparando orden para edición...', 'info')
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      setTimeout(() => {
        onClose()
        router.push(`/sales/instore?editOrderId=${order.id}`)
      }, 1000)
    } catch (error: any) {
      showMessage(error?.response?.data?.message || 'Error al preparar orden para edición', 'error')
    }
  }

  const canEditOrder = () => {
    if (order.status === 'cancelled_for_edit') return true

    if (!['paid', 'sent'].includes(order.status)) return false

    const orderDate = new Date(order.createdAt)
    const today = new Date()

    const isToday =
      orderDate.getDate() === today.getDate() &&
      orderDate.getMonth() === today.getMonth() &&
      orderDate.getFullYear() === today.getFullYear()

    if (isToday) return false

    const hasDiscount = order.items.some(item => item.discountValue > 0)

    if (hasDiscount) return false

    return true
  }

  if (snackPack.length && !messageInfo) {
    setMessageInfo({ ...snackPack[0] })
    setSnackPack(prev => prev.slice(1))
    setSnackbarOpen(true)
  } else if (snackPack.length && messageInfo && snackbarOpen) {
    setSnackbarOpen(false)
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth='lg' fullWidth scroll='paper'>
      <DialogTitle className='flex justify-between items-center pb-4'>
        <Typography variant='h4' component='span' className='font-semibold'>
          Detalles de la Orden #{order.id}
        </Typography>
        <IconButton onClick={onClose} size='small'>
          <i className='tabler-x text-xl' />
        </IconButton>
      </DialogTitle>

      <DialogContent className='p-0'>
        <Box className='p-6 space-y-6'>
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
                        #{order.id}
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
                      </Typography>
                    </Box>

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

          {order.customer && (
            <Card variant='outlined'>
              <CardContent>
                <Typography variant='h6' className='mb-4 text-textPrimary'>
                  Información del Cliente
                </Typography>
                <Grid container spacing={3}>
                  {(() => {
                    const isGuestCustomer = order.customer.email === 'guest@moneroget.com'

                    // Si es invitado, usar datos de la orden; si no, usar datos del customer
                    const displayName = isGuestCustomer ? (order.name || '-') : order.customer.name
                    const displayEmail = isGuestCustomer ? (order.email || '-') : order.customer.email
                    const displayPhone = isGuestCustomer ? (order.phone || null) : order.customer.phone

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
          )}

          {order.address && (
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
          )}

          {order.shipment && (
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
                  {order.dhl_code && (
                    <Grid size={{ xs: 12 }}>
                      <Typography variant='overline' className='text-textSecondary text-xs font-medium block'>
                        Código DHL
                      </Typography>
                      <Typography variant='h6' className='font-bold mt-1'>
                        {order.dhl_code}
                      </Typography>
                    </Grid>
                  )}
                </Grid>
              </CardContent>
            </Card>
          )}

          <Card variant='outlined'>
            <CardContent>
              <Typography variant='h6' className='mb-4 text-textPrimary'>
                Productos de la Orden
              </Typography>

              <TableContainer component={Paper} variant='outlined'>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell width='220px'>Imagen</TableCell>
                      <TableCell>Producto</TableCell>
                      <TableCell align='center'>Cantidad</TableCell>
                      <TableCell align='right'>Precio Unit.</TableCell>
                      <TableCell align='right'>Descuento</TableCell>
                      <TableCell align='right'>Total</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {order.items.map(item => (
                      <TableRow key={item.id} hover>
                        <TableCell>
                          <Box className='w-48 h-48 bg-gray-100 rounded-xl flex items-center justify-center overflow-hidden border-2 border-gray-300 shadow-lg'>
                            {item.variant?.productColor?.multimedia?.[0] ? (
                              <img
                                src={item.variant.productColor.multimedia[0]}
                                alt={item.variant.productColor.product.name}
                                className='w-full h-full object-cover'
                              />
                            ) : (
                              <Box className='w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center'>
                                <Typography variant='h2' className='text-gray-400'>
                                  📦
                                </Typography>
                              </Box>
                            )}
                          </Box>
                        </TableCell>

                        <TableCell>
                          <Typography variant='body1' className='font-bold text-textPrimary'>
                            {item.variant?.productColor?.product?.name || 'Producto sin nombre'}
                          </Typography>
                          {item.variant?.productColor?.product?.description && (
                            <Typography variant='body2' color='text.secondary' className='block mt-1'>
                              {item.variant.productColor.product.description}
                            </Typography>
                          )}
                          <Box className='flex gap-3 mt-2'>
                            {item.variant?.productColor?.color && (
                              <Box className='flex items-center gap-1'>
                                <Typography variant='caption' className='text-textSecondary font-medium'>
                                  Color:
                                </Typography>
                                <Chip
                                  label={item.variant.productColor.color.name}
                                  size='small'
                                  variant='tonal'
                                  sx={{
                                    height: 20,
                                    fontSize: '0.75rem',
                                    fontWeight: 600
                                  }}
                                />
                              </Box>
                            )}
                            {item.variant?.size && (
                              <Box className='flex items-center gap-1'>
                                <Typography variant='caption' className='text-textSecondary font-medium'>
                                  Talla:
                                </Typography>
                                <Chip
                                  label={item.variant.size.name}
                                  size='small'
                                  variant='tonal'
                                  sx={{
                                    height: 20,
                                    fontSize: '0.75rem',
                                    fontWeight: 600
                                  }}
                                />
                              </Box>
                            )}
                          </Box>
                        </TableCell>

                        <TableCell align='center'>
                          <Chip
                            label={`x${item.quantity}`}
                            color='primary'
                            variant='tonal'
                            sx={{
                              fontWeight: 700,
                              fontSize: '0.875rem'
                            }}
                          />
                        </TableCell>

                        <TableCell align='right'>
                          <Typography variant='body1' className='font-semibold'>
                            Bs. {parseFloat(item.unit_price).toFixed(2)}
                          </Typography>
                        </TableCell>

                        <TableCell align='right'>
                          {item.discountValue > 0 ? (
                            <Chip
                              label={`-${item.discountValue}%`}
                              color='error'
                              variant='tonal'
                              size='small'
                              sx={{ fontWeight: 600 }}
                            />
                          ) : (
                            <Typography variant='body2' color='text.secondary'>
                              —
                            </Typography>
                          )}
                        </TableCell>

                        <TableCell align='right'>
                          <Typography variant='h6' className='font-bold text-primary'>
                            Bs. {parseFloat(item.totalPrice).toFixed(2)}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}

                    <TableRow sx={{ bgcolor: 'action.hover' }}>
                      <TableCell colSpan={5} align='right' sx={{ borderBottom: 'none', py: 3 }}>
                        <Typography variant='h6' className='font-bold text-textPrimary'>
                          Total de la Orden:
                        </Typography>
                      </TableCell>
                      <TableCell align='right' sx={{ borderBottom: 'none', py: 3 }}>
                        <Typography variant='h5' className='font-bold text-primary'>
                          Bs. {parseFloat(order.totalPrice).toFixed(2)}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Box>
      </DialogContent>

      <DialogActions className='p-6 pt-0'>
        <Box className='flex gap-3 w-full justify-between flex-wrap'>
          {/* Botón de Editar Orden  */}
          {canEditOrder() && (
            <Button
              variant='outlined'
              color='warning'
              onClick={handleEditOrder}
              disabled={cancelForEditMutation.isPending}
              startIcon={
                cancelForEditMutation.isPending ? (
                  <CircularProgress size={20} color='inherit' />
                ) : (
                  <i className='tabler-edit' />
                )
              }
            >
              {cancelForEditMutation.isPending
                ? 'Preparando...'
                : order.status === 'cancelled_for_edit'
                  ? 'Seguir Editando'
                  : 'Editar Orden'}
            </Button>
          )}

          <Box className='flex gap-3 flex-wrap'>
            {order.status === 'pending' && (
              <Button
                variant='contained'
                color='error'
                onClick={() => setShowCancelConfirm(true)}
                disabled={cancelOrderMutation.isPending}
                startIcon={<i className='tabler-x' />}
              >
                Cancelar Orden
              </Button>
            )}

            {order.status === 'paid' && (
              <>
                <Button
                  variant='outlined'
                  color='error'
                  onClick={() => setShowCancelConfirm(true)}
                  disabled={cancelOrderMutation.isPending || sendOrderMutation.isPending}
                  startIcon={<i className='tabler-x' />}
                >
                  Cancelar Orden
                </Button>

                {!showDhlInput && (
                  <Button
                    variant='contained'
                    color='primary'
                    onClick={() => setShowDhlInput(true)}
                    disabled={cancelOrderMutation.isPending || sendOrderMutation.isPending}
                    startIcon={<i className='tabler-truck' />}
                  >
                    Enviar Pedido
                  </Button>
                )}

                {showDhlInput && (
                  <>
                    {!order.shipment && (
                      <TextField
                        size='small'
                        label='Código DHL'
                        value={dhlCode}
                        onChange={e => setDhlCode(e.target.value)}
                        placeholder='Ej: DHL-123456'
                        className='max-sm:is-full sm:is-[200px]'
                        disabled={sendOrderMutation.isPending}
                        required
                      />
                    )}
                    <Button
                      variant='outlined'
                      onClick={() => {
                        setShowDhlInput(false)
                        setDhlCode('')
                      }}
                      disabled={sendOrderMutation.isPending}
                    >
                      Cancelar
                    </Button>
                    <Button
                      variant='contained'
                      color='success'
                      onClick={handleSendOrder}
                      disabled={sendOrderMutation.isPending || (!order.shipment && !dhlCode.trim())}
                      startIcon={
                        sendOrderMutation.isPending ? (
                          <CircularProgress size={20} color='inherit' />
                        ) : (
                          <i className='tabler-check' />
                        )
                      }
                    >
                      {sendOrderMutation.isPending ? 'Enviando...' : 'Confirmar Envío'}
                    </Button>
                  </>
                )}
              </>
            )}

            {order.status === 'sent' && (
              <Button
                variant='contained'
                color='error'
                onClick={() => setShowCancelConfirm(true)}
                disabled={cancelOrderMutation.isPending}
                startIcon={<i className='tabler-x' />}
              >
                Cancelar Orden
              </Button>
            )}

            {!['pending', 'paid', 'sent'].includes(order.status) && (
              <Button variant='outlined' onClick={onClose}>
                Cerrar
              </Button>
            )}
          </Box>
        </Box>
      </DialogActions>

      {/* Modal de confirmación de cancelación */}
      <Dialog open={showCancelConfirm} onClose={() => setShowCancelConfirm(false)} maxWidth='xs' fullWidth>
        <DialogTitle>
          <Typography fontWeight='bold'>¿Cancelar Orden?</Typography>
        </DialogTitle>
        <DialogContent>
          <Typography>
            ¿Estás seguro que deseas cancelar la orden #{order.id}? Esta acción no se puede deshacer.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button
            onClick={() => setShowCancelConfirm(false)}
            disabled={cancelOrderMutation.isPending}
            variant='outlined'
            fullWidth
          >
            No, Continuar
          </Button>
          <Button
            onClick={handleCancelar}
            color='error'
            variant='contained'
            disabled={cancelOrderMutation.isPending}
            startIcon={cancelOrderMutation.isPending ? <CircularProgress size={20} color='inherit' /> : null}
            fullWidth
          >
            {cancelOrderMutation.isPending ? 'Cancelando...' : 'Sí, Cancelar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal de confirmación de edición */}
      <Dialog open={showEditConfirm} onClose={() => setShowEditConfirm(false)} maxWidth='xs' fullWidth>
        <DialogTitle>
          <Typography fontWeight='bold'>
            {order.status === 'cancelled_for_edit' ? '¿Continuar Editando?' : '¿Editar Orden?'}
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Typography>
            {order.status === 'cancelled_for_edit'
              ? `¿Deseas continuar editando la orden ?`
              : `¿Estás seguro que deseas editar la orden ? Podrás modificar los productos y cantidades.`}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button
            onClick={() => setShowEditConfirm(false)}
            disabled={cancelForEditMutation.isPending}
            variant='outlined'
            fullWidth
          >
            No, Cancelar
          </Button>
          <Button
            onClick={handleEditOrderConfirm}
            color='warning'
            variant='contained'
            disabled={cancelForEditMutation.isPending}
            startIcon={cancelForEditMutation.isPending ? <CircularProgress size={20} color='inherit' /> : null}
            fullWidth
          >
            {cancelForEditMutation.isPending
              ? 'Preparando...'
              : order.status === 'cancelled_for_edit'
                ? 'Sí, Continuar'
                : 'Sí, Editar'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbarOpen}
        onClose={handleSnackbarClose}
        autoHideDuration={3000}
        TransitionProps={{ onExited: handleExited }}
        key={messageInfo ? messageInfo.key : undefined}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          variant='filled'
          onClose={handleSnackbarClose}
          className='is-full shadow-xs items-center'
          severity={messageInfo?.severity || 'info'}
        >
          {messageInfo?.message}
        </Alert>
      </Snackbar>
    </Dialog>
  )
}

export default OrderDetailsModal
