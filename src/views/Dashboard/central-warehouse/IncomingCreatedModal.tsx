'use client'

import { useState } from 'react'

import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'

import tableStyles from '@core/styles/table.module.css'
import { isBluetoothAvailable } from '@/utils/bluetoothPrinter'
import { printIncomingNote, printIncomingNoteBluetooth } from '@/utils/receptionReceipt'
import type { IncomingNote } from '@/utils/receptionReceipt'
import VariantQRModal from '@/views/Dashboard/products/add/components/VariantQRModal'
import type { VariantQrInfo } from './ConfirmWarehouseChangesModal'
import { prendas } from './units'

type Props = {
  note: IncomingNote | null
  qrInfo: Record<number, VariantQrInfo>
  onClose: () => void
}

type QrTarget = VariantQrInfo & { variantId: number }

// Se abre DESPUES de confirmar, igual que el remito de envio: lista lo que
// quedo registrado (solo lo que se guardo de verdad, no lo que fallo) y ofrece
// imprimir el comprobante. Sirve para ingresos y para bajas (note.kind): en un
// ingreso ofrece ademas las etiquetas de cada prenda nueva; en una baja muestra
// el motivo y no hay etiquetas, porque esas prendas salen.
const IncomingCreatedModal = ({ note, qrInfo, onClose }: Props) => {
  const [qrTarget, setQrTarget] = useState<QrTarget | null>(null)

  const lines = note?.lines || []
  const total = lines.reduce((sum, line) => sum + line.quantity, 0)
  const isBaja = note?.kind === 'baja'

  return (
    <Dialog open={!!note} onClose={onClose} maxWidth='sm' fullWidth>
      <DialogTitle>
        {isBaja ? 'Baja registrada' : 'Ingreso registrado'}
        <Typography variant='body2' color='text.secondary' sx={{ mt: 1 }}>
          {isBaja
            ? `${prendas(total)} dadas de baja de la Bodega Central`
            : `${prendas(total)} ingresaron a la Bodega Central`}
        </Typography>
      </DialogTitle>

      <DialogContent>
        {isBaja && note?.reason && (
          <Alert severity='info' sx={{ mb: 4 }}>
            <strong>Motivo:</strong> {note.reason}
          </Alert>
        )}

        <div className='overflow-x-auto'>
          <table className={tableStyles.table}>
            <thead>
              <tr>
                <th>Prenda</th>
                <th>SKU</th>
                <th>Cantidad</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {lines.map(line => {
                const info = qrInfo[line.variantId]

                return (
                  <tr key={line.variantId}>
                    <td>
                      <Typography variant='body2'>{line.label}</Typography>
                    </td>
                    <td>
                      <Typography variant='body2' color='text.secondary'>
                        {line.sku || '—'}
                      </Typography>
                    </td>
                    <td>
                      <Typography
                        variant='body2'
                        className='font-medium'
                        color={isBaja ? 'error.main' : 'success.main'}
                      >
                        {isBaja ? '-' : '+'}
                        {line.quantity}
                      </Typography>
                    </td>
                    <td>
                      {info && !isBaja && (
                        <Tooltip title='Ver QR e imprimir etiquetas'>
                          <IconButton size='small' onClick={() => setQrTarget({ ...info, variantId: line.variantId })}>
                            <i className='tabler-qrcode' />
                          </IconButton>
                        </Tooltip>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </DialogContent>

      <DialogActions sx={{ p: 4, gap: 2, flexWrap: 'wrap' }}>
        <Button onClick={onClose} color='secondary'>
          Cerrar
        </Button>

        <Box sx={{ flex: 1 }} />

        {isBluetoothAvailable() && (
          <Button
            variant='outlined'
            startIcon={<i className='tabler-bluetooth' />}
            onClick={() => note && printIncomingNoteBluetooth(note)}
          >
            Térmica
          </Button>
        )}

        <Button
          variant='contained'
          startIcon={<i className='tabler-printer' />}
          onClick={() => note && printIncomingNote(note)}
        >
          Imprimir lista
        </Button>
      </DialogActions>

      {/* El mismo modal de Productos → Variantes: etiquetas por web o Bluetooth */}
      {qrTarget && (
        <VariantQRModal
          open
          onClose={() => setQrTarget(null)}
          variantId={qrTarget.variantId}
          sku={qrTarget.sku}
          productName={qrTarget.productName}
          colorName={qrTarget.colorName}
          sizeName={qrTarget.sizeName}
        />
      )}
    </Dialog>
  )
}

export default IncomingCreatedModal
