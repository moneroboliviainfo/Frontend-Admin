'use client'

import { useEffect, useState } from 'react'

import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Alert from '@mui/material/Alert'
import Skeleton from '@mui/material/Skeleton'
import Typography from '@mui/material/Typography'
import TablePagination from '@mui/material/TablePagination'

import tableStyles from '@core/styles/table.module.css'
import { useVariantMovements } from '@/hooks/useVariants'
import type { StockMovement, StockMovementType } from '@/types/api/variants'

export type MovementsTarget = {
  variantSizeId: number
  label: string
}

type Props = {
  target: MovementsTarget | null
  warehouseId?: number
  onClose: () => void
}

type Style = { label: string; color: 'success' | 'error' | 'primary' | 'warning' | 'secondary' }

// Las etiquetas son las mismas que usa el Excel de movimientos del back
const styles: Record<StockMovementType, Style> = {
  ingreso: { label: 'Ingreso', color: 'success' },
  venta: { label: 'Venta', color: 'error' },
  ajuste: { label: 'Ajuste', color: 'warning' },
  traspaso: { label: 'Traspaso', color: 'secondary' },
  envio_bodega: { label: 'Envío desde bodega', color: 'primary' },
  salida_pedido: { label: 'Salida por pedido', color: 'primary' },
  envio_anulado: { label: 'Envío anulado', color: 'secondary' },
  pedido_anulado: { label: 'Pedido anulado', color: 'secondary' },
  recepcion: { label: 'Recepción', color: 'success' },
  aparecio_en_destino: { label: 'Apareció en destino', color: 'success' },
  aparecio_en_origen: { label: 'Apareció en origen', color: 'success' },
  devolucion_bodega: { label: 'Devolución a bodega', color: 'primary' },
  devolucion_anulada: { label: 'Devolución anulada', color: 'secondary' }
}

// 'ajuste' es baja o ajuste positivo segun el signo
const styleOf = (movement: StockMovement): Style => {
  if (movement.type === 'ajuste') {
    return movement.quantity < 0
      ? { label: 'Baja', color: 'error' }
      : { label: 'Ajuste positivo', color: 'success' }
  }

  return styles[movement.type] || { label: movement.type, color: 'secondary' }
}

const formatDate = (value: string) => (value ? new Date(value).toLocaleString('es-BO') : '—')

const MovementsModal = ({ target, warehouseId, onClose }: Props) => {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  useEffect(() => {
    setPage(1)
  }, [target])

  const { data, isLoading, isError } = useVariantMovements(
    target?.variantSizeId ?? null,
    warehouseId,
    page,
    pageSize
  )

  if (!target) return null

  const movements = data?.data || []
  const total = data?.meta?.total || 0

  return (
    <Dialog open onClose={onClose} maxWidth='md' fullWidth>
      <DialogTitle>
        Movimientos en la bodega
        <Typography variant='body2' color='text.secondary' sx={{ mt: 1 }}>
          {target.label}
        </Typography>
      </DialogTitle>

      <DialogContent>
        {isError ? (
          <Alert severity='error'>No se pudo cargar el historial.</Alert>
        ) : isLoading ? (
          <Box>
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} height={44} sx={{ mb: 1 }} />
            ))}
          </Box>
        ) : movements.length === 0 ? (
          <Typography color='text.secondary' sx={{ textAlign: 'center', py: 6 }}>
            Esta talla todavía no tuvo movimientos en la bodega
          </Typography>
        ) : (
          <div className='overflow-x-auto'>
            <table className={tableStyles.table}>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Movimiento</th>
                  <th>Cantidad</th>
                  <th>Quién</th>
                  <th>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {movements.map(movement => {
                  const style = styleOf(movement)

                  return (
                    <tr key={movement.id}>
                      <td>
                        <Typography variant='body2'>{formatDate(movement.createdAt)}</Typography>
                      </td>
                      <td>
                        <Chip label={style.label} size='small' variant='tonal' color={style.color} />
                      </td>
                      <td>
                        <Typography
                          variant='body2'
                          className='font-medium'
                          color={movement.quantity < 0 ? 'error.main' : 'success.main'}
                        >
                          {movement.quantity > 0 ? `+${movement.quantity}` : movement.quantity}
                        </Typography>
                      </td>
                      <td>
                        {/* user null = lo hizo el backend (por ejemplo un pago QR confirmado) */}
                        <Typography variant='body2' color={movement.user ? 'inherit' : 'text.secondary'}>
                          {movement.user || 'Sistema'}
                        </Typography>
                      </td>
                      <td>
                        {movement.reason && <Typography variant='body2'>{movement.reason}</Typography>}
                        {movement.branchTransferId && (
                          <Typography variant='caption' color='text.secondary' sx={{ display: 'block' }}>
                            Envío #{movement.branchTransferId}
                            {movement.counterpartBranch && ` · ${movement.counterpartBranch.name}`}
                          </Typography>
                        )}
                        {movement.orderId && (
                          <Typography variant='caption' color='text.secondary' sx={{ display: 'block' }}>
                            Venta #{movement.orderId}
                          </Typography>
                        )}
                        {!movement.reason && !movement.branchTransferId && !movement.orderId && (
                          <Typography variant='body2' color='text.secondary'>
                            —
                          </Typography>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {total > 0 && (
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
        )}
      </DialogContent>

      <DialogActions>
        <Button variant='contained' onClick={onClose}>
          Cerrar
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default MovementsModal
