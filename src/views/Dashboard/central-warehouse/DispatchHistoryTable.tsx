'use client'

import { useState } from 'react'

import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import Box from '@mui/material/Box'
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
import { prendas, variantes } from './units'
import { useBranchContext } from '@/contexts/BranchContext'
import { useBranchTransfers, useCentralWarehouse } from '@/hooks/useBranchTransfers'
import type { BranchTransfer, BranchTransferStatus } from '@/types/api/branchTransfer'

type ActionKind = 'cancel' | 'mark-lost' | 'review'

const statusLabels: Record<
  BranchTransferStatus,
  { label: string; color: 'primary' | 'success' | 'error' | 'warning' | 'secondary' }
> = {
  pending_payment: { label: 'Esperando pago', color: 'warning' },
  pending_dispatch: { label: 'Por despachar', color: 'warning' },
  in_transit: { label: 'En camino', color: 'primary' },
  not_found: { label: 'No encontrado', color: 'error' },
  received: { label: 'Recibido', color: 'success' },
  lost: { label: 'Perdido', color: 'error' },
  cancelled: { label: 'Anulado', color: 'secondary' }
}

const formatDate = (value: string | null) => (value ? new Date(value).toLocaleString('es-BO') : '—')

const DispatchHistoryTable = () => {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [status, setStatus] = useState<BranchTransferStatus | 'all'>('all')
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
      type: 'central_dispatch',
      ...(status !== 'all' && { status })
    },
    !!warehouse?.id
  )

  const transfers = data?.data || []
  const total = data?.meta?.total || 0

  const openAction = (kind: ActionKind, transfer: BranchTransfer) => {
    setDetails(null)
    setAction({ kind, transfer })
  }

  if (isWarehouseError) {
    return (
      <Card>
        <Box sx={{ p: 4 }}>
          <Alert severity='error'>
            No se pudo acceder a la bodega central. Verificá que tu usuario tenga permiso (ADMIN o SUPERVISOR).
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
          subheader='Un envío en camino se puede anular o marcar perdido. Una vez recibido, ya no.'
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
              setStatus(e.target.value as BranchTransferStatus | 'all')
              setPage(1)
            }}
            className='max-sm:is-full sm:is-[220px]'
          >
            <MenuItem value='all'>Todos</MenuItem>
            <MenuItem value='in_transit'>En camino</MenuItem>
            <MenuItem value='received'>Recibidos</MenuItem>
            <MenuItem value='lost'>Perdidos</MenuItem>
            <MenuItem value='cancelled'>Anulados</MenuItem>
          </CustomTextField>
        </Box>

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
              {status !== 'all'
                ? 'No hay envíos en ese estado'
                : isFilteredByBranch
                  ? `La bodega todavía no le envió nada a ${selectedBranch.name}`
                  : 'La bodega todavía no hizo envíos'}
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
                  const units = transfer.items.reduce((sum, item) => sum + item.quantity, 0)
                  const pendingReview = transfer.discrepancyStatus === 'pending_review'

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
                          <Chip
                            label={statusLabels[transfer.status]?.label || transfer.status}
                            size='small'
                            variant='tonal'
                            color={statusLabels[transfer.status]?.color || 'secondary'}
                          />
                          {pendingReview && (
                            <Chip label='Faltantes por revisar' size='small' variant='tonal' color='warning' />
                          )}
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

                          {transfer.status === 'in_transit' && (
                            <>
                              <Tooltip title='Anular: volvió a la bodega'>
                                <IconButton
                                  size='small'
                                  color='secondary'
                                  onClick={() => openAction('cancel', transfer)}
                                >
                                  <i className='tabler-ban' />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title='Marcar perdido: no está en ningún lado'>
                                <IconButton
                                  size='small'
                                  color='error'
                                  onClick={() => openAction('mark-lost', transfer)}
                                >
                                  <i className='tabler-alert-triangle' />
                                </IconButton>
                              </Tooltip>
                            </>
                          )}

                          {pendingReview && (
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
