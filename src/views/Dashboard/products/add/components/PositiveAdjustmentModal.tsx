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
import { useBranchContext } from '@/contexts/BranchContext'
import { usePositiveAdjustment } from '@/hooks/useVariants'
import type { StockLocation } from '@/types/api/variants'

type Props = {
  open: boolean
  onClose: () => void
  variants: Array<{
    id: number
    size: { name: string }

    // Stock actual de la TIENDA, como referencia. Opcional: desde Bodega
    // Central no se conoce (la tabla muestra el stock de la bodega), y poner
    // esos numeros ahi seria mentir sobre lo que se esta ajustando.
    availableStock?: number
    warehouseStock?: number
  }>

  // Unidades ya descontadas por pedidos sin despachar que siguen en el local:
  // al contar aparecen, asi que lo esperado es stock + esto. Sin el aviso el
  // cajero las toma por sobrante y se infla el stock.
  pendingDispatchSalesFloor?: number
  pendingDispatchWarehouse?: number
  showMessage: (message: string, severity: 'success' | 'error' | 'info' | 'warning') => void
}

const PositiveAdjustmentModal = ({
  open,
  onClose,
  variants,
  pendingDispatchSalesFloor = 0,
  pendingDispatchWarehouse = 0,
  showMessage
}: Props) => {
  // Por defecto la bodega: lo que aparece contando suele estar guardado
  const [location, setLocation] = useState<StockLocation>('warehouse')
  const [quantities, setQuantities] = useState<Record<number, number>>({})
  const [note, setNote] = useState('')

  const adjust = usePositiveAdjustment()

  // Solo el ADMIN manda branchId; la bodega central no acepta este endpoint (403)
  const { selectedBranchId, isAdmin } = useBranchContext()
  const branchId = isAdmin ? (selectedBranchId ?? undefined) : undefined

  useEffect(() => {
    if (!open) {
      setLocation('warehouse')
      setQuantities({})
      setNote('')
    }
  }, [open])

  const entries = Object.entries(quantities).filter(([, quantity]) => quantity > 0)
  const isValid = entries.length > 0 && !!note.trim()

  const handleConfirm = async () => {
    const failed: Record<number, number> = {}
    let added = 0

    for (const [variantId, quantity] of entries) {
      try {
        await adjust.mutateAsync({
          variantId: Number(variantId),
          quantity,
          location,
          note: note.trim(),
          branchId
        })
        added += quantity
      } catch {
        failed[Number(variantId)] = quantity
      }
    }

    setQuantities(failed)

    if (Object.keys(failed).length === 0) {
      showMessage(`Se registraron ${added} unidades encontradas`, 'success')
      onClose()
    } else {
      showMessage(`${Object.keys(failed).length} no se pudieron registrar`, 'error')
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth='sm' fullWidth>
      <DialogTitle>Ajuste de stock</DialogTitle>

      <DialogContent>
        {/* El pedido sale primero del deposito y solo lo que falta del piso:
            por eso el aviso es por ubicacion, no uno solo. */}
        {(location === 'warehouse' ? pendingDispatchWarehouse : pendingDispatchSalesFloor) > 0 && (
          <Alert severity='warning' sx={{ mb: 4 }}>
            <strong>
              {location === 'warehouse' ? pendingDispatchWarehouse : pendingDispatchSalesFloor} por despachar
            </strong>{' '}
            siguen en el local: ya se descontaron del stock pero no se enviaron. Súmelas a lo que espera contar
            antes de registrar un sobrante.
          </Alert>
        )}

        <ToggleButtonGroup
          exclusive
          fullWidth
          size='small'
          value={location}
          onChange={(_, value) => value && setLocation(value)}
          sx={{
            mb: 4,

            // Color entero en el elegido, en el color de la sucursal: con el
            // tintado por defecto costaba ver cuál de los dos estaba activo.
            '& .MuiToggleButton-root': {
              textTransform: 'none',
              fontWeight: 600,
              paddingBlock: '10px',
              '&.Mui-selected': {
                backgroundColor: 'primary.main',
                color: 'primary.contrastText',
                '&:hover': { backgroundColor: 'primary.dark' }
              }
            }
          }}
        >
          <ToggleButton value='warehouse'>Ingresar en bodega</ToggleButton>
          <ToggleButton value='sales_floor'>Ingresar en tienda</ToggleButton>
        </ToggleButtonGroup>

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
                borderColor: quantities[variant.id] ? 'success.main' : 'divider',
                borderRadius: 1
              }}
            >
              <Box sx={{ flex: 1 }}>
                <Typography variant='body2' className='font-medium'>
                  Talla {variant.size.name}
                </Typography>
                {variant.availableStock !== undefined && (
                  <Typography variant='caption' color='text.secondary'>
                    Tienda: {variant.availableStock} · Depósito: {variant.warehouseStock}
                  </Typography>
                )}
              </Box>
              <CustomTextField
                type='number'
                size='small'
                placeholder='0'
                value={quantities[variant.id] || ''}
                onChange={e => setQuantities(prev => ({ ...prev, [variant.id]: parseInt(e.target.value, 10) || 0 }))}
                sx={{ width: '100px' }}
                inputProps={{ min: 0 }}
              />
            </Box>
          ))}
        </Box>

        <CustomTextField
          fullWidth
          multiline
          rows={2}
          label='Motivo'
          placeholder='Conteo de fin de mes'
          value={note}
          onChange={e => setNote(e.target.value)}
          sx={{ mt: 4 }}
        />
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} color='secondary' disabled={adjust.isPending}>
          Volver
        </Button>
        <Button
          onClick={handleConfirm}
          variant='contained'
          color='success'
          disabled={!isValid || adjust.isPending}
          startIcon={adjust.isPending ? <CircularProgress size={16} /> : <i className='tabler-check' />}
        >
          {adjust.isPending ? 'Registrando...' : 'Registrar sobrante'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default PositiveAdjustmentModal
