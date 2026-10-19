'use client'

import { useState } from 'react'

import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import Typography from '@mui/material/Typography'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import TablePagination from '@mui/material/TablePagination'
import Skeleton from '@mui/material/Skeleton'
import Alert from '@mui/material/Alert'

import tableStyles from '@core/styles/table.module.css'
import { useBranchContext } from '@/contexts/BranchContext'
import { useDailyCashHistory } from '@/hooks/useDailyCash'
import type { DailyCash } from '@/types/api/dailyCash'

const money = (value: string | null) => `Bs ${Number(value ?? 0).toFixed(2)}`

const formatDate = (value: string | null) => (value ? new Date(value).toLocaleString('es-BO') : '—')

// Diferencia entre lo contado y lo esperado: negativa = faltante
const difference = (cash: DailyCash) => Number(cash.closingAmount ?? 0) - Number(cash.expectedAmount ?? 0)

const DailyCashHistoryTable = () => {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [detail, setDetail] = useState<DailyCash | null>(null)

  // Solo ADMIN/SUPERVISOR filtran por sucursal; el MANAGER ve la suya
  const { selectedBranchId, isAdmin } = useBranchContext()

  const { data, isLoading, isError } = useDailyCashHistory({
    page,
    limit: pageSize,
    ...(isAdmin && selectedBranchId ? { branchId: selectedBranchId } : {})
  })

  const rows = data?.data || []
  const total = data?.meta?.total || 0

  return (
    <>
      <Card>
        <CardHeader
          title='Historial de caja'
          subheader='Cada turno con lo que se esperaba, lo que se contó y la diferencia.'
        />

        <Divider />

        {isError ? (
          <Box sx={{ p: 4 }}>
            <Alert severity='error'>Error al cargar el historial.</Alert>
          </Box>
        ) : isLoading ? (
          <Box sx={{ p: 6 }}>
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} height={48} sx={{ mb: 1 }} />
            ))}
          </Box>
        ) : rows.length === 0 ? (
          <Box sx={{ p: 8, textAlign: 'center' }}>
            <Typography color='text.secondary'>Todavía no hay cajas registradas</Typography>
          </Box>
        ) : (
          <div className='overflow-x-auto'>
            <table className={tableStyles.table}>
              <thead>
                <tr>
                  <th>Turno</th>
                  <th>Sucursal</th>
                  <th>Apertura</th>
                  <th>Esperado</th>
                  <th>Contado</th>
                  <th>Diferencia</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map(cash => {
                  const isOpen = cash.status === 'open'
                  const diff = difference(cash)

                  return (
                    <tr key={cash.id}>
                      <td>
                        <Typography variant='body2' className='font-medium'>
                          {formatDate(cash.openedAt)}
                        </Typography>
                        <Typography variant='caption' color='text.secondary'>
                          {isOpen ? 'Abierta' : `Cerrada ${formatDate(cash.closedAt)}`}
                        </Typography>
                      </td>
                      <td>
                        <Typography variant='body2'>{cash.branch?.name || '—'}</Typography>
                      </td>
                      <td>
                        <Typography variant='body2'>{money(cash.openingAmount)}</Typography>
                      </td>
                      <td>
                        <Typography variant='body2'>{isOpen ? '—' : money(cash.expectedAmount)}</Typography>
                      </td>
                      <td>
                        <Typography variant='body2'>{isOpen ? '—' : money(cash.closingAmount)}</Typography>
                      </td>
                      <td>
                        {isOpen ? (
                          <Chip label='En curso' size='small' variant='tonal' color='primary' />
                        ) : (
                          <Chip
                            label={diff === 0 ? 'Cuadra' : diff > 0 ? `Sobra ${money(String(diff))}` : `Falta ${money(String(Math.abs(diff)))}`}
                            size='small'
                            variant='tonal'
                            color={diff === 0 ? 'success' : diff > 0 ? 'info' : 'error'}
                          />
                        )}
                      </td>
                      <td>
                        <Tooltip title='Ver detalle'>
                          <IconButton size='small' onClick={() => setDetail(cash)}>
                            <i className='tabler-eye' />
                          </IconButton>
                        </Tooltip>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <Divider />

        <TablePagination
          component='div'
          count={total}
          page={page - 1}
          onPageChange={(_, newPage) => setPage(newPage + 1)}
          rowsPerPage={pageSize}
          onRowsPerPageChange={e => {
            setPageSize(parseInt(e.target.value, 10))
            setPage(1)
          }}
          rowsPerPageOptions={[10, 25, 50]}
          labelRowsPerPage='Filas por página'
        />
      </Card>

      <Dialog open={!!detail} onClose={() => setDetail(null)} maxWidth='xs' fullWidth>
        <DialogTitle>
          Caja del {formatDate(detail?.openedAt || null)}
          <Typography variant='body2' color='text.secondary' sx={{ mt: 1 }}>
            {detail?.branch?.name}
          </Typography>
        </DialogTitle>

        <DialogContent>
          {detail && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box className='flex items-center justify-between'>
                <Typography variant='body2'>Apertura</Typography>
                <Typography variant='body2'>{money(detail.openingAmount)}</Typography>
              </Box>

              {/* Las cajas cerradas antes del cambio del back no traen desglose */}
              {detail.salesAmount !== null && (
                <>
                  <Box className='flex items-center justify-between'>
                    <Typography variant='body2'>Ventas del turno</Typography>
                    <Typography variant='body2'>{money(detail.salesAmount)}</Typography>
                  </Box>
                  <Box className='flex items-center justify-between'>
                    <Typography variant='body2'>Anticipos cobrados</Typography>
                    <Typography variant='body2'>{money(detail.advancesAmount)}</Typography>
                  </Box>
                  <Box className='flex items-center justify-between'>
                    <Typography variant='body2'>Devoluciones</Typography>
                    <Typography variant='body2'>- {money(detail.refundsAmount)}</Typography>
                  </Box>
                </>
              )}

              <Divider />

              <Box className='flex items-center justify-between'>
                <Typography variant='body2' className='font-medium'>
                  Esperado en caja
                </Typography>
                <Typography variant='body2' className='font-medium'>
                  {detail.status === 'open' ? 'Caja abierta' : money(detail.expectedAmount)}
                </Typography>
              </Box>
              <Box className='flex items-center justify-between'>
                <Typography variant='body2' className='font-medium'>
                  Contado
                </Typography>
                <Typography variant='body2' className='font-medium'>
                  {detail.status === 'open' ? '—' : money(detail.closingAmount)}
                </Typography>
              </Box>

              {detail.status === 'closed' && (
                <Alert
                  severity={
                    difference(detail) === 0 ? 'success' : difference(detail) > 0 ? 'info' : 'error'
                  }
                >
                  {difference(detail) === 0
                    ? 'La caja cuadró.'
                    : difference(detail) > 0
                      ? `Sobraron ${money(String(difference(detail)))}.`
                      : `Faltaron ${money(String(Math.abs(difference(detail))))}.`}
                </Alert>
              )}

              {detail.closingNote && (
                <Typography variant='body2' sx={{ fontStyle: 'italic' }}>
                  “{detail.closingNote}”
                </Typography>
              )}

              <Typography variant='caption' color='text.secondary'>
                Abrió {detail.openedBy?.name || '—'}
                {detail.closedBy ? ` · Cerró ${detail.closedBy.name}` : ''}
              </Typography>
            </Box>
          )}
        </DialogContent>

        <DialogActions>
          <Button variant='contained' onClick={() => setDetail(null)}>
            Cerrar
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

export default DailyCashHistoryTable
