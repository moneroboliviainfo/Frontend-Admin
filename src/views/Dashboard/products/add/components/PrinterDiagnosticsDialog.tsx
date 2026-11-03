'use client'

// Panel de diagnostico de la impresora de etiquetas (DP30).
//
// Sirve para contestar dos preguntas sin tener la impresora al lado:
//   1. ¿El dibujo sale bien en ESTE celular? → la vista previa es el bitmap
//      exacto que se manda, ya binarizado.
//   2. ¿Que lenguaje entiende la impresora? → cada prueba manda lo minimo para
//      distinguir un dialecto del otro (ver printerDiagnostics.ts).
//
// No toca la facturacion: la MTP-4C sigue por su camino de siempre.

import { useEffect, useState } from 'react'

import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import Divider from '@mui/material/Divider'
import CircularProgress from '@mui/material/CircularProgress'

import { getConnectedDeviceName } from '@/utils/bluetoothPrinter'
import { PRINTER_TESTS } from '@/utils/printerDiagnostics'
import { LABEL_SIZES, renderLabelPreview } from '@/utils/variantLabel'
import type { VariantLabel } from '@/utils/variantLabel'

interface Props {
  open: boolean
  onClose: () => void

  // La misma etiqueta que imprimiria el boton "Termica", para previsualizarla
  label: VariantLabel | null
}

const PrinterDiagnosticsDialog = ({ open, onClose, label }: Props) => {
  const [preview, setPreview] = useState<string>('')
  const [previewError, setPreviewError] = useState<string>('')
  const [corriendo, setCorriendo] = useState<string>('')
  const [resultado, setResultado] = useState<{ texto: string; ok: boolean } | null>(null)

  // La vista previa usa la medida que esta fallando
  const size = LABEL_SIZES[0]

  useEffect(() => {
    if (!open || !label) return

    setPreview('')
    setPreviewError('')

    renderLabelPreview(label, size)
      .then(setPreview)
      .catch((error: any) => setPreviewError(error?.message || 'No se pudo dibujar la vista previa'))
  }, [open, label, size])

  const correr = async (id: string, run: () => Promise<void>) => {
    setCorriendo(id)
    setResultado(null)

    try {
      await run()
      setResultado({ texto: 'Enviado. Mira que salio por la impresora.', ok: true })
    } catch (error: any) {
      setResultado({ texto: error?.message || 'No se pudo enviar', ok: false })
    } finally {
      setCorriendo('')
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth='sm' fullWidth>
      <DialogTitle>Diagnóstico de impresora térmica</DialogTitle>
      <DialogContent>
        <Typography variant='subtitle2' sx={{ mb: 1 }}>
          1 · Lo que se dibuja en este dispositivo
        </Typography>
        <Typography variant='caption' color='text.secondary' sx={{ display: 'block', mb: 1.5 }}>
          Es el bitmap exacto que se envía ({size.label}), con el relleno blanco de la izquierda incluido. Si acá se ve
          la etiqueta, el dibujo está bien y el problema es de la impresora.
        </Typography>

        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: 90,
            p: 1,
            mb: 2,
            bgcolor: '#fff',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
            overflowX: 'auto'
          }}
        >
          {previewError ? (
            <Alert severity='error' sx={{ width: '100%' }}>
              {previewError}
            </Alert>
          ) : preview ? (
            <Box component='img' src={preview} alt='Vista previa' sx={{ maxWidth: '100%', imageRendering: 'pixelated' }} />
          ) : (
            <CircularProgress size={22} />
          )}
        </Box>

        <Divider sx={{ my: 2 }} />

        <Typography variant='subtitle2' sx={{ mb: 1 }}>
          2 · Qué lenguaje entiende la impresora
        </Typography>
        <Typography variant='caption' color='text.secondary' sx={{ display: 'block', mb: 1.5 }}>
          Corré las pruebas en orden y anotá cuáles imprimen algo. Cada una gasta una etiqueta.
          {getConnectedDeviceName() ? ` Conectada: ${getConnectedDeviceName()}.` : ''}
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {PRINTER_TESTS.map(test => (
            <Box key={test.id} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
              <Button
                variant='outlined'
                size='small'
                disabled={!!corriendo}
                onClick={() => correr(test.id, test.run)}
                sx={{ minWidth: 190, flexShrink: 0, justifyContent: 'flex-start' }}
                startIcon={corriendo === test.id ? <CircularProgress size={14} /> : <i className='tabler-printer' />}
              >
                {test.label}
              </Button>
              <Typography variant='caption' color='text.secondary' sx={{ pt: 0.5 }}>
                {test.significa}
              </Typography>
            </Box>
          ))}
        </Box>

        {resultado && (
          <Alert severity={resultado.ok ? 'info' : 'error'} sx={{ mt: 2 }}>
            {resultado.texto}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  )
}

export default PrinterDiagnosticsDialog
