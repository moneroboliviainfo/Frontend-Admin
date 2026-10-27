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
import StageChip, { PendingReviewChip } from './StageChip'
import { canDo, hasPendingReview, missingUnits, transferUnits } from './transfers'
import { prendas, variantes } from './units'

type Props = {
  transfer: BranchTransfer | null
  onClose: () => void

  // Sin onAction el detalle es solo de consulta: las acciones viven en otra pantalla
  onAction?: (kind: 'cancel' | 'mark-lost' | 'review') => void
}

const reviewLabels = (transfer: BranchTransfer): Record<ReviewOutcome, string> => ({
  lost: 'Se perdió',
  found_at_destination: 'Apareció en el destino',
  found_at_origin: transfer.type === 'branch_request' ? 'Apareció en el origen' : 'Apareció en la bodega central'
})

const titleOf = (transfer: BranchTransfer) =>
  transfer.type === 'branch_request' ? 'Pedido' : transfer.replenishment ? 'Reposición' : 'Envío'

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
const timeline = (transfer: BranchTransfer): TimelineEvent[] => {
  const isRequest = transfer.type === 'branch_request'
  const origin = transfer.sourceBranch?.name || 'la bodega'

  // Un envio de la central nace despachado: la nota es la del envio. Pedidos y
  // reposiciones nacen pedidos y la nota es la de quien pidio
  const startsRequested = isRequest || !!transfer.replenishment

  return (
    [
      {
        key: 'requested',
        title: transfer.replenishment ? 'Pedido a la central' : `Pedido a ${origin}`,
        icon: 'tabler-clipboard-list',
        color: 'secondary',
        who: transfer.requestedBy?.name || '—',
        when: startsRequested ? transfer.requestedAt : null,
        note: transfer.note
      },
      {
        key: 'dispatched',
        title: isRequest ? `Despachado desde ${origin}` : 'Despachado desde la bodega',
        icon: 'tabler-truck-delivery',
        color: 'primary',
        who: transfer.dispatchedBy?.name || '—',
        when: transfer.dispatchedAt,

        // En una reposicion la nota de la central al atender queda en notFoundNote
        note: startsRequested ? (transfer.replenishment ? transfer.notFoundNote : null) : transfer.note
      },
      {
        key: 'not-found',
        title: transfer.replenishment ? 'Rechazada por la central' : `${origin} no lo encontró`,
        icon: 'tabler-circle-x',
        color: 'error',
        who: transfer.notFoundBy?.name || '—',
        when: transfer.notFoundAt,
        note: transfer.notFoundNote
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
        title: transfer.dispatchedAt
          ? `Anulado · lo enviado volvió a ${isRequest ? origin : 'la bodega'}`
          : 'Anulado antes de enviarse',
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
}

const TransferDetailsModal = ({ transfer, onClose, onAction }: Props) => {
  if (!transfer) return null

  const units = transferUnits(transfer)
  const pendingReview = hasPendingReview(transfer)
  const events = timeline(transfer)
  const labels = reviewLabels(transfer)

  // Reposicion sin atender: todavia no hay cantidades, solo las variantes pedidas
  const awaitingQuantities = !!transfer.replenishment && transfer.items.every(item => item.dispatchedQuantity === null)

  const canCancel = !!onAction && canDo(transfer, 'cancel', transfer.status === 'in_transit')
  const canMarkLost = !!onAction && canDo(transfer, 'markLost', transfer.status === 'in_transit')
  const canReview = !!onAction && canDo(transfer, 'review', pendingReview)

  return (
    <Dialog open onClose={onClose} maxWidth='md' fullWidth>
      <DialogTitle>
        <Box className='flex flex-wrap items-center gap-3'>
          <span>
            {titleOf(transfer)} #{transfer.id}
          </span>
          <StageChip transfer={transfer} />
          {pendingReview && <PendingReviewChip />}
        </Box>
        <Typography variant='body2' color='text.secondary' sx={{ mt: 1 }}>
          {awaitingQuantities
            ? variantes(transfer.items.length)
            : `${prendas(units)} en ${variantes(transfer.items.length)}`}
          {' · '}
          {transfer.sourceBranch?.name || 'Bodega'} → {transfer.destinationBranch?.name || 'la sucursal'}
        </Typography>
        {/* Solo los pedidos entre sucursales tienen cliente */}
        {transfer.customerName && (
          <Typography variant='body2' color='text.secondary'>
            Para {transfer.customerName}
            {transfer.customerPhone ? ` · ${transfer.customerPhone}` : ''}
            {transfer.customerCi ? ` · CI ${transfer.customerCi}` : ''}
          </Typography>
        )}
      </DialogTitle>

      <DialogContent>
        <div className='overflow-x-auto'>
          <table className={tableStyles.table}>
            <thead>
              <tr>
                <th>Prenda</th>
                {transfer.type === 'branch_request' && <th>Pedido</th>}
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
                    {transfer.type === 'branch_request' && (
                      <td>
                        <Typography variant='body2'>{item.quantity ?? '—'}</Typography>
                      </td>
                    )}
                    <td>
                      {/* Envio de la central: lo enviado es la cantidad; reposicion sin atender: todavia nada */}
                      <Typography
                        variant='body2'
                        color={item.dispatchedQuantity === null ? 'text.secondary' : 'inherit'}
                      >
                        {item.dispatchedQuantity ??
                          (transfer.type === 'central_dispatch' && !transfer.replenishment ? item.quantity : '—')}
                      </Typography>
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
                            label={item.reviewOutcome ? labels[item.reviewOutcome] : `Faltan ${missing}`}
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
        {canCancel && (
          <Button color='secondary' startIcon={<i className='tabler-ban' />} onClick={() => onAction?.('cancel')}>
            Anular
          </Button>
        )}
        {canMarkLost && (
          <Button
            color='error'
            startIcon={<i className='tabler-alert-triangle' />}
            onClick={() => onAction?.('mark-lost')}
          >
            Perdido
          </Button>
        )}
        {canReview && (
          <Button
            variant='tonal'
            color='warning'
            startIcon={<i className='tabler-checkup-list' />}
            onClick={() => onAction?.('review')}
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
