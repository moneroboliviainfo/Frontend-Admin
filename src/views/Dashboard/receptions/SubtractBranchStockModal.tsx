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
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import CircularProgress from '@mui/material/CircularProgress'

import CustomTextField from '@core/components/mui/TextField'
import { useSubtractStock } from '@/hooks/useVariants'
import type { StockLocation } from '@/types/api/variants'

export type SubtractTarget = {
  variantSizeId: number
  label: string
  availableStock: number
  warehouseStock: number
}

type Props = {
  target: SubtractTarget | null
  onClose: () => void
  showMessage: (message: string, severity: 'success' | 'error') => void
}

const SubtractBranchStockModal = ({ target, onClose, showMessage }: Props) => {
  const [location, setLocation] = useState<StockLocation>('sales_floor')
  const [quantity, setQuantity] = useState('')
  const [reason, setReason] = useState('')

  const subtractStock = useSubtractStock()

  useEffect(() => {
    setLocation('sales_floor')
    setQuantity('')
    setReason('')
  }, [target])

  if (!target) return null

  const max = location === 'sales_floor' ? target.availableStock : target.warehouseStock
  const parsed = parseInt(quantity, 10) || 0
  const overStock = parsed > max
  const isValid = parsed > 0 && !overStock && !!reason.trim()

  const handleConfirm = async () => {
    try {
      await subtractStock.mutateAsync({
        variantId: target.variantSizeId,

        // El back espera la cantidad en negativo
        quantity: -parsed,
        reason: reason.trim(),
        location
      })

      showMessage(`Se dieron de baja ${parsed} de ${location === 'sales_floor' ? 'la tienda' : 'el depósito'}`, 'success')
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
          La prenda <strong>se descuenta</strong> del stock de forma definitiva. Corresponde a mercadería dañada o
          perdida, no a un cambio de ubicación.
        </Alert>

        <Typography variant='body2' className='font-medium'>
          {target.label}
        </Typography>

        <ToggleButtonGroup
          exclusive
          fullWidth
          size='small'
          value={location}
          onChange={(_, value) => value && setLocation(value)}
          sx={{ my: 3 }}
        >
          <ToggleButton value='sales_floor'>Tienda ({target.availableStock})</ToggleButton>
          <ToggleButton value='warehouse'>Depósito ({target.warehouseStock})</ToggleButton>
        </ToggleButtonGroup>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <CustomTextField
            fullWidth
            type='number'
            label='Cantidad'
            placeholder='0'
            value={quantity}
            onChange={e => setQuantity(e.target.value)}
            error={overStock}
            helperText={overStock ? `Solo hay ${max}` : ''}
            inputProps={{ min: 1, max }}
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
        </Box>
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

export default SubtractBranchStockModal
