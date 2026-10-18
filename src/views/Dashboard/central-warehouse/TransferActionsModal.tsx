'use client'

import { useEffect, useState } from 'react'

import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Alert from '@mui/material/Alert'
import MenuItem from '@mui/material/MenuItem'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'

import CustomTextField from '@core/components/mui/TextField'
import { useCancelTransfer, useMarkLostTransfer, useReviewTransfer } from '@/hooks/useBranchTransfers'
import type { BranchTransfer, BranchTransferItem, ReviewOutcome } from '@/types/api/branchTransfer'
import { missingUnits } from './transfers'
import { prendas } from './units'

type ActionKind = 'cancel' | 'mark-lost' | 'review'

type Props = {
  action: { kind: ActionKind; transfer: BranchTransfer } | null
  onClose: () => void
  showMessage: (message: string, severity: 'success' | 'error') => void
}

const itemLabel = (item: BranchTransferItem) => {
  const productColor = item.variant?.productColor

  return `${productColor?.product?.name || 'Producto'} · ${productColor?.color?.name || ''} · Talla ${
    item.variant?.size?.name || ''
  }`
}

const copy: Record<ActionKind, { title: string; confirm: string; noteLabel: string; noteRequired: boolean }> = {
  cancel: {
    title: 'Anular envío',
    confirm: 'Anular envío',
    noteLabel: 'Motivo (opcional)',
    noteRequired: false
  },
  'mark-lost': {
    title: 'Marcar envío como perdido',
    confirm: 'Marcar perdido',
    noteLabel: 'Motivo',
    noteRequired: true
  },
  review: {
    title: 'Revisar faltantes',
    confirm: 'Guardar revisión',
    noteLabel: 'Nota',
    noteRequired: true
  }
}

const TransferActionsModal = ({ action, onClose, showMessage }: Props) => {
  const [note, setNote] = useState('')
  const [outcomes, setOutcomes] = useState<Record<number, ReviewOutcome | ''>>({})

  const cancelTransfer = useCancelTransfer()
  const markLost = useMarkLostTransfer()
  const review = useReviewTransfer()

  const isPending = cancelTransfer.isPending || markLost.isPending || review.isPending

  useEffect(() => {
    setNote('')
    setOutcomes({})
  }, [action])

  if (!action) return null

  const { kind, transfer } = action
  const texts = copy[kind]

  // Una linea ya revisada no se vuelve a revisar
  const reviewableItems = transfer.items.filter(item => missingUnits(item, transfer.status) > 0 && !item.reviewOutcome)

  const chosenOutcomes = Object.entries(outcomes).filter(([, outcome]) => outcome !== '')

  const isValid = (() => {
    if (texts.noteRequired && !note.trim()) return false
    if (kind === 'review') return chosenOutcomes.length > 0

    return true
  })()

  const handleConfirm = async () => {
    try {
      if (kind === 'cancel') {
        await cancelTransfer.mutateAsync({
          transferId: transfer.id,
          data: note.trim() ? { note: note.trim() } : {}
        })
        showMessage(`Envío #${transfer.id} anulado: todo volvió a la bodega`, 'success')
      } else if (kind === 'mark-lost') {
        await markLost.mutateAsync({ transferId: transfer.id, data: { note: note.trim() } })
        showMessage(`Envío #${transfer.id} marcado como perdido`, 'success')
      } else {
        await review.mutateAsync({
          transferId: transfer.id,
          data: {
            items: chosenOutcomes.map(([transferItemId, outcome]) => ({
              transferItemId: Number(transferItemId),
              outcome: outcome as ReviewOutcome
            })),
            note: note.trim()
          }
        })
        showMessage(`Faltantes del envío #${transfer.id} revisados`, 'success')
      }

      onClose()
    } catch (error: any) {
      showMessage(error?.response?.data?.message || 'No se pudo completar la acción', 'error')
    }
  }

  return (
    <Dialog open onClose={onClose} maxWidth='sm' fullWidth>
      <DialogTitle>
        {texts.title} · #{transfer.id}
      </DialogTitle>

      <DialogContent>
        {kind === 'cancel' && (
          <Alert severity='info' sx={{ mb: 4 }}>
            Las {prendas(transfer.items.reduce((sum, item) => sum + item.quantity, 0))} vuelven al depósito de la
            bodega. Solo se puede anular mientras está en camino.
          </Alert>
        )}

        {kind === 'mark-lost' && (
          <Alert severity='error' sx={{ mb: 4 }}>
            Lo despachado queda como <strong>pérdida</strong>: no vuelve a la bodega ni entra a{' '}
            {transfer.destinationBranch?.name || 'la sucursal'}. Si después aparece, se registra con un ingreso.
          </Alert>
        )}

        {kind === 'review' && (
          <>
            <Alert severity='warning' sx={{ mb: 4 }}>
              {transfer.destinationBranch?.name || 'La sucursal'} recibió menos de lo despachado. Indique qué
              ocurrió con cada faltante. Puede revisar algunos ahora y el resto más adelante.
            </Alert>

            {reviewableItems.length === 0 ? (
              <Typography variant='body2' color='text.secondary' sx={{ mb: 4 }}>
                No quedan faltantes por revisar en este envío.
              </Typography>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mb: 4 }}>
                {reviewableItems.map(item => (
                  <Box key={item.id}>
                    <Typography variant='body2' className='font-medium'>
                      {itemLabel(item)}
                    </Typography>
                    <Typography variant='caption' color='text.secondary'>
                      Faltan {missingUnits(item, transfer.status)} de {item.quantity}
                    </Typography>
                    <CustomTextField
                      select
                      fullWidth
                      size='small'
                      value={outcomes[item.id] || ''}
                      onChange={e => setOutcomes(prev => ({ ...prev, [item.id]: e.target.value as ReviewOutcome }))}
                      sx={{ mt: 2 }}
                    >
                      <MenuItem value=''>Revisar después</MenuItem>
                      <MenuItem value='lost'>Se perdió</MenuItem>
                      <MenuItem value='found_at_destination'>
                        Apareció en {transfer.destinationBranch?.name || 'el destino'}
                      </MenuItem>
                      <MenuItem value='found_at_origin'>Apareció en la bodega</MenuItem>
                    </CustomTextField>
                  </Box>
                ))}
              </Box>
            )}
          </>
        )}

        <CustomTextField
          fullWidth
          multiline
          rows={2}
          label={texts.noteLabel}
          value={note}
          onChange={e => setNote(e.target.value)}
          error={texts.noteRequired && note.length > 0 && !note.trim()}
        />
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} color='secondary' disabled={isPending}>
          Volver
        </Button>
        <Button
          onClick={handleConfirm}
          variant='contained'
          color={kind === 'mark-lost' ? 'error' : 'primary'}
          disabled={!isValid || isPending}
          startIcon={isPending ? <CircularProgress size={16} /> : undefined}
        >
          {isPending ? 'Guardando...' : texts.confirm}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default TransferActionsModal
