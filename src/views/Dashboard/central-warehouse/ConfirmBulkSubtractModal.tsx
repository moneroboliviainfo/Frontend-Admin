'use client'

import { useEffect, useState } from 'react'

import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Alert from '@mui/material/Alert'
import Divider from '@mui/material/Divider'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'

import CustomTextField from '@core/components/mui/TextField'
import { prendas } from './units'

export type BulkSubtractLine = {
  variantSizeId: number
  label: string
  quantity: number
}

type Props = {
  open: boolean
  lines: BulkSubtractLine[]
  isPending: boolean
  onClose: () => void
  onConfirm: (reason: string) => void
}

// Un solo motivo para todas las lineas: el back lo pide asi (subtractstock/bulk)
const ConfirmBulkSubtractModal = ({ open, lines, isPending, onClose, onConfirm }: Props) => {
  const [reason, setReason] = useState('')

  useEffect(() => {
    if (open) setReason('')
  }, [open])

  const total = lines.reduce((sum, line) => sum + line.quantity, 0)
  const isValid = !!reason.trim() && lines.length > 0

  return (
    <Dialog open={open} onClose={isPending ? undefined : onClose} maxWidth='sm' fullWidth>
      <DialogTitle>
        Dar de baja {lines.length > 1 ? `${lines.length} variantes` : '1 variante'}
        <Typography variant='body2' color='text.secondary' sx={{ mt: 1 }}>
          {prendas(total)} de la bodega central
        </Typography>
      </DialogTitle>

      <DialogContent>
        <Alert severity='warning' sx={{ mb: 4 }}>
          Esta acción <strong>descuenta</strong> stock de la bodega. Corresponde a prendas dañadas o inservibles, no
          a un envío perdido en el camino.
        </Alert>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 3, maxHeight: 240, overflowY: 'auto' }}>
          {lines.map(line => (
            <Box key={line.variantSizeId} className='flex items-center justify-between gap-2'>
              <Typography variant='body2' sx={{ flex: 1 }}>
                {line.label}
              </Typography>
              <Typography variant='body2' className='font-medium' color='error'>
                -{line.quantity}
              </Typography>
            </Box>
          ))}
        </Box>

        <Divider sx={{ mb: 3 }} />

        <CustomTextField
          fullWidth
          multiline
          rows={2}
          label='Motivo *'
          placeholder='Prendas dañadas en el depósito'
          value={reason}
          onChange={e => setReason(e.target.value)}
        />
      </DialogContent>

      <DialogActions sx={{ p: 4, gap: 2 }}>
        <Button onClick={onClose} color='secondary' disabled={isPending}>
          Volver
        </Button>
        <Button
          variant='contained'
          color='error'
          onClick={() => onConfirm(reason.trim())}
          disabled={!isValid || isPending}
          startIcon={isPending ? <CircularProgress size={16} /> : <i className='tabler-trash' />}
        >
          {isPending ? 'Dando de baja...' : 'Dar de baja'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default ConfirmBulkSubtractModal
