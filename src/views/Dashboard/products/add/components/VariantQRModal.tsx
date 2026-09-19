'use client'

import { useRef } from 'react'

import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { QRCodeSVG } from 'qrcode.react'

interface VariantQRModalProps {
  open: boolean
  onClose: () => void
  variantId: number
  colorName: string
  sizeName: string
  productName?: string
}

const VariantQRModal = ({ open, onClose, variantId, colorName, sizeName, productName }: VariantQRModalProps) => {
  const qrRef = useRef<HTMLDivElement>(null)

  const qrValue = `<qr>${variantId}</qr>`

  const handleDownloadQR = () => {
    const svg = qrRef.current?.querySelector('svg')

    if (!svg) return

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    if (!ctx) return

    const svgData = new XMLSerializer().serializeToString(svg)
    const img = new Image()

    // Etiqueta tipo "tag": el QR y el texto comparten el mismo margen lateral,
    // así queda todo realmente centrado en vez del QR pegado al borde del canvas.
    const padding = 32
    const qrSize = 420
    const canvasWidth = qrSize + padding * 2

    type TextLine = { text: string; font: string; color: string; gapAfter: number }

    const lines: TextLine[] = []

    if (productName) {
      lines.push({ text: productName, font: 'bold 24px Arial, sans-serif', color: '#1a1a1a', gapAfter: 8 })
    }

    lines.push({
      text: `${colorName} · Talla: ${sizeName}`,
      font: '600 20px Arial, sans-serif',
      color: '#333333',
      gapAfter: 14
    })
    lines.push({ text: `ID ${variantId}`, font: '14px Arial, sans-serif', color: '#999999', gapAfter: 0 })

    const lineHeight = (font: string) => {
      const size = parseInt(font.match(/(\d+)px/)?.[1] || '16', 10)

      return Math.round(size * 1.3)
    }

    const separatorGap = 26
    const textTopPadding = 26
    const bottomPadding = 30

    const textBlockHeight =
      textTopPadding + lines.reduce((acc, line) => acc + lineHeight(line.font) + line.gapAfter, 0) + bottomPadding

    canvas.width = canvasWidth
    canvas.height = padding + qrSize + separatorGap + textBlockHeight

    img.onload = () => {
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Marco sutil, look de etiqueta impresa
      ctx.strokeStyle = '#e0e0e0'
      ctx.lineWidth = 1
      ctx.strokeRect(0.5, 0.5, canvas.width - 1, canvas.height - 1)

      ctx.drawImage(img, padding, padding, qrSize, qrSize)

      // Separador entre el QR y la información
      const sepY = padding + qrSize + separatorGap / 2

      ctx.strokeStyle = '#dddddd'
      ctx.beginPath()
      ctx.moveTo(padding + 20, sepY)
      ctx.lineTo(canvasWidth - padding - 20, sepY)
      ctx.stroke()

      ctx.textAlign = 'center'

      let y = padding + qrSize + separatorGap + textTopPadding

      for (const line of lines) {
        ctx.font = line.font
        ctx.fillStyle = line.color
        ctx.fillText(line.text, canvasWidth / 2, y)
        y += lineHeight(line.font) + line.gapAfter
      }

      canvas.toBlob(blob => {
        if (blob) {
          const url = URL.createObjectURL(blob)
          const link = document.createElement('a')

          link.href = url
          link.download = `variante-${variantId}-qr.png`
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
          URL.revokeObjectURL(url)
        }
      })
    }

    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)))
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth='sm' fullWidth>
      <DialogTitle>Código QR de Variante</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, py: 2 }}>
          <Box sx={{ textAlign: 'center' }}>
            {productName && (
              <Typography variant='subtitle1' fontWeight='bold' color='text.primary'>
                {productName}
              </Typography>
            )}
            <Typography variant='h6' color='text.primary'>
              {colorName}
            </Typography>
            <Typography variant='subtitle2' color='text.secondary'>
              Talla: {sizeName}
            </Typography>
          </Box>

          <Box
            ref={qrRef}
            sx={{
              p: 3,
              bgcolor: 'white',
              borderRadius: 2,
              boxShadow: 2,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center'
            }}
          >
            <QRCodeSVG value={qrValue} size={256} level='M' includeMargin={true} />
          </Box>

          <Box sx={{ textAlign: 'center' }}>
            <Typography variant='caption' color='text.secondary' sx={{ mt: 1, display: 'block' }}>
              ID de Variante: {variantId}
            </Typography>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color='secondary'>
          Cerrar
        </Button>
        <Button
          onClick={handleDownloadQR}
          color='primary'
          variant='contained'
          startIcon={<i className='tabler-download' />}
        >
          Descargar QR
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default VariantQRModal
