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
import TransferActionsModal from './TransferActionsModal'
import TransferDetailsModal from './TransferDetailsModal'
import StageChip, { PendingReviewChip } from './StageChip'
import { canDo, hasPendingReview, transferUnits } from './transfers'
import { prendas, variantes } from './units'
import { useBranchContext } from '@/contexts/BranchContext'
import { useBranchTransfers, useCentralWarehouse } from '@/hooks/useBranchTransfers'
import { useCentralWarehouseAlerts } from '@/hooks/useCentralWarehouseAlerts'
import type { BranchTransfer } from '@/types/api/branchTransfer'

type ActionKind = 'cancel' | 'mark-lost' | 'review'

// Solo lo que salio de verdad de la bodega. Sin "Todos" a proposito: el listado acepta un
// solo status, y "todos" traeria tambien las reposiciones sin atender (pending_dispatch) y
// las rechazadas (not_found), que son pedidos y viven en el menu Reposiciones
type DispatchStatus = 'in_transit' | 'received' | 'lost' | 'cancelled'

const formatDate = (value: string | null) => (value ? new Date(value).toLocaleString('es-BO') : '—')

const DispatchHistoryTable = () => {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [status, setStatus] = useState<DispatchStatus>('in_transit')
  const [showAll, setShowAll] = useState(false)
  const [details, setDetails] = useState<BranchTransfer | null>(null)
  const [action, setAction] = useState<{ kind: ActionKind; transfer: BranchTransfer } | null>(null)
  const [snackbar, setSnackbar] = useState<{ message: string; severity: 'success' | 'error' } | null>(null)

  const { data: warehouse, isError: isWarehouseError } = useCentralWarehouse()

  // El destino es la sucursal de la navbar. No hay filtro por destino en el endpoint:
  // se cambia la perspectiva de la consulta a "lo que le llego a esa sucursal".
  const { selectedBranch } = useBranchContext()

  // Con una sucursal: lo que le llego desde la bodega. Sin ninguna: todo lo que salio de la bodega.
  const perspective =
    selectedBranch && !showAll
      ? { branchId: selectedBranch.id, direction: 'incoming' as const }
      : { branchId: warehouse?.id, direction: 'outgoing' as const }

  const isFilteredByBranch = !!selectedBranch && !showAll

  const { data, isLoading, isError } = useBranchTransfers(
    {
      page,
      limit: pageSize,
      ...perspective,

      // Los pedidos entre tiendas no pasan por la bodega: viven en Pedidos entre sucursales
      type: 'central_dispatch',
      status
    },
    !!warehouse?.id
  )

  const transfers = data?.data || []
  const total = data?.meta?.total || 0

  const { pendingReview } = useCentralWarehouseAlerts()

  // Un envio de la bodega solo queda con faltantes al recibirse: estan entre los recibidos
  const isShowingReviewable = status === 'received' && (showAll || !selectedBranch)

  const showReviewable = () => {
    setStatus('received')
    setShowAll(true)
    setPage(1)
  }

  const openAction = (kind: ActionKind, transfer: BranchTransfer) => {
    setDetails(null)
    setAction({ kind, transfer })
  }

  if (isWarehouseError) {
    return (
      <Card>
        <Box sx={{ p: 4 }}>
          <Alert severity='error'>
            No se pudo acceder a la bodega central. Verifique que su usuario tenga permiso (ADMIN o SUPERVISOR).
          </Alert>
        </Box>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader
          title={isFilteredByBranch ? `Envíos de la bodega a ${selectedBranch.name}` : 'Envíos de la bodega'}
          subheader='Un envío en camino puede anularse o marcarse como perdido. Una vez recibido, ya no.'
        />

        <Box className='flex flex-wrap items-center justify-end gap-4 px-6 pb-4'>
          <FormControlLabel
            control={
              <Switch
                checked={showAll}
                onChange={e => {
                  setShowAll(e.target.checked)
                  setPage(1)
                }}
              />
            }
            label='Ver todas las sucursales'
          />

          <CustomTextField
            select
            label='Estado'
            value={status}
            onChange={e => {
              setStatus(e.target.value as DispatchStatus)
              setPage(1)
            }}
            className='max-sm:is-full sm:is-[220px]'
          >
            <MenuItem value='in_transit'>En camino</MenuItem>
            <MenuItem value='received'>Recibidos</MenuItem>
            <MenuItem value='lost'>Perdidos</MenuItem>
            <MenuItem value='cancelled'>Anulados</MenuItem>
          </CustomTextField>
        </Box>

        {/* El conteo es de todas las sucursales: el atajo muestra los recibidos de todas */}
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
                ? '1 envío llegó con menos de lo enviado y falta revisarlo.'
                : `${pendingReview} envíos llegaron con menos de lo enviado y falta revisarlos.`}
            </Alert>
          </Box>
        )}

        <Divider />

        {isError ? (
          <Box sx={{ p: 4 }}>
            <Alert severity='error'>Error al cargar los envíos.</Alert>
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
              {isFilteredByBranch
                ? `No hay envíos a ${selectedBranch.name} en ese estado`
                : 'No hay envíos en ese estado'}
            </Typography>
          </Box>
        ) : (
          <div className='overflow-x-auto'>
            <table className={tableStyles.table}>
              <thead>
                <tr>
                  <th>Envío</th>
                  {!isFilteredByBranch && <th>Destino</th>}
                  <th>Estado</th>
                  <th>Despachado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {transfers.map(transfer => {
                  const units = transferUnits(transfer)
                  const pendingReview = hasPendingReview(transfer)
                  const inTransit = transfer.status === 'in_transit'

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
                          {prendas(units)} en {variantes(transfer.items.length)}
                        </Typography>
                      </td>
                      {!isFilteredByBranch && (
                        <td>
                          <Typography variant='body2'>{transfer.destinationBranch?.name || '—'}</Typography>
                        </td>
                      )}
                      <td>
                        <Box className='flex flex-wrap items-center gap-2'>
                          <StageChip transfer={transfer} />
                          {/* Una reposicion atendida es un envio mas: solo se marca de donde vino */}
                          {transfer.replenishment && (
                            <Chip label='Reposición' size='small' variant='outlined' color='secondary' />
                          )}
                          {pendingReview && <PendingReviewChip />}
                        </Box>
                      </td>
                      <td>
                        <Typography variant='body2'>{formatDate(transfer.dispatchedAt)}</Typography>
                        <Typography variant='caption' color='text.secondary'>
                          {transfer.dispatchedBy?.name || '—'}
                        </Typography>
                      </td>
                      <td onClick={event => event.stopPropagation()}>
                        <Box className='flex items-center gap-1'>
                          <Tooltip title='Ver detalles'>
                            <IconButton size='small' onClick={() => setDetails(transfer)}>
                              <i className='tabler-eye' />
                            </IconButton>
                          </Tooltip>

                          {canDo(transfer, 'cancel', inTransit) && (
                            <Tooltip title='Anular: volvió a la bodega'>
                              <IconButton size='small' color='secondary' onClick={() => openAction('cancel', transfer)}>
                                <i className='tabler-ban' />
                              </IconButton>
                            </Tooltip>
                          )}
                          {canDo(transfer, 'markLost', inTransit) && (
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

export default DispatchHistoryTable
