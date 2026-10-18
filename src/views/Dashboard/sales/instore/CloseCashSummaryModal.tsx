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

import type { DailyCash } from '@/types/api/dailyCash'

type Props = {
  dailyCash: DailyCash | null
  onClose: () => void
}

const money = (value: string | null) => `Bs ${Number(value ?? 0).toFixed(2)}`

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
  if (!dailyCash) return null

  const expected = Number(dailyCash.expectedAmount ?? 0)
  const counted = Number(dailyCash.closingAmount ?? 0)
  const difference = counted - expected

  // Las cajas cerradas antes del cambio del back no traen desglose
  const hasBreakdown = dailyCash.salesAmount !== null

  return (
    <Dialog open onClose={onClose} maxWidth='xs' fullWidth>
      <DialogTitle>Caja cerrada</DialogTitle>

      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Row label='Apertura' value={money(dailyCash.openingAmount)} />

          {hasBreakdown && (
            <>
              <Row label='Ventas del turno' value={money(dailyCash.salesAmount)} />
              <Row label='Anticipos cobrados' value={money(dailyCash.advancesAmount)} />
              <Row label='Devoluciones' value={`- ${money(dailyCash.refundsAmount)}`} />
            </>
          )}

          <Divider />

          <Row label='Esperado en caja' value={money(dailyCash.expectedAmount)} strong />
          <Row label='Contado' value={money(dailyCash.closingAmount)} strong />
        </Box>

        <Alert severity={difference === 0 ? 'success' : difference > 0 ? 'info' : 'error'} sx={{ mt: 4 }}>
          {difference === 0
            ? 'La caja cuadra.'
            : difference > 0
              ? `Sobran Bs ${difference.toFixed(2)}.`
              : `Faltan Bs ${Math.abs(difference).toFixed(2)}.`}
        </Alert>

        {dailyCash.closingNote && (
          <Typography variant='body2' sx={{ mt: 3, fontStyle: 'italic' }}>
            “{dailyCash.closingNote}”
          </Typography>
        )}
      </DialogContent>

      <DialogActions>
        <Button variant='contained' onClick={onClose}>
          Entendido
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default CloseCashSummaryModal
