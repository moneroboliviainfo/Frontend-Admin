'use client'

// Calibracion de la impresora de etiquetas (DP30 y similares).
//
// Dos cosas, las que hay que repetir cada vez que cambia una impresora o un rollo:
//   1. Ver que se dibuja en ESTE dispositivo → la vista previa es el bitmap
//      exacto que se manda, ya binarizado.
//   2. Corregir la posicion → el corrimiento se ajusta en mm desde aca y queda
//      guardado en el dispositivo, sin recompilar ni desplegar.
//
// ESC/POS imprime siempre desde el borde izquierdo del cabezal, asi que cuando
// el rollo es mas angosto hay que rellenar con blanco hasta donde apoya el papel.
// Ese relleno es lo que se calibra aca (ver margenIzquierdo en variantLabel.ts).
//
// No toca la facturacion: la MTP-4C sigue por su camino de siempre.

import { useCallback, useEffect, useState } from 'react'

import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import ButtonGroup from '@mui/material/ButtonGroup'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import Divider from '@mui/material/Divider'
import CircularProgress from '@mui/material/CircularProgress'

import { getLabelPrinterName } from '@/utils/labelPrinter'
import {
  ANCHO_CABEZAL_MM,
  LABEL_SIZES,
  getOffsetEtiquetaMm,
  getOffsetVerticalMm,
  margenIzquierdoMm,
  printVariantLabelBluetooth,
  renderLabelPreview,
  setOffsetEtiquetaMm,
  setOffsetVerticalMm
} from '@/utils/variantLabel'
import type { VariantLabel } from '@/utils/variantLabel'

interface Props {
  open: boolean
  onClose: () => void

  // La misma etiqueta que imprimiria el boton "Termica", para previsualizarla
  label: VariantLabel | null
}

// Pasos de calibracion: 1 mm para encontrar la zona, 0.5 para afinar
const PASOS = [-1, -0.5, 0.5, 1]

const PrinterDiagnosticsDialog = ({ open, onClose, label }: Props) => {
  const [preview, setPreview] = useState<string>('')
  const [previewError, setPreviewError] = useState<string>('')
  const [offset, setOffset] = useState<number>(0)

  // Corrimiento vertical del contenido dentro de la etiqueta: negativo lo sube
  const [vertical, setVertical] = useState<number>(0)
  const [imprimiendo, setImprimiendo] = useState(false)
  const [resultado, setResultado] = useState<{ texto: string; ok: boolean } | null>(null)

  // La calibracion se hace sobre la medida que se esta usando
  const size = LABEL_SIZES[0]

  // El valor guardado se lee en el cliente: en el servidor no hay localStorage
  useEffect(() => {
    if (!open) return

    setOffset(getOffsetEtiquetaMm())
    setVertical(getOffsetVerticalMm())
  }, [open])

  const dibujarPreview = useCallback(() => {
    if (!label) return

    setPreview('')
    setPreviewError('')

    renderLabelPreview(label, size)
      .then(setPreview)
      .catch((error: any) => setPreviewError(error?.message || 'No se pudo dibujar la vista previa'))
  }, [label, size])

  useEffect(() => {
    if (open) dibujarPreview()
  }, [open, offset, vertical, dibujarPreview])

  const mover = (paso: number) => {
    const nuevo = Math.round((offset + paso) * 10) / 10

    setOffsetEtiquetaMm(nuevo)
    setOffset(nuevo)
  }

  const moverVertical = (paso: number) => {
    const nuevo = Math.round((vertical + paso) * 10) / 10

    setOffsetVerticalMm(nuevo)
    setVertical(nuevo)
  }

  const imprimirPrueba = async () => {
    if (!label) return

    setImprimiendo(true)
    setResultado(null)

    try {
      await printVariantLabelBluetooth(label, size)
      setResultado({ texto: 'Enviado. Mira como salio la etiqueta.', ok: true })
    } catch (error: any) {
      setResultado({ texto: error?.message || 'No se pudo imprimir', ok: false })
    } finally {
      setImprimiendo(false)
    }
  }

  const ocupado = margenIzquierdoMm(size) + size.width

  return (
    <Dialog open={open} onClose={onClose} maxWidth='sm' fullWidth>
      <DialogTitle>Calibración de impresora térmica</DialogTitle>
      <DialogContent>
        <Typography variant='subtitle2' sx={{ mb: 1 }}>
          1 · Lo que se dibuja en este dispositivo
        </Typography>
        <Typography variant='caption' color='text.secondary' sx={{ display: 'block', mb: 1.5 }}>
          Es el bitmap exacto que se envía ({size.label}). La franja blanca de la izquierda es el relleno que corre la
          etiqueta hasta donde apoya el rollo.
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
            <Box
              component='img'
              src={preview}
              alt='Vista previa'
              sx={{ maxWidth: '100%', imageRendering: 'pixelated' }}
            />
          ) : (
            <CircularProgress size={22} />
          )}
        </Box>

        <Divider sx={{ my: 2 }} />

        <Typography variant='subtitle2' sx={{ mb: 1 }}>
          2 · Ajuste fino de posición
        </Typography>
        <Typography variant='caption' color='text.secondary' sx={{ display: 'block', mb: 1.5 }}>
          Si la etiqueta sale corrida a la izquierda, sumá milímetros; si se pasa a la derecha, restá. Queda guardado en
          este dispositivo y lo usa el botón &quot;Térmica&quot;.
          {getLabelPrinterName() ? ` Conectada: ${getLabelPrinterName()}.` : ''}
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', mb: 1.5 }}>
          <ButtonGroup size='small' variant='outlined'>
            {PASOS.map(paso => (
              <Button key={paso} onClick={() => mover(paso)}>
                {paso > 0 ? `+${paso}` : paso} mm
              </Button>
            ))}
          </ButtonGroup>

          <Typography variant='body2'>
            Corrimiento: <strong>{offset} mm</strong>
          </Typography>

          {offset !== 0 && (
            <Button size='small' color='secondary' onClick={() => mover(-offset)}>
              Volver a 0
            </Button>
          )}
        </Box>

        <Typography variant='caption' color='text.secondary' sx={{ display: 'block', mb: 1.5 }}>
          Relleno total a la izquierda: {margenIzquierdoMm(size)} mm. Con etiqueta de {size.width} mm, la imagen ocupa{' '}
          {ocupado} mm del cabezal.
        </Typography>

        {ocupado > ANCHO_CABEZAL_MM && (
          <Alert severity='warning' sx={{ mb: 1.5 }}>
            La imagen ya ocupa más de los {ANCHO_CABEZAL_MM} mm imprimibles configurados. Si de golpe deja de imprimir
            del todo, es por esto: el cabezal real es más angosto de lo que estamos asumiendo. En ese caso hay que subir{' '}
            <code>ANCHO_CABEZAL_MM</code> solo si tu cabezal de verdad es más ancho; si no, el rollo no se puede
            alcanzar más a la derecha.
          </Alert>
        )}

        <Divider sx={{ my: 2 }} />

        <Typography variant='subtitle2' sx={{ mb: 1 }}>
          3 · Posición vertical
        </Typography>
        <Typography variant='caption' color='text.secondary' sx={{ display: 'block', mb: 1.5 }}>
          Mueve el contenido dentro de la etiqueta: valores negativos lo suben. Se ve en la vista previa de arriba. El
          tope es el blanco que queda sobre el contenido — pasado ese punto empieza a recortarse.
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', mb: 2 }}>
          <ButtonGroup size='small' variant='outlined'>
            {PASOS.map(paso => (
              <Button key={paso} onClick={() => moverVertical(paso)}>
                {paso > 0 ? `+${paso}` : paso} mm
              </Button>
            ))}
          </ButtonGroup>

          <Typography variant='body2'>
            Vertical: <strong>{vertical} mm</strong>
          </Typography>

          {vertical !== 0 && (
            <Button size='small' color='secondary' onClick={() => moverVertical(-vertical)}>
              Volver a 0
            </Button>
          )}
        </Box>

        <Button
          variant='contained'
          size='small'
          disabled={!label || imprimiendo}
          startIcon={imprimiendo ? <CircularProgress size={14} /> : <i className='tabler-printer' />}
          onClick={imprimirPrueba}
        >
          Imprimir etiqueta de prueba
        </Button>

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
