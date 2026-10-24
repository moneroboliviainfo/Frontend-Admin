'use client'

import { useState } from 'react'

import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import Box from '@mui/material/Box'
import Divider from '@mui/material/Divider'
import Typography from '@mui/material/Typography'
import Skeleton from '@mui/material/Skeleton'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import TablePagination from '@mui/material/TablePagination'

import tableStyles from '@core/styles/table.module.css'
import { useBranchTransfers } from '@/hooks/useBranchTransfers'
import { canDo, transferUnits } from '@/views/Dashboard/central-warehouse/transfers'
import { prendas } from '@/views/Dashboard/central-warehouse/units'
import StageChip from '@/views/Dashboard/central-warehouse/StageChip'
import TransferActionsModal from '@/views/Dashboard/central-warehouse/TransferActionsModal'
import type { ActionKind } from '@/views/Dashboard/central-warehouse/TransferActionsModal'
import ReceiveTransferModal from '@/views/Dashboard/receptions/ReceiveTransferModal'
import type { BranchTransfer } from '@/types/api/branchTransfer'

// La misma tabla sirve de los dos lados: la tienda ve lo que mando (y puede
// anularlo mientras viaje), la central ve lo que le llega (y lo recibe).
type Kind = 'branch' | 'central'

const config: Record<Kind, { title: string; subheader: string; empty: string; onlyInTransit: boolean }> = {
  branch: {
    title: 'Devoluciones enviadas',
    subheader: 'Lo que su sucursal devolvió a la Bodega Central.',
    empty: 'Todavía no devolvió nada',
    onlyInTransit: false
  },
  central: {
    title: 'Devoluciones por recibir',
    subheader: 'Mercadería que las tiendas devolvieron y viene en camino a la bodega.',
    empty: 'No hay devoluciones en camino',
    onlyInTransit: true
  }
}

const formatDate = (value: string | null) => (value ? new Date(value).toLocaleString('es-BO') : '—')

type Props = {
  kind: Kind
  showMessage: (message: string, severity: 'success' | 'error') => void
}

const ReturnsTable = ({ kind, showMessage }: Props) => {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [toReceive, setToReceive] = useState<BranchTransfer | null>(null)
  const [action, setAction] = useState<{ kind: ActionKind; transfer: BranchTransfer } | null>(null)

  const settings = config[kind]

  const { data, isLoading, isError } = useBranchTransfers({
    page,
    limit: pageSize,
    type: 'central_return',
    ...(settings.onlyInTransit && { status: 'in_transit' })
  })

  const transfers = data?.data || []

  return (
    <>
      <Card>
        <CardHeader title={settings.title} subheader={settings.subheader} />

        <Divider />

        {isError ? (
          <Box sx={{ p: 4 }}>
            <Alert severity='error'>Error al cargar las devoluciones.</Alert>
          </Box>
        ) : isLoading ? (
          <Box sx={{ p: 6 }}>
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} height={48} sx={{ mb: 1 }} />
            ))}
          </Box>
        ) : transfers.length === 0 ? (
          <Box sx={{ p: 8, textAlign: 'center' }}>
            <Typography color='text.secondary'>{settings.empty}</Typography>
          </Box>
        ) : (
          <div className='overflow-x-auto'>
            <table className={tableStyles.table}>
              <thead>
                <tr>
                  <th>Devolución</th>
                  {kind === 'central' && <th>Viene de</th>}
                  <th>Enviada</th>
                  <th>Estado</th>
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
                        {prendas(transferUnits(transfer))}
                      </Typography>
                    </td>

                    {kind === 'central' && (
                      <td>
                        <Typography variant='body2'>{transfer.sourceBranch?.name || '—'}</Typography>
                      </td>
                    )}

                    <td>
                      <Typography variant='body2'>{formatDate(transfer.dispatchedAt || transfer.requestedAt)}</Typography>
                      <Typography variant='caption' color='text.secondary'>
                        {transfer.dispatchedBy?.name || transfer.requestedBy?.name || '—'}
                      </Typography>
                    </td>

                    <td>
                      <StageChip transfer={transfer} />
                    </td>

                    <td>
                      <Box className='flex items-center gap-1'>
                        {/* Una devolucion la recibe solo la central, y por su
                            propia ruta: el modal lo resuelve por `type` */}
                        {canDo(transfer, 'receive', kind === 'central' && transfer.status === 'in_transit') && (
                          <Button
                            size='small'
                            variant='contained'
                            startIcon={<i className='tabler-package-import' />}
                            onClick={() => setToReceive(transfer)}
                          >
                            Recibir
                          </Button>
                        )}

                        {canDo(transfer, 'cancel', transfer.status === 'in_transit') && (
                          <Tooltip title='Anular: todo vuelve a la tienda'>
                            <IconButton
                              size='small'
                              color='secondary'
                              onClick={() => setAction({ kind: 'cancel', transfer })}
                            >
                              <i className='tabler-ban' />
                            </IconButton>
                          </Tooltip>
                        )}

                        {kind === 'central' && canDo(transfer, 'markLost', transfer.status === 'in_transit') && (
                          <Tooltip title='Marcar perdido: no está en ningún lado'>
                            <IconButton
                              size='small'
                              color='error'
                              onClick={() => setAction({ kind: 'mark-lost', transfer })}
                            >
                              <i className='tabler-alert-triangle' />
                            </IconButton>
                          </Tooltip>
                        )}

                        {kind === 'central' && canDo(transfer, 'review', false) && (
                          <Tooltip title='Revisar faltantes'>
                            <IconButton
                              size='small'
                              color='warning'
                              onClick={() => setAction({ kind: 'review', transfer })}
                            >
                              <i className='tabler-checkup-list' />
                            </IconButton>
                          </Tooltip>
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
          count={data?.meta?.total || 0}
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

      {toReceive && (
        <ReceiveTransferModal transfer={toReceive} onClose={() => setToReceive(null)} showMessage={showMessage} />
      )}

      <TransferActionsModal action={action} onClose={() => setAction(null)} showMessage={showMessage} />
    </>
  )
}

export default ReturnsTable
