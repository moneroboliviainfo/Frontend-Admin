'use client'

import { useEffect, useState } from 'react'

import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Alert from '@mui/material/Alert'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'

import CustomTextField from '@core/components/mui/TextField'
import { useSubtractStock } from '@/hooks/useVariants'

export type SubtractTarget = {
  variantSizeId: number
  label: string
  warehouseStock: number
}

type Props = {
  target: SubtractTarget | null
  warehouseId?: number
  onClose: () => void
  showMessage: (message: string, severity: 'success' | 'error') => void
}

const SubtractCentralStockModal = ({ target, warehouseId, onClose, showMessage }: Props) => {
  const [quantity, setQuantity] = useState('')
  const [reason, setReason] = useState('')

  const subtractStock = useSubtractStock()

  useEffect(() => {
    setQuantity('')
    setReason('')
  }, [target])

  if (!target) return null

  const parsed = parseInt(quantity, 10) || 0
  const overStock = parsed > target.warehouseStock
  const isValid = parsed > 0 && !overStock && !!reason.trim()

  const handleConfirm = async () => {
    try {
      await subtractStock.mutateAsync({
        variantId: target.variantSizeId,

        // El back espera la cantidad en negativo
        quantity: -parsed,
        reason: reason.trim(),

        // La bodega no tiene piso de venta: con sales_floor responde 400
        location: 'warehouse',
        branchId: warehouseId
      })

      showMessage(`Se dieron de baja ${parsed} de la bodega`, 'success')
      onClose()
    } catch (error: any) {
      showMessage(error?.response?.data?.message || 'No se pudo dar de baja', 'error')
    }
  }

  return (
    <Dialog open onClose={onClose} maxWidth='xs' fullWidth>
      <DialogTitle>Dar de baja</DialogTitle>

      <DialogContent>
        <Alert severity='warning' sx={{ mb: 4 }}>
          Esto <strong>descuenta</strong> de la bodega. Usalo para prenda dañada o inservible, no para un envío que se
          perdió en el camino.
        </Alert>

        <Box sx={{ mb: 4 }}>
          <Typography variant='body2' className='font-medium'>
            {target.label}
          </Typography>
          <Typography variant='caption' color='text.secondary'>
            {target.warehouseStock} en bodega
          </Typography>
        </Box>

        <CustomTextField
          fullWidth
          type='number'
          label='Cantidad'
          placeholder='0'
          value={quantity}
          onChange={e => setQuantity(e.target.value)}
          error={overStock}
          helperText={overStock ? `La bodega solo tiene ${target.warehouseStock}` : ''}
          inputProps={{ min: 1, max: target.warehouseStock }}
          sx={{ mb: 4 }}
        />

        <CustomTextField
          fullWidth
          multiline
          rows={2}
          label='Motivo'
          placeholder='Prenda dañada'
          value={reason}
          onChange={e => setReason(e.target.value)}
        />
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} color='secondary' disabled={subtractStock.isPending}>
          Volver
        </Button>
        <Button
          onClick={handleConfirm}
          variant='contained'
          color='error'
          disabled={!isValid || subtractStock.isPending}
          startIcon={subtractStock.isPending ? <CircularProgress size={16} /> : undefined}
        >
          {subtractStock.isPending ? 'Dando de baja...' : 'Dar de baja'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default SubtractCentralStockModal
