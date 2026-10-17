'use client'

import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import Typography from '@mui/material/Typography'

import tableStyles from '@core/styles/table.module.css'
import type { BranchTransfer, ReviewOutcome } from '@/types/api/branchTransfer'
import { missingUnits } from './transfers'
import { prendas, variantes } from './units'

type Props = {
  transfer: BranchTransfer | null
  onClose: () => void
  onAction: (kind: 'cancel' | 'mark-lost' | 'review') => void
}

const statusLabels: Record<string, { label: string; color: 'primary' | 'success' | 'error' | 'warning' | 'secondary' }> =
  {
    pending_payment: { label: 'Esperando pago', color: 'warning' },
    pending_dispatch: { label: 'Por despachar', color: 'warning' },
    in_transit: { label: 'En camino', color: 'primary' },
    not_found: { label: 'No encontrado', color: 'error' },
    received: { label: 'Recibido', color: 'success' },
    lost: { label: 'Perdido', color: 'error' },
    cancelled: { label: 'Anulado', color: 'secondary' }
  }

const reviewLabels: Record<ReviewOutcome, string> = {
  lost: 'Se perdió',
  found_at_destination: 'Apareció en el destino',
  found_at_origin: 'Apareció en la bodega'
}

const formatDate = (value: string | null) => (value ? new Date(value).toLocaleString('es-BO') : '—')

type TimelineEvent = {
  key: string
  title: string
  icon: string
  color: 'primary' | 'success' | 'error' | 'secondary'
  who: string
  when: string | null
  note: string | null
}

// Cada accion deja su nota en un campo propio del traslado
const timeline = (transfer: BranchTransfer): TimelineEvent[] =>
  (
    [
      {
        key: 'dispatched',
        title: 'Despachado desde la bodega',
        icon: 'tabler-truck-delivery',
        color: 'primary',
        who: transfer.dispatchedBy?.name || '—',
        when: transfer.dispatchedAt,
        note: transfer.note
      },
      {
        key: 'received',
        title: 'Recibido en la sucursal',
        icon: 'tabler-package-import',
        color: 'success',
        who: transfer.receivedBy?.name || '—',
        when: transfer.receivedAt,
        note: transfer.receiveNote
      },
      {
        key: 'cancelled',
        title: 'Anulado · todo volvió a la bodega',
        icon: 'tabler-arrow-back-up',
        color: 'secondary',
        who: transfer.cancelledBy?.name || '—',
        when: transfer.cancelledAt,
        note: transfer.cancelNote
      },
      {
        key: 'lost',
        title: 'Marcado perdido',
        icon: 'tabler-alert-triangle',
        color: 'error',
        who: transfer.lostBy?.name || '—',
        when: transfer.lostAt,
        note: transfer.lostNote
      }
    ] as TimelineEvent[]
  ).filter(event => event.when)

const TransferDetailsModal = ({ transfer, onClose, onAction }: Props) => {
  if (!transfer) return null

  const status = statusLabels[transfer.status] || { label: transfer.status, color: 'secondary' as const }
  const units = transfer.items.reduce((sum, item) => sum + item.quantity, 0)
  const pendingReview = transfer.discrepancyStatus === 'pending_review'
  const events = timeline(transfer)

  return (
    <Dialog open onClose={onClose} maxWidth='md' fullWidth>
      <DialogTitle>
        <Box className='flex flex-wrap items-center gap-3'>
          <span>Envío #{transfer.id}</span>
          <Chip label={status.label} size='small' variant='tonal' color={status.color} />
          {pendingReview && <Chip label='Faltantes por revisar' size='small' variant='tonal' color='warning' />}
        </Box>
        <Typography variant='body2' color='text.secondary' sx={{ mt: 1 }}>
          {prendas(units)} en {variantes(transfer.items.length)} · hacia{' '}
          {transfer.destinationBranch?.name || 'la sucursal'}
        </Typography>
      </DialogTitle>

      <DialogContent>
        <div className='overflow-x-auto'>
          <table className={tableStyles.table}>
            <thead>
              <tr>
                <th>Prenda</th>
                <th>Enviado</th>
                <th>Recibido</th>
                <th>Faltante</th>
              </tr>
            </thead>
            <tbody>
              {transfer.items.map(item => {
                const missing = missingUnits(item, transfer.status)
                const productColor = item.variant?.productColor

                return (
                  <tr key={item.id}>
                    <td>
                      <Box className='flex items-center gap-2'>
                        <Box
                          sx={{
                            width: 14,
                            height: 14,
                            borderRadius: '50%',
                            bgcolor: productColor?.color?.code || '#000',
                            border: '1px solid',
                            borderColor: 'divider',
                            flexShrink: 0
                          }}
                        />
                        <Box>
                          <Typography variant='body2' className='font-medium'>
                            {productColor?.product?.name || 'Producto'}
                          </Typography>
                          <Typography variant='caption' color='text.secondary'>
                            {productColor?.color?.name} · Talla {item.variant?.size?.name}
                          </Typography>
                        </Box>
                      </Box>
                    </td>
                    <td>
                      <Typography variant='body2'>{item.quantity}</Typography>
                    </td>
                    <td>
                      <Typography variant='body2' color={item.receivedQuantity === null ? 'text.secondary' : 'inherit'}>
                        {item.receivedQuantity ?? '—'}
                      </Typography>
                    </td>
                    <td>
                      {missing > 0 ? (
                        <Box>
                          <Chip
                            label={item.reviewOutcome ? reviewLabels[item.reviewOutcome] : `Faltan ${missing}`}
                            size='small'
                            variant='tonal'
                            color={item.reviewOutcome ? 'secondary' : 'warning'}
                          />
                          {item.reviewNote && (
                            <Typography variant='caption' color='text.secondary' sx={{ display: 'block', mt: 1 }}>
                              {item.reviewNote}
                            </Typography>
                          )}
                        </Box>
                      ) : (
                        <Typography variant='body2' color='text.secondary'>
                          —
                        </Typography>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <Divider sx={{ my: 5 }} />

        <Typography variant='body2' className='font-medium' sx={{ mb: 4 }}>
          Historial
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {events.map((event, index) => (
            <Box key={event.key} sx={{ display: 'flex', gap: 3 }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <Box
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: `${event.color}.lightOpacity`,
                    color: `${event.color}.main`,
                    flexShrink: 0
                  }}
                >
                  <i className={event.icon} />
                </Box>
                {index < events.length - 1 && <Box sx={{ width: '2px', flex: 1, bgcolor: 'divider', mt: 1 }} />}
              </Box>

              <Box sx={{ pb: index < events.length - 1 ? 2 : 0 }}>
                <Typography variant='body2' className='font-medium'>
                  {event.title}
                </Typography>
                <Typography variant='caption' color='text.secondary'>
                  {event.who} · {formatDate(event.when)}
                </Typography>
                {event.note && (
                  <Typography variant='body2' sx={{ mt: 1, fontStyle: 'italic' }}>
                    “{event.note}”
                  </Typography>
                )}
              </Box>
            </Box>
          ))}
        </Box>
      </DialogContent>

      <DialogActions>
        {transfer.status === 'in_transit' && (
          <>
            <Button color='secondary' startIcon={<i className='tabler-ban' />} onClick={() => onAction('cancel')}>
              Anular
            </Button>
            <Button
              color='error'
              startIcon={<i className='tabler-alert-triangle' />}
              onClick={() => onAction('mark-lost')}
            >
              Perdido
            </Button>
          </>
        )}
        {pendingReview && (
          <Button
            variant='tonal'
            color='warning'
            startIcon={<i className='tabler-checkup-list' />}
            onClick={() => onAction('review')}
          >
            Revisar faltantes
          </Button>
        )}
        <Button variant='contained' onClick={onClose}>
          Cerrar
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default TransferDetailsModal
