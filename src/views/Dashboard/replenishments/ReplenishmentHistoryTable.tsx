'use client'

import { useState } from 'react'

import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import Box from '@mui/material/Box'
import Divider from '@mui/material/Divider'
import Typography from '@mui/material/Typography'
import MenuItem from '@mui/material/MenuItem'
import TablePagination from '@mui/material/TablePagination'
import Skeleton from '@mui/material/Skeleton'
import Alert from '@mui/material/Alert'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'

import CustomTextField from '@core/components/mui/TextField'
import tableStyles from '@core/styles/table.module.css'
import { useBranchContext } from '@/contexts/BranchContext'
import { useBranchTransfers } from '@/hooks/useBranchTransfers'
import type { BranchTransfer, BranchTransferStatus } from '@/types/api/branchTransfer'
import TransferDetailsModal from '@/views/Dashboard/central-warehouse/TransferDetailsModal'
import StageChip from '@/views/Dashboard/central-warehouse/StageChip'
import { transferUnits } from '@/views/Dashboard/central-warehouse/transfers'
import { prendas, variantes } from '@/views/Dashboard/central-warehouse/units'

// Los estados de una reposicion. not_found es "Rechazada": la central la atendio con todo en 0
const statuses: [BranchTransferStatus, string][] = [
  ['pending_dispatch', 'Esperando a la central'],
  ['in_transit', 'En camino'],
  ['received', 'Recibida'],
  ['not_found', 'Rechazada'],
  ['cancelled', 'Anulada'],
  ['lost', 'Perdida']
]

const formatDate = (value: string | null) => (value ? new Date(value).toLocaleString('es-BO') : '—')

// Solo consulta: atender, recibir y anular viven en sus pantallas (Por atender, Mi
// reposicion, Inventario → Envios de la central, Bodega Central → Envios)
const ReplenishmentHistoryTable = ({ isCentral }: { isCentral: boolean }) => {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [status, setStatus] = useState<BranchTransferStatus | 'all'>('all')
  const [branchId, setBranchId] = useState<number | 'all'>('all')
  const [details, setDetails] = useState<BranchTransfer | null>(null)

  const { branches } = useBranchContext()

  // La tienda no manda branchId: el back resuelve la suya
  const { data, isLoading, isError } = useBranchTransfers({
    page,
    limit: pageSize,
    replenishment: true,
    ...(status !== 'all' && { status }),
    ...(isCentral && branchId !== 'all' && { branchId })
  })

  const transfers = data?.data || []
  const total = data?.meta?.total || 0

  return (
    <>
      <Card>
        <CardHeader
          title='Historial de reposiciones'
          subheader={
            isCentral
              ? 'Todas las reposiciones que pidieron las tiendas y cómo terminaron.'
              : 'Sus reposiciones anteriores. Lo que la central mandó se recibe en Inventario → Envíos de la central.'
          }
        />

        <Box className='flex flex-wrap items-center justify-end gap-4 px-6 pb-4'>
          {isCentral && (
            <CustomTextField
              select
              label='Tienda'
              value={branchId}
              onChange={e => {
                setBranchId(e.target.value === 'all' ? 'all' : Number(e.target.value))
                setPage(1)
              }}
              className='max-sm:is-full sm:is-[220px]'
            >
              <MenuItem value='all'>Todas</MenuItem>
              {branches.map(branch => (
                <MenuItem key={branch.id} value={branch.id}>
                  {branch.name}
                </MenuItem>
              ))}
            </CustomTextField>
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
            <Typography color='text.secondary'>No hay reposiciones con esos filtros</Typography>
          </Box>
        ) : (
          <div className='overflow-x-auto'>
            <table className={tableStyles.table}>
              <thead>
                <tr>
                  <th>Reposición</th>
                  {isCentral && <th>Tienda</th>}
                  <th>Estado</th>
                  <th>Pedida</th>
                  <th>Respuesta de la central</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {transfers.map(transfer => {
                  const sent = transfer.items.some(item => item.dispatchedQuantity !== null)
                  const answeredAt = transfer.dispatchedAt || transfer.notFoundAt

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
                          {sent
                            ? `${prendas(transferUnits(transfer))} en ${variantes(transfer.items.length)}`
                            : variantes(transfer.items.length)}
                        </Typography>
                      </td>
                      {isCentral && (
                        <td>
                          <Typography variant='body2'>{transfer.destinationBranch?.name || '—'}</Typography>
                        </td>
                      )}
                      <td>
                        <StageChip transfer={transfer} />
                      </td>
                      <td>
                        <Typography variant='body2'>{formatDate(transfer.requestedAt)}</Typography>
                        <Typography variant='caption' color='text.secondary'>
                          {transfer.requestedBy?.name || '—'}
                        </Typography>
                      </td>
                      <td>
                        <Typography variant='body2'>{formatDate(answeredAt)}</Typography>
                        {/* En una reposicion notFoundNote es la nota de la central, la haya rechazado o no */}
                        {transfer.notFoundNote && (
                          <Typography variant='caption' color='text.secondary' sx={{ display: 'block' }}>
                            “{transfer.notFoundNote}”
                          </Typography>
                        )}
                      </td>
                      <td>
                        <Tooltip title='Ver detalles'>
                          <IconButton size='small'>
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

      {/* Sin onAction: el detalle es de consulta */}
      <TransferDetailsModal transfer={details} onClose={() => setDetails(null)} />
    </>
  )
}

export default ReplenishmentHistoryTable
