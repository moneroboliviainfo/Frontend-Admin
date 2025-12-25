import { useState } from 'react'

import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'

import { toast } from 'react-toastify'
import { z } from 'zod'

import CustomTextField from '@core/components/mui/TextField'
import { useSubtractStock } from '@/hooks/useVariants'

const subtractStockSchema = z.object({
  quantity: z.number().positive('La cantidad debe ser mayor a 0'),
  reason: z.string().min(1, 'La razón es obligatoria').trim()
})

type Props = {
  open: boolean
  onClose: () => void
  variants: Array<{
    id: number
    size: { name: string }
    availableStock: number
  }>
  variantId: number
}

const SubtractStockModal = ({ open, onClose, variants }: Props) => {
  const [quantities, setQuantities] = useState<Record<number, number>>({})
  const [reasons, setReasons] = useState<Record<number, string>>({})
  const [errors, setErrors] = useState<Record<number, { quantity?: string; reason?: string }>>({})
  const subtractStock = useSubtractStock()

  const handleQuantityChange = (variantId: number, value: string) => {
    const numValue = parseInt(value) || 0

    setQuantities(prev => ({
      ...prev,
      [variantId]: numValue
    }))

    setErrors(prev => ({
      ...prev,
      [variantId]: {
        ...prev[variantId],
        quantity: undefined
      }
    }))
  }

  const handleReasonChange = (variantId: number, value: string) => {
    setReasons(prev => ({
      ...prev,
      [variantId]: value
    }))

    setErrors(prev => ({
      ...prev,
      [variantId]: {
        ...prev[variantId],
        reason: undefined
      }
    }))
  }

  const handleSubmit = async () => {
    try {
      setErrors({})

      const variantsToUpdate = Object.entries(quantities).filter(([_, qty]) => qty > 0)

      if (variantsToUpdate.length === 0) {
        toast.warning('Ingresa al menos una cantidad mayor a 0')

        return
      }

      let hasErrors = false
      const newErrors: Record<number, { quantity?: string; reason?: string }> = {}

      for (const [variantId, quantity] of variantsToUpdate) {
        const variant = variants.find(v => v.id === Number(variantId))
        const reason = reasons[Number(variantId)]?.trim()

        if (!quantity || quantity === 0) {
          hasErrors = true

          if (!newErrors[Number(variantId)]) {
            newErrors[Number(variantId)] = {}
          }

          newErrors[Number(variantId)].quantity = 'La cantidad es obligatoria'
        }

        try {
          subtractStockSchema.parse({
            quantity,
            reason: reason || ''
          })
        } catch (error) {
          if (error instanceof z.ZodError) {
            hasErrors = true

            if (!newErrors[Number(variantId)]) {
              newErrors[Number(variantId)] = {}
            }

            error.errors.forEach(err => {
              if (err.path[0] === 'quantity') {
                newErrors[Number(variantId)].quantity = err.message
              } else if (err.path[0] === 'reason') {
                newErrors[Number(variantId)].reason = err.message
              }
            })
          }
        }

        if (variant && quantity > variant.availableStock) {
          hasErrors = true

          if (!newErrors[Number(variantId)]) {
            newErrors[Number(variantId)] = {}
          }

          newErrors[Number(variantId)].quantity = `No puede ser mayor al stock disponible (${variant.availableStock})`
        }
      }

      if (hasErrors) {
        setErrors(newErrors)

        return
      }

      for (const [variantId, quantity] of variantsToUpdate) {
        const reason = reasons[Number(variantId)]?.trim()

        const payload = {
          variantId: Number(variantId),
          quantity: -quantity,
          reason: reason!
        }

        await subtractStock.mutateAsync(payload)
      }

      toast.success('Stock reducido exitosamente')
      setQuantities({})
      setReasons({})
      setErrors({})
      await new Promise(resolve => setTimeout(resolve, 300))
      onClose()
    } catch (error) {
      toast.error('Error al quitar stock')
      console.error(error)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth='sm' fullWidth>
      <DialogTitle>
        <Box display='flex' alignItems='center' gap={1}>
          <i className='tabler-package-minus' style={{ fontSize: '1.5rem' }} />
          <span>Quitar Stock</span>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Typography variant='body2' color='text.secondary' sx={{ mb: 3 }}>
          Ingresa la cantidad a quitar para cada talla y la razón (obligatoria)
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {variants.map(variant => (
            <Box
              key={variant.id}
              sx={{
                p: 2,
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  mb: 2
                }}
              >
                <Box sx={{ flex: 1 }}>
                  <Typography variant='subtitle2'>Talla {variant.size.name}</Typography>
                  <Typography variant='caption' color='text.secondary'>
                    Stock actual: {variant.availableStock}
                  </Typography>
                </Box>

                <CustomTextField
                  type='number'
                  size='small'
                  placeholder='0'
                  value={quantities[variant.id] || ''}
                  onChange={e => handleQuantityChange(variant.id, e.target.value)}
                  error={!!errors[variant.id]?.quantity}
                  helperText={errors[variant.id]?.quantity}
                  sx={{
                    width: '120px',
                    '& input[type=number]': {
                      MozAppearance: 'textfield'
                    },
                    '& input[type=number]::-webkit-outer-spin-button, & input[type=number]::-webkit-inner-spin-button':
                      {
                        WebkitAppearance: 'none',
                        margin: 0
                      }
                  }}
                  InputProps={{
                    startAdornment: <i className='tabler-minus' style={{ fontSize: '16px', marginRight: '8px' }} />
                  }}
                />
              </Box>

              <CustomTextField
                fullWidth
                size='small'
                placeholder='Razón *'
                value={reasons[variant.id] || ''}
                onChange={e => handleReasonChange(variant.id, e.target.value)}
                error={!!errors[variant.id]?.reason}
                helperText={errors[variant.id]?.reason}
                sx={{ mt: 1 }}
                required
                InputProps={{
                  startAdornment: <i className='tabler-message' style={{ fontSize: '16px', marginRight: '8px' }} />
                }}
              />
            </Box>
          ))}
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} color='secondary' disabled={subtractStock.isPending}>
          Cancelar
        </Button>
        <Button
          onClick={handleSubmit}
          variant='contained'
          color='error'
          disabled={subtractStock.isPending}
          startIcon={subtractStock.isPending ? <CircularProgress size={16} /> : <i className='tabler-check' />}
        >
          {subtractStock.isPending ? 'Quitando...' : 'Confirmar'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default SubtractStockModal
