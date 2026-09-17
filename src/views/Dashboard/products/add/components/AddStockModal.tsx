import { useState } from 'react'

import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'

import CustomTextField from '@core/components/mui/TextField'
import { useAddStock } from '@/hooks/useVariants'
import { useBranchContext } from '@/contexts/BranchContext'

type Props = {
  open: boolean
  onClose: () => void
  variants: Array<{
    id: number
    size: { name: string }
    warehouseStock: number
  }>
  variantId: number
  showMessage: (message: string, severity: 'success' | 'error' | 'info' | 'warning') => void
}

const AddStockModal = ({ open, onClose, variants, showMessage }: Props) => {
  const [quantities, setQuantities] = useState<Record<number, number>>({})
  const addStock = useAddStock()
  const { selectedBranchId, isAdmin } = useBranchContext()
  const branchId = isAdmin ? (selectedBranchId ?? undefined) : undefined

  const handleQuantityChange = (variantId: number, value: string) => {
    const numValue = parseInt(value) || 0

    setQuantities(prev => ({
      ...prev,
      [variantId]: numValue
    }))
  }

  const handleSubmit = async () => {
    try {
      const variantsToUpdate = Object.entries(quantities).filter(([_, qty]) => qty > 0)

      if (variantsToUpdate.length === 0) {
        showMessage('Ingresa al menos una cantidad mayor a 0', 'warning')

        return
      }

      for (const [variantId, quantity] of variantsToUpdate) {
        await addStock.mutateAsync({
          variantId: Number(variantId),
          quantity,
          branchId
        })
      }

      showMessage('Stock actualizado exitosamente', 'success')
      setQuantities({})
      await new Promise(resolve => setTimeout(resolve, 300))
      onClose()
    } catch (error: any) {
      showMessage(error?.response?.data?.message || 'Error al agregar stock', 'error')
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth='sm' fullWidth>
      <DialogTitle>
        <Box display='flex' alignItems='center' gap={1}>
          <i className='tabler-package' style={{ fontSize: '1.5rem' }} />
          <span>Agregar Stock</span>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Typography variant='body2' color='text.secondary' sx={{ mb: 3 }}>
          Ingresa la cantidad a agregar para cada talla
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {variants.map(variant => (
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
                  En bodega: {variant.warehouseStock}
                </Typography>
              </Box>

              <CustomTextField
                type='number'
                size='small'
                placeholder='0'
                value={quantities[variant.id] || ''}
                onChange={e => handleQuantityChange(variant.id, e.target.value)}
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
                  startAdornment: <i className='tabler-plus' style={{ fontSize: '16px', marginRight: '8px' }} />
                }}
              />
            </Box>
          ))}
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} color='secondary' disabled={addStock.isPending}>
          Cancelar
        </Button>
        <Button
          onClick={handleSubmit}
          variant='contained'
          disabled={addStock.isPending}
          startIcon={addStock.isPending ? <CircularProgress size={16} /> : <i className='tabler-check' />}
        >
          {addStock.isPending ? 'Agregando...' : 'Confirmar'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default AddStockModal
