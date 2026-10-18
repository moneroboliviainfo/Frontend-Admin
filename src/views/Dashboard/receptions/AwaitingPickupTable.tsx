'use client'

import { useState } from 'react'

import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Skeleton from '@mui/material/Skeleton'
import Alert from '@mui/material/Alert'
import Snackbar from '@mui/material/Snackbar'
import CircularProgress from '@mui/material/CircularProgress'

import CustomTextField from '@core/components/mui/TextField'
import tableStyles from '@core/styles/table.module.css'
import { useBranchTransfers, useMarkPickup } from '@/hooks/useBranchTransfers'
import type { BranchTransfer, BranchTransferItem } from '@/types/api/branchTransfer'

const itemLabel = (item: BranchTransferItem) => {
  const productColor = item.variant?.productColor

  return `${productColor?.product?.name || 'Producto'} · ${productColor?.color?.name || ''} · Talla ${
    item.variant?.size?.name || ''
  }`
}

// Los plazos los fija el back al recibir: no se recalculan desde receivedAt
const formatDay = (value: string | null) => (value ? new Date(value).toLocaleDateString('es-BO') : '—')

const AwaitingPickupTable = () => {
  const [target, setTarget] = useState<BranchTransfer | null>(null)
  const [note, setNote] = useState('')
  const [snackbar, setSnackbar] = useState<{ message: string; severity: 'success' | 'error' } | null>(null)

  const markPickup = useMarkPickup()

  const { data, isLoading, isError } = useBranchTransfers({ awaitingPickup: true })

  const transfers = data?.data || []

  const handleNotPickedUp = async () => {
    if (!target) return

    try {
      await markPickup.mutateAsync({
        transferId: target.id,
        data: { status: 'not_picked_up', ...(note.trim() && { note: note.trim() }) }
      })

      setSnackbar({ message: `Pedido #${target.id} marcado como no retirado`, severity: 'success' })
      setTarget(null)
      setNote('')
    } catch (error: any) {
      setSnackbar({ message: error?.response?.data?.message || 'No se pudo marcar', severity: 'error' })
    }
  }

  return (
    <>
      <Card>
        <CardHeader
          title='Pedidos recibidos'
          subheader='Pedidos recibidos y apartados a la espera de su cliente. Verifique el documento antes de entregar.'
        />

        <Divider />

        {isError ? (
          <Box sx={{ p: 4 }}>
            <Alert severity='error'>Error al cargar los pedidos.</Alert>
          </Box>
        ) : isLoading ? (
          <Box sx={{ p: 6 }}>
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} height={48} sx={{ mb: 1 }} />
            ))}
          </Box>
        ) : transfers.length === 0 ? (
          <Box sx={{ p: 8, textAlign: 'center' }}>
            <Typography color='text.secondary'>No hay pedidos esperando</Typography>
          </Box>
        ) : (
          <div className='overflow-x-auto'>
            <table className={tableStyles.table}>
              <thead>
                <tr>
                  <th>Pedido</th>
                  <th>Cliente</th>
                  <th>Prendas</th>
                  <th>Plazos</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {transfers.map(transfer => (
                  <tr key={transfer.id}>
                    <td>
                      <Typography variant='body2' className='font-medium'>
                        #{transfer.id}
                      </Typography>
                      <Typography variant='caption' color='text.secondary'>
                        de {transfer.sourceBranch?.name || '—'}
                      </Typography>
                    </td>
                    <td>
                      <Typography variant='body2'>{transfer.customerName || 'Sin nombre'}</Typography>
                      {transfer.customerPhone && (
                        <Typography variant='caption' color='text.secondary' sx={{ display: 'block' }}>
                          {transfer.customerPhone}
                        </Typography>
                      )}
                      {/* El CI se pide para cotejar el documento al momento del retiro */}
                      {transfer.customerCi && (
                        <Typography variant='caption' color='text.secondary' sx={{ display: 'block' }}>
                          CI {transfer.customerCi}
                        </Typography>
                      )}
                    </td>
                    <td>
                      {transfer.items.map(item => (
                        <Typography key={item.id} variant='body2'>
                          {item.receivedQuantity ?? item.quantity} × {itemLabel(item)}
                        </Typography>
                      ))}
                    </td>
                    <td>
                      <Chip
                        label={`Retira hasta ${formatDay(transfer.pickupDeadline)}`}
                        size='small'
                        variant='tonal'
                        color='warning'
                      />
                      <Typography variant='caption' color='text.secondary' sx={{ display: 'block', mt: 1 }}>
                        Apartado hasta {formatDay(transfer.holdUntil)}
                      </Typography>
                    </td>
                    <td>
                      <Button size='small' color='secondary' onClick={() => setTarget(transfer)}>
                        No retirado
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Dialog open={!!target} onClose={() => setTarget(null)} maxWidth='xs' fullWidth>
        <DialogTitle>Marcar como no retirado</DialogTitle>

        <DialogContent>
          <Alert severity='warning' sx={{ mb: 4 }}>
            La prenda <strong>deja de estar apartada</strong> para {target?.customerName || 'el cliente'} y vuelve
            a estar disponible para la venta. Esta acción no se puede deshacer.
          </Alert>

          <CustomTextField
            fullWidth
            multiline
            rows={2}
            label='Motivo (opcional)'
            placeholder='El cliente desistió del pedido'
            value={note}
            onChange={e => setNote(e.target.value)}
          />
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setTarget(null)} color='secondary' disabled={markPickup.isPending}>
            Volver
          </Button>
          <Button
            onClick={handleNotPickedUp}
            variant='contained'
            color='error'
            disabled={markPickup.isPending}
            startIcon={markPickup.isPending ? <CircularProgress size={16} /> : undefined}
          >
            {markPickup.isPending ? 'Marcando...' : 'Confirmar'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!snackbar}
        autoHideDuration={5000}
        onClose={() => setSnackbar(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={snackbar?.severity} onClose={() => setSnackbar(null)} variant='filled'>
          {snackbar?.message}
        </Alert>
      </Snackbar>
    </>
  )
}

export default AwaitingPickupTable
