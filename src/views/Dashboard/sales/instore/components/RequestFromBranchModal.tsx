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
import Skeleton from '@mui/material/Skeleton'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'

import CustomTextField from '@core/components/mui/TextField'
import tableStyles from '@core/styles/table.module.css'
import { useBranchStock, useCreateBranchRequest } from '@/hooks/useBranchTransfers'
import { useUserRole } from '@/hooks/useUserRole'

export type RequestTarget = {
  variantSizeId: number
  label: string
}

type Props = {
  target: RequestTarget | null
  onClose: () => void
  showMessage: (message: string, severity: 'success' | 'error') => void
}

const RequestFromBranchModal = ({ target, onClose, showMessage }: Props) => {
  const [sourceBranchId, setSourceBranchId] = useState<number | null>(null)
  const [quantity, setQuantity] = useState('1')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerCi, setCustomerCi] = useState('')

  const { userBranch } = useUserRole()
  const createRequest = useCreateBranchRequest()

  const { data, isLoading } = useBranchStock(target?.variantSizeId ?? null)

  useEffect(() => {
    setSourceBranchId(null)
    setQuantity('1')
    setCustomerName('')
    setCustomerPhone('')
    setCustomerCi('')
  }, [target])

  if (!target) return null

  // La propia sucursal viene en la lista: no tiene sentido pedirse a uno mismo
  const branches = (data || []).filter(item => item.branch.id !== userBranch?.id)

  const selected = branches.find(item => item.branch.id === sourceBranchId)
  const parsed = parseInt(quantity, 10) || 0
  const overStock = !!selected && parsed > selected.availableToRequest
  const isValid = !!sourceBranchId && parsed > 0 && !overStock

  const handleConfirm = async () => {
    if (!sourceBranchId) return

    try {
      const created = await createRequest.mutateAsync({
        sourceBranchId,
        items: [{ variantId: target.variantSizeId, quantity: parsed }],
        ...(customerName.trim() && { customerName: customerName.trim() }),
        ...(customerPhone.trim() && { customerPhone: customerPhone.trim() }),
        ...(customerCi.trim() && { customerCi: customerCi.trim() })
      })

      showMessage(`Pedido #${created.id} creado. Informe al cliente cuando llegue a la sucursal.`, 'success')
      onClose()
    } catch (error: any) {
      showMessage(error?.response?.data?.message || 'No se pudo crear el pedido', 'error')
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
                        onClick={() => canRequest && setSourceBranchId(item.branch.id)}
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
                onChange={e => setQuantity(e.target.value)}
                error={overStock}
                helperText={overStock ? `Solo se pueden pedir ${selected?.availableToRequest}` : ''}
                inputProps={{ min: 1, max: selected?.availableToRequest }}
              />

              <Typography variant='body2' color='text.secondary'>
                Datos del cliente (opcionales, permiten informarle cuando la prenda llegue)
              </Typography>

              <CustomTextField
                fullWidth
                label='Nombre'
                placeholder='María Pérez'
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
              />
              <CustomTextField
                fullWidth
                label='Teléfono'
                placeholder='70012345'
                value={customerPhone}
                onChange={e => setCustomerPhone(e.target.value)}
              />
              <CustomTextField
                fullWidth
                label='CI'
                placeholder='1234567'
                value={customerCi}
                onChange={e => setCustomerCi(e.target.value)}
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
          {createRequest.isPending ? 'Pidiendo...' : 'Hacer el pedido'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default RequestFromBranchModal
