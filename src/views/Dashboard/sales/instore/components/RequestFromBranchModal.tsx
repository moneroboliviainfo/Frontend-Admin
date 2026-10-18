'use client'

import { useEffect, useState } from 'react'

import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Alert from '@mui/material/Alert'
import Divider from '@mui/material/Divider'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Skeleton from '@mui/material/Skeleton'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'

import CustomTextField from '@core/components/mui/TextField'
import tableStyles from '@core/styles/table.module.css'
import { useBranchStock, useCreateBranchRequest, useQuoteBranchRequest } from '@/hooks/useBranchTransfers'
import { useUserRole } from '@/hooks/useUserRole'

export type RequestTarget = {
  variantSizeId: number
  label: string
}

type Props = {
  target: RequestTarget | null
  onClose: () => void
  onAwaitingQr: (transferId: number) => void
  showMessage: (message: string, severity: 'success' | 'error') => void
}

const RequestFromBranchModal = ({ target, onClose, onAwaitingQr, showMessage }: Props) => {
  const [sourceBranchId, setSourceBranchId] = useState<number | null>(null)
  const [quantity, setQuantity] = useState('1')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerCi, setCustomerCi] = useState('')
  const [paymentType, setPaymentType] = useState<'none' | 'cash' | 'card' | 'qr'>('none')
  const [quotedTotal, setQuotedTotal] = useState<string | null>(null)

  const { userBranch } = useUserRole()
  const createRequest = useCreateBranchRequest()
  const quoteRequest = useQuoteBranchRequest()

  const { data, isLoading } = useBranchStock(target?.variantSizeId ?? null)

  useEffect(() => {
    setSourceBranchId(null)
    setQuantity('1')
    setCustomerName('')
    setCustomerPhone('')
    setCustomerCi('')
    setPaymentType('none')
    setQuotedTotal(null)
  }, [target])

  if (!target) return null

  // La propia sucursal viene en la lista: no tiene sentido pedirse a uno mismo
  const branches = (data || []).filter(item => item.branch.id !== userBranch?.id)

  const selected = branches.find(item => item.branch.id === sourceBranchId)
  const parsed = parseInt(quantity, 10) || 0
  const overStock = !!selected && parsed > selected.availableToRequest
  const charges = paymentType !== 'none'

  // Con cobro, el back exige los tres datos del cliente y el total cotizado
  const customerComplete = !!customerName.trim() && !!customerPhone.trim() && !!customerCi.trim()

  const isValid =
    !!sourceBranchId && parsed > 0 && !overStock && (!charges || (!!quotedTotal && customerComplete))

  const handleQuote = async () => {
    if (!sourceBranchId) return

    try {
      const quote = await quoteRequest.mutateAsync({
        sourceBranchId,
        items: [{ variantId: target.variantSizeId, quantity: parsed }]
      })

      setQuotedTotal(quote.total)
    } catch (error: any) {
      showMessage(error?.response?.data?.message || 'No se pudo cotizar', 'error')
    }
  }

  const handleConfirm = async () => {
    if (!sourceBranchId) return

    try {
      const created = await createRequest.mutateAsync({
        sourceBranchId,
        items: [{ variantId: target.variantSizeId, quantity: parsed }],
        ...(charges && { paymentType, expectedTotal: Number(quotedTotal) }),
        ...(customerName.trim() && { customerName: customerName.trim() }),
        ...(customerPhone.trim() && { customerPhone: customerPhone.trim() }),
        ...(customerCi.trim() && { customerCi: customerCi.trim() })
      })

      if (paymentType === 'qr') {
        // Queda en pending_payment: la pantalla del QR sigue desde aca
        onAwaitingQr(created.id)

        return
      }

      showMessage(
        charges
          ? `Pedido #${created.id} creado y cobrado. Informe al cliente cuando llegue.`
          : `Pedido #${created.id} creado. Informe al cliente cuando llegue a la sucursal.`,
        'success'
      )
      onClose()
    } catch (error: any) {
      const message = error?.response?.data?.message || 'No se pudo crear el pedido'

      // Si el precio cambio desde la cotizacion el back no cobra nada: hay que volver a cotizar
      if (message.includes('total del pedido cambió')) setQuotedTotal(null)

      showMessage(message, 'error')
    }
  }

  return (
    <Dialog open onClose={onClose} maxWidth='sm' fullWidth>
      <DialogTitle>
        Pedir a otra sucursal
        <Typography variant='body2' color='text.secondary' sx={{ mt: 1 }}>
          {target.label}
        </Typography>
      </DialogTitle>

      <DialogContent>
        {isLoading ? (
          <Box>
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} height={44} sx={{ mb: 1 }} />
            ))}
          </Box>
        ) : branches.length === 0 ? (
          <Alert severity='warning'>Ninguna otra sucursal cuenta con esta prenda.</Alert>
        ) : (
          <>
            <Typography variant='body2' sx={{ mb: 2 }}>
              ¿A qué sucursal se lo pedimos?
            </Typography>

            <div className='overflow-x-auto'>
              <table className={tableStyles.table}>
                <thead>
                  <tr>
                    <th>Sucursal</th>
                    <th>Se puede pedir</th>
                    <th>En camino</th>
                  </tr>
                </thead>
                <tbody>
                  {branches.map(item => {
                    const isSelected = item.branch.id === sourceBranchId
                    const canRequest = item.availableToRequest > 0

                    return (
                      <tr
                        key={item.branch.id}
                        onClick={() => {
                          if (!canRequest) return
                          setSourceBranchId(item.branch.id)
                          setQuotedTotal(null)
                        }}
                        style={{ cursor: canRequest ? 'pointer' : 'default', opacity: canRequest ? 1 : 0.5 }}
                      >
                        <td>
                          <Typography
                            variant='body2'
                            className={isSelected ? 'font-medium' : undefined}
                            color={isSelected ? 'primary.main' : 'inherit'}
                          >
                            {isSelected ? '● ' : ''}
                            {item.branch.name}
                          </Typography>
                        </td>
                        <td>
                          <Chip
                            label={item.availableToRequest}
                            size='small'
                            variant='tonal'
                            color={canRequest ? 'success' : 'default'}
                          />
                        </td>
                        <td>
                          <Typography variant='body2' color='text.secondary'>
                            {item.inTransit || '—'}
                          </Typography>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <Alert severity='info' sx={{ mt: 3 }}>
              Solo se puede solicitar lo que está <strong>en la tienda</strong> de la otra sucursal. Al solicitarlo
              deja de estar a la venta allí.
            </Alert>

            <Divider sx={{ my: 4 }} />

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <CustomTextField
                fullWidth
                type='number'
                label='Cantidad'
                value={quantity}
                onChange={e => {
                  setQuantity(e.target.value)
                  setQuotedTotal(null)
                }}
                error={overStock}
                helperText={overStock ? `Solo se pueden pedir ${selected?.availableToRequest}` : ''}
                inputProps={{ min: 1, max: selected?.availableToRequest }}
              />

              <Box>
                <Typography variant='body2' sx={{ mb: 2 }}>
                  ¿Cobra ahora el pedido?
                </Typography>
                <ToggleButtonGroup
                  exclusive
                  fullWidth
                  size='small'
                  value={paymentType}
                  onChange={(_, value) => {
                    if (!value) return
                    setPaymentType(value)
                    setQuotedTotal(null)
                  }}
                >
                  <ToggleButton value='none'>Paga al retirar</ToggleButton>
                  <ToggleButton value='cash'>Efectivo</ToggleButton>
                  <ToggleButton value='card'>Tarjeta</ToggleButton>
                  <ToggleButton value='qr'>QR</ToggleButton>
                </ToggleButtonGroup>
              </Box>

              {charges && !quotedTotal && (
                <Box>
                  <Button
                    fullWidth
                    variant='tonal'
                    onClick={handleQuote}
                    disabled={!sourceBranchId || parsed <= 0 || quoteRequest.isPending}
                    startIcon={
                      quoteRequest.isPending ? <CircularProgress size={16} /> : <i className='tabler-calculator' />
                    }
                  >
                    {quoteRequest.isPending ? 'Calculando...' : 'Calcular total a cobrar'}
                  </Button>
                  <Typography variant='caption' color='text.secondary'>
                    El precio se calcula al momento. Dígaselo al cliente antes de cobrarle.
                  </Typography>
                </Box>
              )}

              {charges && quotedTotal && (
                <Alert severity='success'>
                  <Typography variant='body2' className='font-medium'>
                    A cobrar ahora: Bs {parseFloat(quotedTotal).toFixed(2)}
                  </Typography>
                  <Typography variant='caption'>
                    {paymentType === 'qr'
                      ? 'Al confirmar se genera el QR para que el cliente lo escanee. La caja de su sucursal debe estar abierta.'
                      : 'Cobre al cliente y recién entonces confirme. La caja de su sucursal debe estar abierta.'}
                  </Typography>
                </Alert>
              )}

              <Typography variant='body2' color='text.secondary'>
                {charges
                  ? 'Datos del cliente (obligatorios para un pedido cobrado)'
                  : 'Datos del cliente (opcionales, permiten informarle cuando la prenda llegue)'}
              </Typography>

              <CustomTextField
                fullWidth
                label='Nombre'
                placeholder='María Pérez'
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                error={charges && !customerName.trim()}
              />
              <CustomTextField
                fullWidth
                label='Teléfono'
                placeholder='70012345'
                value={customerPhone}
                onChange={e => setCustomerPhone(e.target.value)}
                error={charges && !customerPhone.trim()}
              />
              <CustomTextField
                fullWidth
                label='CI'
                placeholder='1234567'
                value={customerCi}
                onChange={e => setCustomerCi(e.target.value)}
                error={charges && !customerCi.trim()}
              />
            </Box>
          </>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} color='secondary' disabled={createRequest.isPending}>
          Cancelar
        </Button>
        <Button
          onClick={handleConfirm}
          variant='contained'
          disabled={!isValid || createRequest.isPending}
          startIcon={
            createRequest.isPending ? <CircularProgress size={16} /> : <i className='tabler-shopping-cart-plus' />
          }
        >
          {createRequest.isPending
            ? 'Pidiendo...'
            : paymentType === 'qr'
              ? 'Generar QR y hacer el pedido'
              : charges
                ? 'Cobrar y hacer el pedido'
                : 'Hacer el pedido'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default RequestFromBranchModal
