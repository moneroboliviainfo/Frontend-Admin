'use client'

import { useState } from 'react'

import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import Typography from '@mui/material/Typography'
import MenuItem from '@mui/material/MenuItem'
import TablePagination from '@mui/material/TablePagination'
import Skeleton from '@mui/material/Skeleton'
import Alert from '@mui/material/Alert'
import Snackbar from '@mui/material/Snackbar'
import IconButton from '@mui/material/IconButton'
import Switch from '@mui/material/Switch'
import FormControlLabel from '@mui/material/FormControlLabel'
import Tooltip from '@mui/material/Tooltip'

import CustomTextField from '@core/components/mui/TextField'
import tableStyles from '@core/styles/table.module.css'
import { useBranchContext } from '@/contexts/BranchContext'
import { useDeclareBranchScope } from '@/contexts/BranchScopeContext'
import { useBranchRequestAlerts } from '@/hooks/useBranchRequestAlerts'
import { useBranchTransfers } from '@/hooks/useBranchTransfers'
import type { BranchTransfer, BranchTransferStatus } from '@/types/api/branchTransfer'
import TransferActionsModal from '@/views/Dashboard/central-warehouse/TransferActionsModal'
import TransferDetailsModal from '@/views/Dashboard/central-warehouse/TransferDetailsModal'
import StageChip, { PendingReviewChip } from '@/views/Dashboard/central-warehouse/StageChip'
import { canDo, hasPendingReview, transferUnits } from '@/views/Dashboard/central-warehouse/transfers'
import { prendas, variantes } from '@/views/Dashboard/central-warehouse/units'

type ActionKind = 'cancel' | 'mark-lost' | 'review'

const statuses: [BranchTransferStatus, string][] = [
  ['pending_payment', 'Esperando pago'],
  ['pending_dispatch', 'Por despachar'],
  ['in_transit', 'En camino'],
  ['not_found', 'No encontrado'],
  ['received', 'Recibido'],
  ['lost', 'Perdido'],
  ['cancelled', 'Anulado']
]

const formatDate = (value: string | null) => (value ? new Date(value).toLocaleString('es-BO') : '—')

// Vista de la central sobre los pedidos de tienda a tienda. Las tiendas piden, despachan
// y reciben; la central solo vigila, anula, da por perdido y resuelve faltantes.
const AdminRequestsTable = () => {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [status, setStatus] = useState<BranchTransferStatus | 'all'>('all')
  const [todasLasSucursales, setTodasLasSucursales] = useState(true)
  const [onlyReview, setOnlyReview] = useState(false)
  const [details, setDetails] = useState<BranchTransfer | null>(null)
  const [action, setAction] = useState<{ kind: ActionKind; transfer: BranchTransfer } | null>(null)
  const [snackbar, setSnackbar] = useState<{ message: string; severity: 'success' | 'error' } | null>(null)

  const { selectedBranchId, selectedBranch } = useBranchContext()

  // Con "Todas" el selector de la navbar no cambia nada de lo que se ve: se oculta
  useDeclareBranchScope(!todasLasSucursales)

  const { data, isLoading, isError } = useBranchTransfers({
    page,
    limit: pageSize,
    type: 'branch_request',
    ...(status !== 'all' && { status }),

    // Con una sucursal salen los pedidos donde es origen o destino
    ...(!todasLasSucursales && selectedBranchId ? { branchId: selectedBranchId } : {}),
    ...(onlyReview && { discrepancyStatus: 'pending_review' as const })
  })

  const transfers = data?.data || []
  const total = data?.meta?.total || 0

  const { pendingReview } = useBranchRequestAlerts()

  const isShowingReviewable = onlyReview && todasLasSucursales && status === 'all'

  const showReviewable = () => {
    setOnlyReview(true)
    setTodasLasSucursales(true)
    setStatus('all')
    setPage(1)
  }

  const openAction = (kind: ActionKind, transfer: BranchTransfer) => {
    setDetails(null)
    setAction({ kind, transfer })
  }

  return (
    <>
      <Card>
        <CardHeader
          title='Pedidos entre sucursales'
          subheader='Lo que una tienda le pidió a otra para un cliente. Antes del despacho se puede anular; en camino, marcar perdido.'
        />

        <Box className='flex flex-wrap items-center justify-end gap-4 px-6 pb-4'>
          <FormControlLabel
            control={
              <Switch
                checked={onlyReview}
                onChange={e => {
                  setOnlyReview(e.target.checked)
                  setPage(1)
                }}
              />
            }
            label='Solo con faltantes por revisar'
          />

          {/* Por defecto se ven todas; al apagarlo manda la sucursal del
              selector de la navbar, que es el estado global de la app */}
          <FormControlLabel
            label='Todas las sucursales'
            control={
              <Switch
                checked={todasLasSucursales}
                onChange={e => {
                  setTodasLasSucursales(e.target.checked)
                  setPage(1)
                }}
              />
            }
          />
          {!todasLasSucursales && (
            <Chip
              label={selectedBranch?.name || 'Sin sucursal'}
              color={selectedBranch ? 'primary' : 'default'}
              size='small'
            />
          )}

          <CustomTextField
            select
            label='Estado'
            value={status}
            onChange={e => {
              setStatus(e.target.value as BranchTransferStatus | 'all')
              setPage(1)
            }}
            className='max-sm:is-full sm:is-[220px]'
          >
            <MenuItem value='all'>Todos</MenuItem>
            {statuses.map(([value, label]) => (
              <MenuItem key={value} value={value}>
                {label}
              </MenuItem>
            ))}
          </CustomTextField>
        </Box>

        {/* El conteo es de todas las sucursales: el atajo deja la vista que los muestra a todos */}
        {pendingReview > 0 && (
          <Box sx={{ px: 6, pb: 4 }}>
            <Alert
              severity='warning'
              action={
                !isShowingReviewable && (
                  <Button color='inherit' size='small' onClick={showReviewable}>
                    Revisar
                  </Button>
                )
              }
            >
              {pendingReview === 1
                ? '1 pedido llegó con menos de lo pedido y falta revisarlo.'
                : `${pendingReview} pedidos llegaron con menos de lo pedido y falta revisarlos.`}
            </Alert>
          </Box>
        )}

        <Divider />

        {isError ? (
          <Box sx={{ p: 4 }}>
            <Alert severity='error'>Error al cargar los pedidos.</Alert>
          </Box>
        ) : isLoading ? (
          <Box sx={{ p: 6 }}>
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} height={48} sx={{ mb: 1 }} />
            ))}
          </Box>
        ) : transfers.length === 0 ? (
          <Box sx={{ p: 8, textAlign: 'center' }}>
            <Typography color='text.secondary'>
              {onlyReview ? 'No hay pedidos con faltantes por revisar' : 'No hay pedidos con esos filtros'}
            </Typography>
          </Box>
        ) : (
          <div className='overflow-x-auto'>
            <table className={tableStyles.table}>
              <thead>
                <tr>
                  <th>Pedido</th>
                  <th>De → Para</th>
                  <th>Cliente</th>
                  <th>Estado</th>
                  <th>Pedido el</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {transfers.map(transfer => {
                  const pendingReview = hasPendingReview(transfer)

                  const beforeDispatch = transfer.status === 'pending_payment' || transfer.status === 'pending_dispatch'

                  return (
                    <tr
                      key={transfer.id}
                      onClick={() => setDetails(transfer)}
                      style={{ cursor: 'pointer' }}
                      className='hover:bg-[var(--mui-palette-action-hover)]'
                    >
                      <td>
                        <Typography variant='body2' className='font-medium'>
                          #{transfer.id}
                        </Typography>
                        <Typography variant='caption' color='text.secondary'>
                          {prendas(transferUnits(transfer))} en {variantes(transfer.items.length)}
                        </Typography>
                      </td>
                      <td>
                        <Typography variant='body2'>
                          {transfer.sourceBranch?.name || '—'} → {transfer.destinationBranch?.name || '—'}
                        </Typography>
                      </td>
                      <td>
                        <Typography variant='body2'>{transfer.customerName || '—'}</Typography>
                        {transfer.advanceAmount && (
                          <Typography variant='caption' color='text.secondary'>
                            Anticipo Bs {transfer.advanceAmount}
                          </Typography>
                        )}
                      </td>
                      <td>
                        <Box className='flex flex-wrap items-center gap-2'>
                          <StageChip transfer={transfer} />
                          {pendingReview && <PendingReviewChip />}
                        </Box>
                      </td>
                      <td>
                        <Typography variant='body2'>{formatDate(transfer.requestedAt)}</Typography>
                        <Typography variant='caption' color='text.secondary'>
                          {transfer.requestedBy?.name || '—'}
                        </Typography>
                      </td>
                      <td onClick={event => event.stopPropagation()}>
                        <Box className='flex items-center gap-1'>
                          <Tooltip title='Ver detalles'>
                            <IconButton size='small' onClick={() => setDetails(transfer)}>
                              <i className='tabler-eye' />
                            </IconButton>
                          </Tooltip>
                          {canDo(transfer, 'cancel', beforeDispatch) && (
                            <Tooltip title='Anular: la prenda vuelve al origen'>
                              <IconButton size='small' color='secondary' onClick={() => openAction('cancel', transfer)}>
                                <i className='tabler-ban' />
                              </IconButton>
                            </Tooltip>
                          )}
                          {canDo(transfer, 'markLost', transfer.status === 'in_transit') && (
                            <Tooltip title='Marcar perdido: no está en ningún lado'>
                              <IconButton size='small' color='error' onClick={() => openAction('mark-lost', transfer)}>
                                <i className='tabler-alert-triangle' />
                              </IconButton>
                            </Tooltip>
                          )}
                          {canDo(transfer, 'review', pendingReview) && (
                            <Tooltip title='Revisar faltantes'>
                              <IconButton size='small' color='warning' onClick={() => openAction('review', transfer)}>
                                <i className='tabler-checkup-list' />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Box>
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

      <TransferDetailsModal
        transfer={details}
        onClose={() => setDetails(null)}
        onAction={kind => details && openAction(kind, details)}
      />

      <TransferActionsModal
        action={action}
        onClose={() => setAction(null)}
        showMessage={(message, severity) => setSnackbar({ message, severity })}
      />

      <Snackbar
        open={!!snackbar}
        autoHideDuration={5000}
        onClose={() => setSnackbar(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={snackbar?.severity} onClose={() => setSnackbar(null)} variant='filled'>
          {snackbar?.message}
        </Alert>
      </Snackbar>
    </>
  )
}

export default AdminRequestsTable
