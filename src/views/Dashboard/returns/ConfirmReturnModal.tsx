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
import CircularProgress from '@mui/material/CircularProgress'

import CustomTextField from '@core/components/mui/TextField'
import { prendas } from '@/views/Dashboard/central-warehouse/units'

export type ReturnLine = {
  variantSizeId: number
  label: string
  quantity: number
}

type Props = {
  open: boolean
  lines: ReturnLine[]
  location: 'warehouse' | 'sales_floor'
  note: string
  onNoteChange: (note: string) => void
  isPending: boolean
  onClose: () => void
  onConfirm: () => void
}

// Ultimo paso antes de que el stock salga de la sucursal: se muestra el detalle
// completo porque al confirmar no hay vuelta atras salvo anular la devolucion.
const ConfirmReturnModal = ({ open, lines, location, note, onNoteChange, isPending, onClose, onConfirm }: Props) => {
  const total = lines.reduce((sum, line) => sum + line.quantity, 0)

  return (
    <Dialog open={open} onClose={isPending ? undefined : onClose} maxWidth='sm' fullWidth>
      <DialogTitle>
        Devolver a la Bodega Central
        <Typography variant='body2' color='text.secondary' sx={{ mt: 1 }}>
          {prendas(total)} desde {location === 'warehouse' ? 'la bodega' : 'la tienda'}
        </Typography>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 3 }}>
          {lines.map(line => (
            <Box key={line.variantSizeId} className='flex items-center justify-between gap-2'>
              <Typography variant='body2' sx={{ flex: 1 }}>
                {line.label}
              </Typography>
              <Typography variant='body2' className='font-medium'>
                {line.quantity}
              </Typography>
            </Box>
          ))}
        </Box>

        <Divider sx={{ mb: 3 }} />

        {/* El motivo se escribe acá: es el momento en que se sabe por qué se
            devuelve, y antes quedaba al pie de la tabla, lejos del confirmar */}
        <CustomTextField
          fullWidth
          multiline
          rows={2}
          label='Motivo (opcional)'
          placeholder='Fin de temporada'
          value={note}
          onChange={e => onNoteChange(e.target.value)}
          sx={{ mb: 3 }}
        />

        <Alert severity='warning'>
          Al confirmar, {prendas(total)} {total === 1 ? 'sale' : 'salen'} de su sucursal y {total === 1 ? 'queda' : 'quedan'} en
          camino. Para revertirlo hay que anular la devolución.
        </Alert>
      </DialogContent>

      <DialogActions sx={{ p: 4, gap: 2 }}>
        <Button onClick={onClose} color='secondary' disabled={isPending}>
          Volver
        </Button>
        <Button
          variant='contained'
          onClick={onConfirm}
          disabled={isPending}
          startIcon={isPending ? <CircularProgress size={16} /> : <i className='tabler-truck-return' />}
        >
          {isPending ? 'Registrando...' : 'Confirmar devolución'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default ConfirmReturnModal
