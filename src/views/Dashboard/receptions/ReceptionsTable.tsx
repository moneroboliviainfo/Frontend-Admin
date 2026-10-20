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
import MenuItem from '@mui/material/MenuItem'
import TablePagination from '@mui/material/TablePagination'
import Skeleton from '@mui/material/Skeleton'
import Alert from '@mui/material/Alert'
import Snackbar from '@mui/material/Snackbar'
import CircularProgress from '@mui/material/CircularProgress'

import CustomTextField from '@core/components/mui/TextField'
import tableStyles from '@core/styles/table.module.css'
import { useBranchTransfers, useCancelTransfer, useTransferCount } from '@/hooks/useBranchTransfers'
import type { BranchTransfer } from '@/types/api/branchTransfer'
import { transferUnits } from '@/views/Dashboard/central-warehouse/transfers'
import { prendas, variantes } from '@/views/Dashboard/central-warehouse/units'
import RequestQrDialog from '@/views/Dashboard/sales/instore/components/RequestQrDialog'
import ReceiveTransferModal from './ReceiveTransferModal'

// El listado acepta un solo status por consulta: el filtro cambia la vista, no acumula
type IncomingStatus = 'in_transit' | 'received' | 'pending_dispatch' | 'pending_payment' | 'not_found'

// La misma tabla sirve a dos menus: lo que manda la central (Inventario) y lo que la
// tienda pidio a otra (Pedidos entre sucursales). Cada uno ve solo su tipo y sus estados
type Kind = 'central' | 'requests'

const config: Record<
  Kind,
  {
    type: 'central_dispatch' | 'branch_request'
    title: string
    subheader: string
    statuses: [IncomingStatus, string][]
  }
> = {
  central: {
    type: 'central_dispatch',
    title: 'Envíos de la central',
    subheader:
      'Lo que manda la bodega central, incluidas las reposiciones atendidas. Hasta que se reciba no figura en el stock.',
    statuses: [
      ['in_transit', 'En camino'],
      ['received', 'Recibidos']
    ]
  },
  requests: {
    type: 'branch_request',
    title: 'Mis pedidos',
    subheader: 'Lo que esta sucursal le pidió a otras para un cliente.',
    statuses: [
      ['in_transit', 'En camino'],
      ['pending_dispatch', 'Todavía no lo envían'],
      ['pending_payment', 'Esperando el pago'],
      ['not_found', 'No lo tenían']
    ]
  }
}

const formatDate = (value: string | null) => (value ? new Date(value).toLocaleString('es-BO') : '—')

const ReceptionsTable = ({ kind }: { kind: Kind }) => {
  const settings = config[kind]

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [status, setStatus] = useState<IncomingStatus>('in_transit')
  const [toReceive, setToReceive] = useState<BranchTransfer | null>(null)
  const [toCancel, setToCancel] = useState<BranchTransfer | null>(null)
  const [cancelNote, setCancelNote] = useState('')
  const [qrTransferId, setQrTransferId] = useState<number | null>(null)
  const [snackbar, setSnackbar] = useState<{ message: string; severity: 'success' | 'error' } | null>(null)

  const cancelTransfer = useCancelTransfer()

  // MANAGER/CASHIER no mandan branchId: el back resuelve su sucursal
  const { data, isLoading, isError } = useBranchTransfers({
    page,
    limit: pageSize,
    direction: 'incoming',
    type: settings.type,
    status
  })

  // pending-count suma envios y pedidos en toReceive: se cuenta solo el tipo de esta tabla
  const inTransitCount = useTransferCount({ direction: 'incoming', type: settings.type, status: 'in_transit' })

  const transfers = data?.data || []
  const total = data?.meta?.total || 0

  const handleCancel = async () => {
    if (!toCancel) return

    try {
      await cancelTransfer.mutateAsync({
        transferId: toCancel.id,
        data: cancelNote.trim() ? { note: cancelNote.trim() } : {}
      })

      setSnackbar({ message: `Pedido #${toCancel.id} anulado`, severity: 'success' })
      setToCancel(null)
      setCancelNote('')
    } catch (error: any) {
      setSnackbar({ message: error?.response?.data?.message || 'No se pudo anular', severity: 'error' })
    }
  }

  const emptyMessage = {
    in_transit: 'No hay mercadería en camino',
    received: 'Todavía no se recibió nada de la central',
    pending_dispatch: 'No hay pedidos esperando que los envíen',
    pending_payment: 'No hay pedidos esperando el pago',
    not_found: 'Ningún pedido quedó sin conseguir'
  }[status]

  const isRequested = status === 'pending_dispatch' || status === 'pending_payment'

  return (
    <>
      <Card>
        <CardHeader
          title={settings.title}
          subheader={settings.subheader}
          action={
            inTransitCount > 0 ? (
              <Chip label={`${inTransitCount} en camino`} color='primary' variant='tonal' />
            ) : undefined
          }
        />

        <Box className='flex flex-wrap justify-end gap-4 px-6 pb-4'>
          <CustomTextField
            select
            label='Estado'
            value={status}
            onChange={e => {
              setStatus(e.target.value as IncomingStatus)
              setPage(1)
            }}
            className='max-sm:is-full sm:is-[240px]'
          >
            {settings.statuses.map(([value, label]) => (
              <MenuItem key={value} value={value}>
                {label}
              </MenuItem>
            ))}
          </CustomTextField>
        </Box>

        {status === 'pending_payment' && (
          <Box sx={{ px: 6, pb: 4 }}>
            <Alert severity='info'>
              Pedidos con QR que el cliente todavía no pagó. La prenda está apartada solo hasta que venza el QR.
            </Alert>
          </Box>
        )}

        {status === 'not_found' && (
          <Box sx={{ px: 6, pb: 4 }}>
            <Alert severity='warning'>
              La otra sucursal no tenía estas prendas. Informe al cliente que su pedido no pudo completarse.
            </Alert>
          </Box>
        )}

        <Divider />

        {isError ? (
          <Box sx={{ p: 4 }}>
            <Alert severity='error'>Error al cargar las recepciones.</Alert>
          </Box>
        ) : isLoading ? (
          <Box sx={{ p: 6 }}>
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} height={48} sx={{ mb: 1 }} />
            ))}
          </Box>
        ) : transfers.length === 0 ? (
          <Box sx={{ p: 8, textAlign: 'center' }}>
            <Typography color='text.secondary'>{emptyMessage}</Typography>
          </Box>
        ) : (
          <div className='overflow-x-auto'>
            <table className={tableStyles.table}>
              <thead>
                <tr>
                  <th>{kind === 'central' ? 'Envío' : 'Pedido'}</th>
                  <th>Viene de</th>
                  <th>{status === 'received' ? 'Lo recibió' : isRequested ? 'Lo pidió' : 'Lo envió'}</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {transfers.map(transfer => {
                  const units = transferUnits(transfer)

                  const actor =
                    status === 'received'
                      ? { at: transfer.receivedAt, by: transfer.receivedBy }
                      : isRequested
                        ? { at: transfer.requestedAt, by: transfer.requestedBy }
                        : { at: transfer.dispatchedAt, by: transfer.dispatchedBy }

                  return (
                    <tr key={transfer.id}>
                      <td>
                        <Box className='flex items-center gap-2'>
                          <Typography variant='body2' className='font-medium'>
                            #{transfer.id}
                          </Typography>
                          {transfer.replenishment && (
                            <Chip label='Reposición' size='small' variant='outlined' color='secondary' />
                          )}
                        </Box>
                        <Typography variant='caption' color='text.secondary'>
                          {prendas(units)} en {variantes(transfer.items.length)}
                        </Typography>
                      </td>
                      <td>
                        <Typography variant='body2'>{transfer.sourceBranch?.name || 'Bodega central'}</Typography>
                      </td>
                      <td>
                        <Typography variant='body2'>{formatDate(actor.at)}</Typography>
                        <Typography variant='caption' color='text.secondary'>
                          {actor.by?.name || '—'}
                        </Typography>
                      </td>
                      <td>
                        {status === 'in_transit' && (
                          <Button
                            variant='contained'
                            size='small'
                            startIcon={<i className='tabler-package-import' />}
                            onClick={() => setToReceive(transfer)}
                          >
                            Recibir
                          </Button>
                        )}
                        {status === 'pending_dispatch' && (
                          <Button size='small' color='secondary' onClick={() => setToCancel(transfer)}>
                            Anular
                          </Button>
                        )}
                        {status === 'pending_payment' && (
                          <Button
                            size='small'
                            variant='tonal'
                            startIcon={<i className='tabler-qrcode' />}
                            onClick={() => setQrTransferId(transfer.id)}
                          >
                            Ver QR
                          </Button>
                        )}
                        {status === 'not_found' && (
                          <Typography variant='body2' color='text.secondary'>
                            {transfer.notFoundNote || 'Sin detalle'}
                          </Typography>
                        )}
                        {status === 'received' && (
                          <Typography variant='body2' color='text.secondary'>
                            {transfer.receiveNote || '—'}
                          </Typography>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <Divider />

        <TablePagination
          component='div'
          count={total}
          page={page - 1}
          onPageChange={(_, newPage) => setPage(newPage + 1)}
          rowsPerPage={pageSize}
          onRowsPerPageChange={e => {
            setPageSize(parseInt(e.target.value, 10))
            setPage(1)
          }}
          rowsPerPageOptions={[10, 25, 50]}
          labelRowsPerPage='Filas por página'
        />
      </Card>

      <RequestQrDialog
        transferId={qrTransferId}
        onClose={() => setQrTransferId(null)}
        showMessage={(message, severity) => setSnackbar({ message, severity })}
      />

      <ReceiveTransferModal
        transfer={toReceive}
        onClose={() => setToReceive(null)}
        showMessage={(message, severity) => setSnackbar({ message, severity })}
      />

      <Dialog open={!!toCancel} onClose={() => setToCancel(null)} maxWidth='xs' fullWidth>
        <DialogTitle>Anular pedido #{toCancel?.id}</DialogTitle>

        <DialogContent>
          <Alert severity='info' sx={{ mb: 4 }}>
            La prenda vuelve a estar a la venta en {toCancel?.sourceBranch?.name || 'la otra sucursal'}. Solo se puede
            anular mientras no la hayan enviado.
          </Alert>

          <CustomTextField
            fullWidth
            multiline
            rows={2}
            label='Motivo (opcional)'
            placeholder='El cliente desistió del pedido'
            value={cancelNote}
            onChange={e => setCancelNote(e.target.value)}
          />
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setToCancel(null)} color='secondary' disabled={cancelTransfer.isPending}>
            Volver
          </Button>
          <Button
            onClick={handleCancel}
            variant='contained'
            color='error'
            disabled={cancelTransfer.isPending}
            startIcon={cancelTransfer.isPending ? <CircularProgress size={16} /> : undefined}
          >
            {cancelTransfer.isPending ? 'Anulando...' : 'Anular pedido'}
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

export default ReceptionsTable
