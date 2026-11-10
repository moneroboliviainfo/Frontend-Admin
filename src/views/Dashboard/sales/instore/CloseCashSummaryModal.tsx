'use client'

import { useState } from 'react'

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

import type { DailyCash } from '@/types/api/dailyCash'
import { isBluetoothAvailable } from '@/utils/bluetoothPrinter'
import {
  diferenciaDeCaja,
  esperadoEnCajon,
  printCashClosing,
  printCashClosingBluetooth,
  sinContar,
  tieneDesglosePorMedio
} from '@/utils/cashClosingReceipt'

type Props = {
  dailyCash: DailyCash | null
  onClose: () => void
}

const money = (value: string | null | undefined) => `Bs ${Number(value ?? 0).toFixed(2)}`

const Row = ({ label, value, strong }: { label: string; value: string; strong?: boolean }) => (
  <Box className='flex items-center justify-between'>
    <Typography variant='body2' className={strong ? 'font-medium' : undefined}>
      {label}
    </Typography>
    <Typography variant='body2' className={strong ? 'font-medium' : undefined}>
      {value}
    </Typography>
  </Box>
)

const CloseCashSummaryModal = ({ dailyCash, onClose }: Props) => {
  const [imprimiendo, setImprimiendo] = useState(false)
  const [printError, setPrintError] = useState('')

  if (!dailyCash) return null

  // La diferencia va SOLO contra el efectivo esperado en el cajon: comparar
  // contra el total daba un faltante falso por el monto de la tarjeta y el QR,
  // que nunca estuvieron ahi
  const difference = diferenciaDeCaja(dailyCash)

  // Las cajas cerradas antes del cambio del back no traen desglose
  const hasBreakdown = dailyCash.salesAmount !== null
  const hasByMethod = tieneDesglosePorMedio(dailyCash)

  const imprimirTermica = async () => {
    setImprimiendo(true)
    setPrintError('')

    try {
      await printCashClosingBluetooth(dailyCash)
    } catch (error: any) {
      setPrintError(error?.message || 'No se pudo imprimir por Bluetooth')
    } finally {
      setImprimiendo(false)
    }
  }

  return (
    <Dialog open onClose={onClose} maxWidth='xs' fullWidth>
      <DialogTitle>Caja cerrada</DialogTitle>

      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Lo cobrado por cada medio: es lo que el cajero necesita para
              cuadrar los vouchers y el banco, y lo que pide el comprobante */}
          {hasByMethod && (
            <>
              <Typography variant='caption' color='text.secondary'>
                COBRADO POR MEDIO DE PAGO
              </Typography>
              <Row label='Efectivo' value={money(dailyCash.cashAmount)} />
              <Row label='Tarjeta' value={money(dailyCash.cardAmount)} />
              <Row label='QR' value={money(dailyCash.qrAmount)} />
              <Divider />
            </>
          )}

          <Row label='Apertura' value={money(dailyCash.openingAmount)} />

          {/* Salieron del cajon, por eso bajan el esperado. `null` en las cajas
              cerradas antes del 8/11/2026: ahi no se muestran */}
          {dailyCash.expensesAmount != null && Number(dailyCash.expensesAmount) > 0 && (
            <Row label='Gastos' value={`- ${money(dailyCash.expensesAmount)}`} />
          )}
          {dailyCash.withdrawalsAmount != null && Number(dailyCash.withdrawalsAmount) > 0 && (
            <Row label='Retiros' value={`- ${money(dailyCash.withdrawalsAmount)}`} />
          )}

          {hasBreakdown && (
            <>
              <Row label='Ventas del turno' value={money(dailyCash.salesAmount)} />
              <Row label='Anticipos cobrados' value={money(dailyCash.advancesAmount)} />
              <Row label='Devoluciones' value={`- ${money(dailyCash.refundsAmount)}`} />
            </>
          )}

          <Divider />

          <Typography variant='caption' color='text.secondary'>
            EN EL CAJÓN (solo efectivo)
          </Typography>
          <Row label='Esperado' value={money(String(esperadoEnCajon(dailyCash)))} strong />
          <Row label='Contado' value={sinContar(dailyCash) ? 'Sin contar' : money(dailyCash.closingAmount)} strong />
        </Box>

        {/* Sin conteo no hay diferencia que mostrar (ver sinContar) */}
        <Alert
          severity={sinContar(dailyCash) ? 'warning' : difference === 0 ? 'success' : difference > 0 ? 'info' : 'error'}
          sx={{ mt: 4 }}
        >
          {sinContar(dailyCash)
            ? 'Esta caja todavía no se contó.'
            : difference === 0
            ? 'La caja cuadra.'
            : difference > 0
              ? `Sobran Bs ${difference.toFixed(2)}.`
              : `Faltan Bs ${Math.abs(difference).toFixed(2)}.`}
        </Alert>

        {hasByMethod && (
          <Typography variant='caption' color='text.secondary' sx={{ mt: 2, display: 'block' }}>
            La tarjeta y el QR no se cuentan en el cajón: se controlan contra los vouchers y el banco.
          </Typography>
        )}

        {dailyCash.closingNote && (
          <Typography variant='body2' sx={{ mt: 3, fontStyle: 'italic' }}>
            “{dailyCash.closingNote}”
          </Typography>
        )}

        {printError && (
          <Alert severity='error' sx={{ mt: 3 }}>
            {printError}
          </Alert>
        )}
      </DialogContent>

      <DialogActions sx={{ gap: 1, flexWrap: 'wrap' }}>
        <Button
          variant='outlined'
          startIcon={<i className='tabler-printer' />}
          onClick={() => printCashClosing(dailyCash)}
        >
          Imprimir
        </Button>

        {isBluetoothAvailable() && (
          <Button
            variant='outlined'
            disabled={imprimiendo}
            startIcon={imprimiendo ? <CircularProgress size={16} /> : <i className='tabler-bluetooth' />}
            onClick={imprimirTermica}
          >
            {imprimiendo ? 'Imprimiendo...' : 'Térmica'}
          </Button>
        )}

        <Button variant='contained' onClick={onClose}>
          Entendido
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default CloseCashSummaryModal
