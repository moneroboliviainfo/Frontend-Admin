'use client'

import { useEffect, useState } from 'react'

import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import Typography from '@mui/material/Typography'
import FormControlLabel from '@mui/material/FormControlLabel'
import Switch from '@mui/material/Switch'
import MenuItem from '@mui/material/MenuItem'
import CircularProgress from '@mui/material/CircularProgress'

import CustomTextField from '@core/components/mui/TextField'
import tableStyles from '@core/styles/table.module.css'
import { useReceiveTransfer } from '@/hooks/useBranchTransfers'
import type { BranchTransfer } from '@/types/api/branchTransfer'
import { itemLabel } from '@/views/Dashboard/central-warehouse/transfers'
import { prendas } from '@/views/Dashboard/central-warehouse/units'

type Props = {
  transfer: BranchTransfer | null
  onClose: () => void
  showMessage: (message: string, severity: 'success' | 'error') => void
}

type Location = 'warehouse' | 'sales_floor'

const ReceiveTransferModal = ({ transfer, onClose, showMessage }: Props) => {
  const [partial, setPartial] = useState(false)
  const [received, setReceived] = useState<Record<number, number>>({})
  const [note, setNote] = useState('')
  const [location, setLocation] = useState<Location>('warehouse')

  const receive = useReceiveTransfer()

  // Hay que mandar TODAS las lineas que salieron: una que falte da 400
  const dispatched = (transfer?.items || []).filter(item => (item.dispatchedQuantity ?? 0) > 0)

  useEffect(() => {
    setPartial(false)
    setNote('')

    // Una reposicion se pide porque falta en la tienda: por defecto entra directo ahi (doc 15 §1.6)
    setLocation(transfer?.replenishment ? 'sales_floor' : 'warehouse')
    setReceived(
      Object.fromEntries(
        (transfer?.items || [])
          .filter(item => (item.dispatchedQuantity ?? 0) > 0)
          .map(item => [item.id, item.dispatchedQuantity ?? 0])
      )
    )
  }, [transfer])

  if (!transfer) return null

  const totalDispatched = dispatched.reduce((sum, item) => sum + (item.dispatchedQuantity ?? 0), 0)
  const totalReceived = dispatched.reduce((sum, item) => sum + (received[item.id] ?? 0), 0)

  const isShort = totalReceived < totalDispatched
  const overDispatched = dispatched.some(item => (received[item.id] ?? 0) > (item.dispatchedQuantity ?? 0))

  // Si llego menos de lo despachado la nota es obligatoria
  const isValid = !overDispatched && (!isShort || !!note.trim())

  const isFromWarehouse = transfer.type === 'central_dispatch'

  const handleConfirm = async () => {
    try {
      await receive.mutateAsync({
        transferId: transfer.id,
        data: {
          items: dispatched.map(item => ({ transferItemId: item.id, quantity: received[item.id] ?? 0 })),
          ...(note.trim() && { note: note.trim() }),

          // Un pedido entre sucursales entra siempre a la tienda: mandar location da 400
          ...(isFromWarehouse && { location })
        }
      })

      showMessage(
        isShort
          ? `Traslado #${transfer.id} recibido con faltantes: queda para que lo revise un administrador`
          : `Traslado #${transfer.id} recibido`,
        'success'
      )
      onClose()
    } catch (error: any) {
      showMessage(error?.response?.data?.message || 'No se pudo recibir', 'error')
    }
  }

  return (
    <Dialog open onClose={onClose} maxWidth='sm' fullWidth>
      <DialogTitle>
        Recibir traslado #{transfer.id}
        <Typography variant='body2' color='text.secondary' sx={{ mt: 1 }}>
          {prendas(totalDispatched)} desde {transfer.sourceBranch?.name || 'la bodega'}
        </Typography>
      </DialogTitle>

      <DialogContent>
        {isFromWarehouse ? (
          <>
            <CustomTextField
              select
              fullWidth
              label='Ingresa a'
              value={location}
              onChange={e => setLocation(e.target.value as Location)}
              sx={{ mb: 3 }}
            >
              <MenuItem value='warehouse'>Bodega de la sucursal (depósito)</MenuItem>
              <MenuItem value='sales_floor'>Tienda (a la venta en el acto)</MenuItem>
            </CustomTextField>
            <Alert severity='info' sx={{ mb: 4 }}>
              {location === 'warehouse'
                ? 'Todo entra al depósito. Para venderlo hay que pasarlo a la tienda desde Inventario → Stock.'
                : 'Todo entra a la tienda y queda a la venta. Si quiere repartir, recíbalo aquí y devuelva el resto a la bodega desde Stock.'}
            </Alert>
          </>
        ) : (
          <Alert severity='info' sx={{ mb: 4 }}>
            Es un pedido: ingresa directamente a la tienda, reservado para su cliente.
          </Alert>
        )}

        <FormControlLabel
          control={<Switch checked={partial} onChange={e => setPartial(e.target.checked)} />}
          label='Llegó una cantidad distinta a la despachada'
          sx={{ mb: 3 }}
        />

        <div className='overflow-x-auto'>
          <table className={tableStyles.table}>
            <thead>
              <tr>
                <th>Prenda</th>
                <th>Despachado</th>
                <th>Recibido</th>
              </tr>
            </thead>
            <tbody>
              {dispatched.map(item => {
                const max = item.dispatchedQuantity ?? 0
                const value = received[item.id] ?? 0

                return (
                  <tr key={item.id}>
                    <td>
                      <Typography variant='body2'>{itemLabel(item)}</Typography>
                    </td>
                    <td>
                      <Typography variant='body2'>{max}</Typography>
                    </td>
                    <td>
                      {partial ? (
                        <CustomTextField
                          type='number'
                          size='small'
                          placeholder='0'
                          value={value || ''}
                          error={value > max}
                          onChange={e =>
                            setReceived(prev => ({ ...prev, [item.id]: parseInt(e.target.value, 10) || 0 }))
                          }
                          sx={{ width: '100px' }}
                          inputProps={{ min: 0, max }}
                        />
                      ) : (
                        <Typography variant='body2' className='font-medium'>
                          {value}
                        </Typography>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {overDispatched && (
          <Alert severity='error' sx={{ mt: 3 }}>
            No se puede recibir más de lo despachado.
          </Alert>
        )}

        {isShort && !overDispatched && (
          <Alert severity='warning' sx={{ mt: 3 }}>
            Faltan {totalDispatched - totalReceived} de {totalDispatched}. El motivo es obligatorio y un administrador
            deberá revisar la diferencia.
          </Alert>
        )}

        {partial && (
          <CustomTextField
            fullWidth
            multiline
            rows={2}
            label={isShort ? 'Motivo' : 'Nota (opcional)'}
            placeholder='Vino una menos'
            value={note}
            onChange={e => setNote(e.target.value)}
            sx={{ mt: 4 }}
          />
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} color='secondary' disabled={receive.isPending}>
          Volver
        </Button>
        <Button
          onClick={handleConfirm}
          variant='contained'
          disabled={!isValid || receive.isPending}
          startIcon={receive.isPending ? <CircularProgress size={16} /> : <i className='tabler-check' />}
        >
          {receive.isPending ? 'Recibiendo...' : isShort ? 'Recibir con faltantes' : 'Recibir todo'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default ReceiveTransferModal
