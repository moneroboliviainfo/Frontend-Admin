'use client'

import { useState } from 'react'

import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
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
import { useDeclareBranchScope } from '@/contexts/BranchScopeContext'
import { useDailyCashHistory, useMyDailyCashHistory } from '@/hooks/useDailyCash'
import type { DailyCash, DailyCashStatus } from '@/types/api/dailyCash'
import {
  diferenciaDeCaja,
  esperadoEnCajon,
  printCashClosing,
  sinContar,
  tieneDesglosePorMedio
} from '@/utils/cashClosingReceipt'

// Acepta undefined: los totales por medio de pago son opcionales (las cajas
// cerradas antes del 7/11/2026 no los traen)
const money = (value: string | null | undefined) => `Bs ${Number(value ?? 0).toFixed(2)}`

const formatDate = (value: string | null) => (value ? new Date(value).toLocaleString('es-BO') : '—')

// Diferencia entre lo contado y lo esperado EN EL CAJON: negativa = faltante.
// Va contra el efectivo, no contra el total: `expectedAmount` incluye tarjeta y
// QR, que nunca estuvieron en el cajon, y restarlos daba un faltante falso del
// tamaño de esas ventas. Las cajas viejas sin `expectedCashAmount` siguen
// comparandose contra el total, como cuando se cerraron (ver cashClosingReceipt)
const difference = diferenciaDeCaja

// 'branch' = el historial de la sucursal (A/S/M), en /cash.
// 'mine'   = las cajas del usuario logueado (M/C), en /cash/mine.
// Es la misma tabla: cambia de donde salen las filas y el encabezado. Los dos
// hooks se llaman siempre —no se pueden llamar condicionalmente— y el que no
// corresponde queda deshabilitado, sin pedir nada.
type Props = {
  scope?: 'branch' | 'mine'
}

const DailyCashHistoryTable = ({ scope = 'branch' }: Props) => {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [detail, setDetail] = useState<DailyCash | null>(null)

  // 'open' = las cajas abiertas AHORA, una por cajero. Es lo que reemplaza al
  // GET /dailyCash/current que ADMIN y SUPERVISOR ya no pueden usar: sin esto
  // no tienen forma de ver a quien le falta cerrar.
  const [status, setStatus] = useState<'all' | DailyCashStatus>('all')

  const cambiarStatus = (valor: 'all' | DailyCashStatus) => {
    setStatus(valor)
    setPage(1)
  }

  // Solo ADMIN/SUPERVISOR filtran por sucursal; el MANAGER ve la suya
  const { selectedBranchId, isAdmin } = useBranchContext()

  const esMias = scope === 'mine'

  // 'Mis cajas' cuelga de /cash, que esta clasificada como vista de sucursal,
  // pero son las cajas del usuario: el selector de la navbar no cambia nada de
  // lo que se ve. Se declara general para que no aparezca (ver branchScope.ts)
  useDeclareBranchScope(!esMias)

  const filtroEstado = status === 'all' ? {} : { status }

  const branchQuery = useDailyCashHistory(
    {
      page,
      limit: pageSize,
      ...filtroEstado,
      ...(isAdmin && selectedBranchId ? { branchId: selectedBranchId } : {})
    },
    !esMias
  )

  const mineQuery = useMyDailyCashHistory({ page, limit: pageSize, ...filtroEstado }, esMias)

  const { data, isLoading, isError } = esMias ? mineQuery : branchQuery

  const rows = data?.data || []
  const total = data?.meta?.total || 0

  return (
    <>
      <Card>
        <CardHeader
          title={esMias ? 'Mis cajas' : 'Historial de caja'}
          subheader={
            esMias
              ? 'Tus turnos: lo cobrado por medio de pago, lo contado y la diferencia. Podés reimprimir el comprobante.'
              : 'Cada turno con lo que se esperaba, lo que se contó y la diferencia.'
          }
        />

        <Box sx={{ px: 6, pb: 4 }}>
          <ToggleButtonGroup
            exclusive
            size='small'
            value={status}
            onChange={(_, valor) => valor && cambiarStatus(valor)}
          >
            <ToggleButton value='all'>Todas</ToggleButton>
            <ToggleButton value='open'>Abiertas ahora</ToggleButton>
            <ToggleButton value='closed'>Cerradas</ToggleButton>
          </ToggleButtonGroup>
        </Box>

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
            <Typography color='text.secondary'>
              {status === 'open'
                ? 'No hay cajas abiertas en este momento'
                : status === 'closed'
                  ? 'Todavía no hay cajas cerradas'
                  : 'Todavía no hay cajas registradas'}
            </Typography>
          </Box>
        ) : (
          <div className='overflow-x-auto'>
            <table className={tableStyles.table}>
              <thead>
                <tr>
                  <th>Turno</th>
                  <th>Sucursal</th>
                  <th>Apertura</th>
                  {/* Lo cobrado por medio: el efectivo es lo unico que se cuenta
                      en el cajon; tarjeta y QR se cuadran contra vouchers y banco */}
                  <th>Efectivo</th>
                  <th>Tarjeta</th>
                  <th>QR</th>
                  <th>Contado</th>
                  <th>Diferencia</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map(cash => {
                  const isOpen = cash.status === 'open'
                  const diff = difference(cash)

                  // Las cajas cerradas antes del 7/11/2026 no traen el desglose
                  const conMedios = tieneDesglosePorMedio(cash)

                  return (
                    <tr key={cash.id}>
                      <td>
                        <Typography variant='body2' className='font-medium'>
                          {formatDate(cash.openedAt)}
                        </Typography>
                        <Typography variant='caption' color='text.secondary'>
                          {isOpen ? 'Abierta' : `Cerrada ${formatDate(cash.closedAt)}`}
                        </Typography>

                        {/* Una caja que cerro el sistema a medianoche se veia
                            igual que una cerrada a mano, y la que espera conteo
                            —la que tiene bloqueado a su dueño— no se distinguia */}
                        {cash.autoClosed && (
                          <Chip
                            label='Cierre automático'
                            size='small'
                            variant='tonal'
                            color='warning'
                            sx={{ mt: 0.5, height: 20, fontSize: '0.7rem' }}
                          />
                        )}
                        {cash.countPending && (
                          <Chip
                            label='Conteo pendiente'
                            size='small'
                            variant='tonal'
                            color='error'
                            sx={{ mt: 0.5, ml: 0.5, height: 20, fontSize: '0.7rem' }}
                          />
                        )}
                      </td>
                      <td>
                        <Typography variant='body2'>{cash.branch?.name || '—'}</Typography>
                      </td>
                      <td>
                        <Typography variant='body2'>{money(cash.openingAmount)}</Typography>
                      </td>
                      <td>
                        <Typography variant='body2'>{conMedios ? money(cash.cashAmount) : '—'}</Typography>
                      </td>
                      <td>
                        <Typography variant='body2'>{conMedios ? money(cash.cardAmount) : '—'}</Typography>
                      </td>
                      <td>
                        <Typography variant='body2'>{conMedios ? money(cash.qrAmount) : '—'}</Typography>
                      </td>
                      <td>
                        <Typography variant='body2'>{isOpen ? '—' : money(cash.closingAmount)}</Typography>
                      </td>
                      <td>
                        {isOpen ? (
                          <Chip label='En curso' size='small' variant='tonal' color='primary' />
                        ) : cash.countPending ? (

                          // Sin conteo no hay diferencia que mostrar: su
                          // closingAmount es null y restarlo daria un faltante
                          // igual a todo el esperado
                          <Chip label='Sin contar' size='small' variant='tonal' color='warning' />
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
              {/* Lo cobrado por cada medio: es contra esto que se cuadran los
                  vouchers y el banco. Las cajas viejas no lo traen */}
              {tieneDesglosePorMedio(detail) && (
                <>
                  <Typography variant='caption' color='text.secondary'>
                    COBRADO POR MEDIO DE PAGO
                  </Typography>
                  <Box className='flex items-center justify-between'>
                    <Typography variant='body2'>Efectivo</Typography>
                    <Typography variant='body2'>{money(detail.cashAmount)}</Typography>
                  </Box>
                  <Box className='flex items-center justify-between'>
                    <Typography variant='body2'>Tarjeta</Typography>
                    <Typography variant='body2'>{money(detail.cardAmount)}</Typography>
                  </Box>
                  <Box className='flex items-center justify-between'>
                    <Typography variant='body2'>QR</Typography>
                    <Typography variant='body2'>{money(detail.qrAmount)}</Typography>
                  </Box>
                  <Divider />
                </>
              )}

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
                  Esperado en el cajón
                </Typography>
                <Typography variant='body2' className='font-medium'>
                  {detail.status === 'open' ? 'Caja abierta' : money(String(esperadoEnCajon(detail)))}
                </Typography>
              </Box>
              <Box className='flex items-center justify-between'>
                <Typography variant='body2' className='font-medium'>
                  Contado
                </Typography>
                <Typography variant='body2' className='font-medium'>
                  {detail.status === 'open' ? '—' : sinContar(detail) ? 'Sin contar' : money(detail.closingAmount)}
                </Typography>
              </Box>

              {/* Sin conteo no hay diferencia: su closingAmount es null y la
                  resta daria un faltante igual a todo lo esperado */}
              {detail.status === 'closed' && sinContar(detail) && (
                <Alert severity='warning'>
                  Esta caja se cerró automáticamente y todavía no se contó el efectivo.
                </Alert>
              )}

              {detail.status === 'closed' && !sinContar(detail) && (
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

        <DialogActions sx={{ gap: 1 }}>
          {/* Reimprimir el comprobante: el ticket se pierde o lo pide el
              encargado despues. Solo tiene sentido en una caja ya cerrada */}
          {detail?.status === 'closed' && (
            <Button
              variant='outlined'
              startIcon={<i className='tabler-printer' />}
              onClick={() => printCashClosing(detail)}
            >
              Imprimir
            </Button>
          )}

          <Button variant='contained' onClick={() => setDetail(null)}>
            Cerrar
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

export default DailyCashHistoryTable
