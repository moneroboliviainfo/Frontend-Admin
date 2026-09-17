import { useState } from 'react'

import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'

import CustomTextField from '@core/components/mui/TextField'
import { useTransferStock } from '@/hooks/useVariants'
import { useBranchContext } from '@/contexts/BranchContext'
import type { StockTransferDirection } from '@/types/api/variants'

type Props = {
  open: boolean
  onClose: () => void
  variants: Array<{
    id: number
    size: { name: string }
    availableStock: number
    warehouseStock: number
  }>
  showMessage: (message: string, severity: 'success' | 'error' | 'info' | 'warning') => void
}

const TransferStockModal = ({ open, onClose, variants, showMessage }: Props) => {
  const [direction, setDirection] = useState<StockTransferDirection>('warehouse_to_floor')
  const [quantities, setQuantities] = useState<Record<number, number>>({})
  const transferStock = useTransferStock()

  // Solo el ADMIN manda branchId; MANAGER/CASHIER se resuelven solos en el backend
  const { selectedBranchId, isAdmin } = useBranchContext()
  const branchId = isAdmin ? (selectedBranchId ?? undefined) : undefined

  const isToFloor = direction === 'warehouse_to_floor'

  const getMaxStock = (variant: { warehouseStock: number; availableStock: number }) =>
    isToFloor ? variant.warehouseStock : variant.availableStock

  const transferableSizes = variants.filter(v => getMaxStock(v) > 0)

  const handleQuantityChange = (variantId: number, value: string, max: number) => {
    const numValue = Math.min(parseInt(value) || 0, max)

    setQuantities(prev => ({
      ...prev,
      [variantId]: numValue
    }))
  }

  const handleSubmit = async () => {
    try {
      const toTransfer = Object.entries(quantities).filter(([_, qty]) => qty > 0)

      if (toTransfer.length === 0) {
        showMessage('Ingresa al menos una cantidad mayor a 0', 'warning')

        return
      }

      for (const [variantId, quantity] of toTransfer) {
        await transferStock.mutateAsync({
          variantId: Number(variantId),
          quantity,
          direction,
          branchId
        })
      }

      showMessage(isToFloor ? 'Stock enviado a tienda exitosamente' : 'Stock devuelto a bodega exitosamente', 'success')
      setQuantities({})
      await new Promise(resolve => setTimeout(resolve, 300))
      onClose()
    } catch (error: any) {
      showMessage(error?.response?.data?.message || 'Error al mover el stock', 'error')
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth='sm' fullWidth>
      <DialogTitle>
        <Box display='flex' alignItems='center' gap={1}>
          <i className='tabler-transfer' style={{ fontSize: '1.5rem' }} />
          <span>Mover Stock</span>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Typography variant='body2' color='text.secondary' sx={{ mb: 2 }}>
          Mueve stock entre bodega y tienda, por talla
        </Typography>

        <ToggleButtonGroup
          value={direction}
          exclusive
          size='small'
          onChange={(_, newValue) => {
            if (newValue !== null) {
              setDirection(newValue)
              setQuantities({})
            }
          }}
          sx={{
            mb: 3,
            '& .MuiToggleButton-root.Mui-selected': {
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              '&:hover': {
                bgcolor: 'primary.dark'
              }
            }
          }}
        >
          <ToggleButton value='warehouse_to_floor'>Bodega → Tienda</ToggleButton>
          <ToggleButton value='floor_to_warehouse'>Tienda → Bodega</ToggleButton>
        </ToggleButtonGroup>

        {transferableSizes.length === 0 ? (
          <Typography color='text.secondary'>
            No hay stock en {isToFloor ? 'bodega' : 'tienda'} para trasladar
          </Typography>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {transferableSizes.map(variant => (
              <Box
                key={variant.id}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  p: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1
                }}
              >
                <Box sx={{ flex: 1 }}>
                  <Typography variant='subtitle2'>Talla {variant.size.name}</Typography>
                  <Typography variant='caption' color='text.secondary'>
                    Bodega: {variant.warehouseStock} · Tienda: {variant.availableStock}
                  </Typography>
                </Box>

                <CustomTextField
                  type='number'
                  size='small'
                  placeholder='0'
                  value={quantities[variant.id] || ''}
                  onChange={e => handleQuantityChange(variant.id, e.target.value, getMaxStock(variant))}
                  inputProps={{ max: getMaxStock(variant), min: 0 }}
                  sx={{
                    width: '120px',
                    '& input[type=number]': {
                      MozAppearance: 'textfield'
                    },
                    '& input[type=number]::-webkit-outer-spin-button, & input[type=number]::-webkit-inner-spin-button': {
                      WebkitAppearance: 'none',
                      margin: 0
                    }
                  }}
                  InputProps={{
                    startAdornment: <i className='tabler-arrow-right' style={{ fontSize: '16px', marginRight: '8px' }} />
                  }}
                />
              </Box>
            ))}
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} color='secondary' disabled={transferStock.isPending}>
          Cancelar
        </Button>
        <Button
          onClick={handleSubmit}
          variant='contained'
          disabled={transferStock.isPending || transferableSizes.length === 0}
          startIcon={transferStock.isPending ? <CircularProgress size={16} /> : <i className='tabler-check' />}
        >
          {transferStock.isPending ? 'Enviando...' : 'Confirmar'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default TransferStockModal
