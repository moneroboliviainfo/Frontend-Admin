'use client'

import { useEffect, useState } from 'react'

import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Alert from '@mui/material/Alert'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'

import {
  useCancelTransfer,
  useGenerateRequestQr,
  useWatchTransferPayment
} from '@/hooks/useBranchTransfers'
import type { RequestQrResponse } from '@/types/api/branchTransfer'

type Props = {
  transferId: number | null
  onClose: () => void
  showMessage: (message: string, severity: 'success' | 'error') => void
}

const formatTime = (value: string | null) => (value ? new Date(value).toLocaleTimeString('es-BO') : '—')

const RequestQrDialog = ({ transferId, onClose, showMessage }: Props) => {
  const [qr, setQr] = useState<RequestQrResponse | null>(null)
  const [qrError, setQrError] = useState('')

  const generateQr = useGenerateRequestQr()
  const cancelTransfer = useCancelTransfer()

  const { data: transfer } = useWatchTransferPayment(transferId, !!transferId)

  const generate = async (id: number) => {
    setQrError('')

    try {
      const response = await generateQr.mutateAsync({ transferId: id })

      // Si BNB falla, el back responde sin lanzar: hay que mirar success
      if (!response.success || !response.qr) {
        setQrError(response.message || 'El banco no pudo generar el QR')

        return
      }

      setQr(response)
    } catch (error: any) {
      setQrError(error?.response?.data?.message || 'No se pudo generar el QR')
    }
  }

  useEffect(() => {
    setQr(null)
    setQrError('')

    if (transferId) generate(transferId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transferId])

  if (!transferId) return null

  const isPaid = transfer?.status === 'pending_dispatch' && !!transfer?.advancePaidAt
  const isExpired = transfer?.status === 'pending_payment' && transfer?.paymentExpired === true
  const isWaiting = transfer?.status === 'pending_payment' && !transfer?.paymentExpired

  // Pago tardio: el pedido se anulo pero el cliente pago igual
  const paidLate = transfer?.status === 'cancelled' && !!transfer?.advancePaidAt

  const handleCancel = async () => {
    try {
      await cancelTransfer.mutateAsync({ transferId, data: {} })
      showMessage(`Pedido #${transferId} anulado`, 'success')
      onClose()
    } catch (error: any) {
      showMessage(error?.response?.data?.message || 'No se pudo anular', 'error')
    }
  }

  return (
    <Dialog open onClose={isPaid ? onClose : undefined} maxWidth='xs' fullWidth>
      <DialogTitle>Cobro del pedido #{transferId}</DialogTitle>

      <DialogContent>
        {isPaid ? (
          <Alert severity='success'>
            <Typography variant='body2' className='font-medium'>
              Pago recibido
            </Typography>
            <Typography variant='caption'>
              El pedido sigue su curso normal. La otra sucursal ya lo ve para despacharlo.
            </Typography>
          </Alert>
        ) : paidLate ? (
          <Alert severity='error'>
            <Typography variant='body2' className='font-medium'>
              El cliente pagó tarde
            </Typography>
            <Typography variant='caption'>
              El pedido quedó anulado y hay Bs {transfer?.refundPending || '0.00'} para devolverle. Queda
              registrado en devoluciones pendientes.
            </Typography>
          </Alert>
        ) : (
          <>
            {qrError ? (
              <Alert severity='error' sx={{ mb: 3 }}>
                {qrError}
              </Alert>
            ) : generateQr.isPending ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                <CircularProgress />
              </Box>
            ) : (
              qr?.qr && (
                <Box sx={{ textAlign: 'center' }}>
                  <Box
                    component='img'
                    src={qr.qr.startsWith('data:') ? qr.qr : `data:image/png;base64,${qr.qr}`}
                    alt='QR del anticipo'
                    sx={{ width: '100%', maxWidth: 260, mx: 'auto' }}
                  />
                  <Typography variant='caption' color='text.secondary' sx={{ display: 'block' }}>
                    El cliente lo escanea desde su banco
                  </Typography>
                </Box>
              )
            )}

            {isExpired ? (
              <Alert severity='warning' sx={{ mt: 3 }}>
                <Typography variant='body2' className='font-medium'>
                  El QR venció
                </Typography>
                <Typography variant='caption'>
                  La prenda dejó de estar apartada: otra persona puede comprarla. Genere otro QR o anule el
                  pedido.
                </Typography>
              </Alert>
            ) : (
              isWaiting && (
                <Alert severity='info' sx={{ mt: 3 }}>
                  Esperando el pago… La prenda queda apartada hasta las {formatTime(transfer?.qrExpiresAt || null)}.
                </Alert>
              )
            )}
          </>
        )}
      </DialogContent>

      <DialogActions>
        {isPaid || paidLate ? (
          <Button variant='contained' onClick={onClose}>
            Entendido
          </Button>
        ) : (
          <>
            <Button
              color='error'
              onClick={handleCancel}
              disabled={cancelTransfer.isPending}
              startIcon={cancelTransfer.isPending ? <CircularProgress size={16} /> : undefined}
            >
              Anular pedido
            </Button>
            <Button
              variant='contained'
              onClick={() => generate(transferId)}
              disabled={generateQr.isPending}
              startIcon={generateQr.isPending ? <CircularProgress size={16} /> : <i className='tabler-refresh' />}
            >
              Generar otro QR
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  )
}

export default RequestQrDialog
