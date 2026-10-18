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
import { useBranchTransfers, useRefundRequest } from '@/hooks/useBranchTransfers'
import type { BranchTransfer } from '@/types/api/branchTransfer'

const money = (value: string | null) => `Bs ${Number(value ?? 0).toFixed(2)}`

const formatDate = (value: string | null) => (value ? new Date(value).toLocaleString('es-BO') : '—')

// El back calcula el motivo; acá se traduce el estado a algo que el cajero
// pueda explicarle al cliente
const reasonFor = (transfer: BranchTransfer) => {
  if (transfer.status === 'not_found') return 'La otra sucursal no tenía la prenda'
  if (transfer.status === 'cancelled') return 'El pedido se anuló'
  if (transfer.status === 'lost') return 'El pedido se perdió en el camino'

  return 'Llegó menos de lo pedido'
}

const RefundsTable = () => {
  const [target, setTarget] = useState<BranchTransfer | null>(null)
  const [note, setNote] = useState('')
  const [snackbar, setSnackbar] = useState<{ message: string; severity: 'success' | 'error' } | null>(null)

  const refund = useRefundRequest()

  const { data, isLoading, isError } = useBranchTransfers({ pendingRefund: true })

  const transfers = data?.data || []

  const handleRefund = async () => {
    if (!target) return

    try {
      await refund.mutateAsync({ transferId: target.id, data: note.trim() ? { note: note.trim() } : {} })
      setSnackbar({ message: `Se devolvieron ${money(target.refundPending)} del pedido #${target.id}`, severity: 'success' })
      setTarget(null)
      setNote('')
    } catch (error: any) {
      setSnackbar({ message: error?.response?.data?.message || 'No se pudo devolver', severity: 'error' })
    }
  }

  return (
    <>
      <Card>
        <CardHeader
          title='Devoluciones'
          subheader='Adelantos que hay que devolverle al cliente. Se devuelven en efectivo desde la caja.'
        />

        <Divider />

        {isError ? (
          <Box sx={{ p: 4 }}>
            <Alert severity='error'>Error al cargar las devoluciones.</Alert>
          </Box>
        ) : isLoading ? (
          <Box sx={{ p: 6 }}>
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} height={48} sx={{ mb: 1 }} />
            ))}
          </Box>
        ) : transfers.length === 0 ? (
          <Box sx={{ p: 8, textAlign: 'center' }}>
            <Typography color='text.secondary'>No hay devoluciones pendientes</Typography>
          </Box>
        ) : (
          <div className='overflow-x-auto'>
            <table className={tableStyles.table}>
              <thead>
                <tr>
                  <th>Pedido</th>
                  <th>Cliente</th>
                  <th>Motivo</th>
                  <th>Pagó</th>
                  <th>A devolver</th>
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
                        {formatDate(transfer.advancePaidAt)}
                      </Typography>
                    </td>
                    <td>
                      <Typography variant='body2'>{transfer.customerName || 'Sin nombre'}</Typography>
                      {transfer.customerPhone && (
                        <Typography variant='caption' color='text.secondary' sx={{ display: 'block' }}>
                          {transfer.customerPhone}
                        </Typography>
                      )}
                      {transfer.customerCi && (
                        <Typography variant='caption' color='text.secondary' sx={{ display: 'block' }}>
                          CI {transfer.customerCi}
                        </Typography>
                      )}
                    </td>
                    <td>
                      <Typography variant='body2'>{reasonFor(transfer)}</Typography>
                    </td>
                    <td>
                      <Typography variant='body2'>{money(transfer.advanceAmount)}</Typography>
                    </td>
                    <td>
                      <Chip label={money(transfer.refundPending)} color='error' variant='tonal' />
                    </td>
                    <td>
                      <Button
                        variant='contained'
                        size='small'
                        startIcon={<i className='tabler-cash' />}
                        onClick={() => setTarget(transfer)}
                      >
                        Devolver
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
        <DialogTitle>Devolver {money(target?.refundPending || null)}</DialogTitle>

        <DialogContent>
          <Alert severity='warning' sx={{ mb: 4 }}>
            Entregue <strong>{money(target?.refundPending || null)}</strong> en efectivo a{' '}
            {target?.customerName || 'el cliente'} y recién entonces confirme. Sale de la caja de su sucursal, que
            debe estar abierta.
          </Alert>

          <CustomTextField
            fullWidth
            multiline
            rows={2}
            label='Nota (opcional)'
            placeholder='Se le devolvió en efectivo'
            value={note}
            onChange={e => setNote(e.target.value)}
          />
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setTarget(null)} color='secondary' disabled={refund.isPending}>
            Volver
          </Button>
          <Button
            onClick={handleRefund}
            variant='contained'
            disabled={refund.isPending}
            startIcon={refund.isPending ? <CircularProgress size={16} /> : <i className='tabler-check' />}
          >
            {refund.isPending ? 'Registrando...' : 'Confirmar devolución'}
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

export default RefundsTable
