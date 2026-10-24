'use client'

import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Alert from '@mui/material/Alert'
import Typography from '@mui/material/Typography'

import { isBluetoothAvailable } from '@/utils/bluetoothPrinter'
import { printDispatchNote, printDispatchNoteBluetooth } from '@/utils/receptionReceipt'
import type { DispatchNote } from '@/utils/receptionReceipt'
import { prendas } from './units'

type Props = {
  note: DispatchNote | null
  onClose: () => void
}

// Se abre DESPUES de confirmar: el envio ya existe, asi que el remito sale con
// su numero y con lo que quedo registrado, no con lo que se iba a mandar.
const DispatchCreatedModal = ({ note, onClose }: Props) => {
  const total = (note?.lines || []).reduce((sum, line) => sum + line.quantity, 0)

  return (
    <Dialog open={!!note} onClose={onClose} maxWidth='xs' fullWidth>
      <DialogTitle>
        Envío #{note?.transferId} creado
        <Typography variant='body2' color='text.secondary' sx={{ mt: 1 }}>
          {prendas(total)} en camino a {note?.destination}
        </Typography>
      </DialogTitle>

      <DialogContent>
        <Alert severity='info'>
          Imprima el remito y mándelo con el paquete. En destino lo usan para contar lo que llega y firmarlo.
        </Alert>
      </DialogContent>

      <DialogActions sx={{ p: 4, gap: 2, flexWrap: 'wrap' }}>
        <Button onClick={onClose} color='secondary'>
          Ahora no
        </Button>

        <Box sx={{ flex: 1 }} />

        {isBluetoothAvailable() && (
          <Button
            variant='outlined'
            startIcon={<i className='tabler-bluetooth' />}
            onClick={() => note && printDispatchNoteBluetooth(note)}
          >
            Térmica
          </Button>
        )}

        <Button
          variant='contained'
          startIcon={<i className='tabler-printer' />}
          onClick={() => note && printDispatchNote(note)}
        >
          Imprimir remito
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default DispatchCreatedModal
