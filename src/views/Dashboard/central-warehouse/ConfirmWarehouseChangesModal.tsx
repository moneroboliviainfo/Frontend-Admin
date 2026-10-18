'use client'

import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Alert from '@mui/material/Alert'
import Divider from '@mui/material/Divider'
import Typography from '@mui/material/Typography'

import { prendas } from './units'

type Entry = [string, number]

type Props = {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  branchName?: string
  labels: Record<number, string>
  incoming: Entry[]
  outgoing: Entry[]
}

const sumUnits = (entries: Entry[]) => entries.reduce((sum, [, quantity]) => sum + quantity, 0)

const ConfirmWarehouseChangesModal = ({
  open,
  onClose,
  onConfirm,
  branchName,
  labels,
  incoming,
  outgoing
}: Props) => {
  const renderLines = (entries: Entry[], sign: string) => (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {entries.map(([variantSizeId, quantity]) => (
        <Box key={variantSizeId} className='flex items-center gap-2'>
          <Typography variant='body2' sx={{ flex: 1 }}>
            {labels[Number(variantSizeId)] || `Variante #${variantSizeId}`}
          </Typography>
          <Typography variant='body2' className='font-medium'>
            {sign}
            {quantity}
          </Typography>
        </Box>
      ))}
    </Box>
  )

  return (
    <Dialog open={open} onClose={onClose} maxWidth='sm' fullWidth>
      <DialogTitle>Confirmar cambios</DialogTitle>

      <DialogContent>
        {incoming.length > 0 && (
          <Box sx={{ mb: outgoing.length > 0 ? 4 : 0 }}>
            <Typography variant='body2' className='font-medium' sx={{ mb: 2 }}>
              Ingresan a la bodega ({prendas(sumUnits(incoming))})
            </Typography>
            {renderLines(incoming, '+')}
          </Box>
        )}

        {incoming.length > 0 && outgoing.length > 0 && <Divider sx={{ mb: 4 }} />}

        {outgoing.length > 0 && (
          <Box>
            <Typography variant='body2' className='font-medium' sx={{ mb: 2 }}>
              Salen hacia {branchName} ({prendas(sumUnits(outgoing))})
            </Typography>
            {renderLines(outgoing, '-')}

            <Alert severity='warning' sx={{ mt: 3 }}>
              El envío queda <strong>en camino</strong>: sale de la bodega y no está disponible en ninguna ubicación
              hasta que {branchName} lo reciba. Para revertirlo debe anularse.
            </Alert>
          </Box>
        )}

        {incoming.length > 0 && outgoing.length > 0 && (
          <Typography variant='caption' color='text.secondary' sx={{ display: 'block', mt: 3 }}>
            Primero se guardan los ingresos y después sale el envío.
          </Typography>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} color='secondary'>
          Volver
        </Button>
        <Button onClick={onConfirm} variant='contained'>
          Confirmar
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default ConfirmWarehouseChangesModal
