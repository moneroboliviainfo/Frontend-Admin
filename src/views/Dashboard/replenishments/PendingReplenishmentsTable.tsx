'use client'

import { useState } from 'react'

import Card from '@mui/material/Card'
import Chip from '@mui/material/Chip'
import Switch from '@mui/material/Switch'
import FormControlLabel from '@mui/material/FormControlLabel'
import CardHeader from '@mui/material/CardHeader'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Divider from '@mui/material/Divider'
import Typography from '@mui/material/Typography'
import TablePagination from '@mui/material/TablePagination'
import Skeleton from '@mui/material/Skeleton'
import Alert from '@mui/material/Alert'
import Snackbar from '@mui/material/Snackbar'

import tableStyles from '@core/styles/table.module.css'
import { useBranchContext } from '@/contexts/BranchContext'
import { useDeclareBranchScope } from '@/contexts/BranchScopeContext'
import { useBranchTransfers } from '@/hooks/useBranchTransfers'
import type { BranchTransfer } from '@/types/api/branchTransfer'
import TransferActionsModal from '@/views/Dashboard/central-warehouse/TransferActionsModal'
import { canDo } from '@/views/Dashboard/central-warehouse/transfers'
import { variantes } from '@/views/Dashboard/central-warehouse/units'
import AttendReplenishmentModal from './AttendReplenishmentModal'

const formatDate = (value: string | null) => (value ? new Date(value).toLocaleString('es-BO') : '—')

// Lo que las tiendas le pidieron a la central y todavia nadie atendio
const PendingReplenishmentsTable = () => {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [todasLasSucursales, setTodasLasSucursales] = useState(true)
  const [attendId, setAttendId] = useState<number | null>(null)
  const [toCancel, setToCancel] = useState<BranchTransfer | null>(null)
  const [snackbar, setSnackbar] = useState<{ message: string; severity: 'success' | 'error' } | null>(null)

  const { selectedBranchId, selectedBranch } = useBranchContext()

  // Con "Todas" el selector de la navbar no cambia nada de lo que se ve: se oculta
  useDeclareBranchScope(!todasLasSucursales)

  const { data, isLoading, isError } = useBranchTransfers({
    page,
    limit: pageSize,
    replenishment: true,
    status: 'pending_dispatch',
    ...(!todasLasSucursales && selectedBranchId ? { branchId: selectedBranchId } : {})
  })

  const transfers = data?.data || []
  const total = data?.meta?.total || 0

  const showMessage = (message: string, severity: 'success' | 'error') => setSnackbar({ message, severity })

  return (
    <>
      <Card>
        <CardHeader
          title='Por atender'
          subheader='Variantes que piden las tiendas. Usted decide cuánto mandar de cada una; al atenderla sale de la bodega y aparece en Bodega Central → Envíos.'
        />

        <Box className='flex flex-wrap items-center justify-end gap-4 px-6 pb-4'>
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
        </Box>

        <Divider />

        {isError ? (
          <Box sx={{ p: 4 }}>
            <Alert severity='error'>Error al cargar las reposiciones.</Alert>
          </Box>
        ) : isLoading ? (
          <Box sx={{ p: 6 }}>
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} height={48} sx={{ mb: 1 }} />
            ))}
          </Box>
        ) : transfers.length === 0 ? (
          <Box sx={{ p: 8, textAlign: 'center' }}>
            <Typography color='text.secondary'>Ninguna tienda está esperando reposición</Typography>
          </Box>
        ) : (
          <div className='overflow-x-auto'>
            <table className={tableStyles.table}>
              <thead>
                <tr>
                  <th>Reposición</th>
                  <th>Tienda</th>
                  <th>Pedida</th>
                  <th>Nota</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {transfers.map(transfer => (
                  <tr key={transfer.id}>
                    <td>
                      <Typography variant='body2' className='font-medium'>
                        #{transfer.id}
                      </Typography>
                      <Typography variant='caption' color='text.secondary'>
                        {variantes(transfer.items.length)}
                      </Typography>
                    </td>
                    <td>
                      <Typography variant='body2'>{transfer.destinationBranch?.name || '—'}</Typography>
                    </td>
                    <td>
                      <Typography variant='body2'>{formatDate(transfer.requestedAt)}</Typography>
                      <Typography variant='caption' color='text.secondary'>
                        {transfer.requestedBy?.name || '—'}
                      </Typography>
                    </td>
                    <td>
                      <Typography variant='body2' color='text.secondary' sx={{ whiteSpace: 'pre-line' }}>
                        {transfer.note || '—'}
                      </Typography>
                    </td>
                    <td>
                      <Box className='flex items-center gap-2'>
                        {canDo(transfer, 'attend', true) && (
                          <Button
                            variant='contained'
                            size='small'
                            startIcon={<i className='tabler-truck-delivery' />}
                            onClick={() => setAttendId(transfer.id)}
                          >
                            Atender
                          </Button>
                        )}
                        {canDo(transfer, 'cancel', true) && (
                          <Button size='small' color='secondary' onClick={() => setToCancel(transfer)}>
                            Anular
                          </Button>
                        )}
                      </Box>
                    </td>
                  </tr>
                ))}
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

      <AttendReplenishmentModal transferId={attendId} onClose={() => setAttendId(null)} showMessage={showMessage} />

      {/* Para rechazar se atiende con todo en 0; anular es para cuando ya no corresponde */}
      <TransferActionsModal
        action={toCancel ? { kind: 'cancel', transfer: toCancel } : null}
        onClose={() => setToCancel(null)}
        showMessage={showMessage}
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

export default PendingReplenishmentsTable
