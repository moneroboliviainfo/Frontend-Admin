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
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'

import CustomTextField from '@core/components/mui/TextField'
import VariantQRModal from '@/views/Dashboard/products/add/components/VariantQRModal'
import { prendas } from './units'

type Entry = [string, number]

// Lo que necesita la etiqueta de una variante: el mismo QR y los mismos datos
// que en Productos → Variantes
export type VariantQrInfo = {
  productName: string
  colorName: string
  sizeName: string
  sku?: string
}

type QrTarget = VariantQrInfo & { variantId: number }

type Props = {
  open: boolean
  onClose: () => void

  // `note`: el comentario opcional del envio (doc 11 — `note?` del body de
  // central-dispatch); solo tiene sentido cuando hay algo saliendo
  onConfirm: (note: string) => void
  branchName?: string
  labels: Record<number, string>
  qrInfo?: Record<number, VariantQrInfo>
  incoming: Entry[]
  outgoing: Entry[]
}

const sumUnits = (entries: Entry[]) => entries.reduce((sum, [, quantity]) => sum + quantity, 0)

// Respaldo para variantes que no pasaron por la tabla (por ejemplo, cargadas por
// Excel): el texto de la linea siempre es "Producto · Color · Talla X"
const parseLabel = (label?: string): VariantQrInfo | null => {
  const parts = (label || '').split(' · ')

  if (parts.length !== 3 || !parts[2].startsWith('Talla ')) return null

  return { productName: parts[0], colorName: parts[1], sizeName: parts[2].slice('Talla '.length) }
}

const ConfirmWarehouseChangesModal = ({
  open,
  onClose,
  onConfirm,
  branchName,
  labels,
  qrInfo = {},
  incoming,
  outgoing
}: Props) => {
  const [note, setNote] = useState('')

  // Variante cuya etiqueta se va a imprimir (abre el modal del QR encima de este)
  const [qrTarget, setQrTarget] = useState<QrTarget | null>(null)

  useEffect(() => {
    if (open) setNote('')
  }, [open])

  const renderLines = (entries: Entry[], sign: string) => (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {entries.map(([variantSizeId, quantity]) => {
        const id = Number(variantSizeId)
        const info = qrInfo[id] || parseLabel(labels[id])

        return (
          <Box key={variantSizeId} className='flex items-center gap-2'>
            <Typography variant='body2' sx={{ flex: 1 }}>
              {labels[id] || `Variante #${variantSizeId}`}
            </Typography>
            <Typography variant='body2' className='font-medium'>
              {sign}
              {quantity}
            </Typography>
            {info && (
              <Tooltip title='Ver QR e imprimir etiquetas'>
                <IconButton size='small' onClick={() => setQrTarget({ ...info, variantId: id })}>
                  <i className='tabler-qrcode' />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        )
      })}
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

            <CustomTextField
              fullWidth
              multiline
              rows={2}
              label='Comentario (opcional)'
              placeholder='Reposición de temporada'
              value={note}
              onChange={e => setNote(e.target.value)}
              sx={{ mt: 3 }}
            />

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
        <Button onClick={() => onConfirm(note.trim())} variant='contained'>
          Confirmar
        </Button>
      </DialogActions>

      {/* El mismo modal de Productos → Variantes: QR, descarga y etiquetas por
          web o Bluetooth en las cuatro medidas */}
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

export default ConfirmWarehouseChangesModal
