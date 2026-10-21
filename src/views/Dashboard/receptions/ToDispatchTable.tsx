'use client'

import { useEffect, useState } from 'react'

import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Skeleton from '@mui/material/Skeleton'
import Alert from '@mui/material/Alert'
import Snackbar from '@mui/material/Snackbar'
import FormControlLabel from '@mui/material/FormControlLabel'
import Switch from '@mui/material/Switch'
import CircularProgress from '@mui/material/CircularProgress'

import CustomTextField from '@core/components/mui/TextField'
import tableStyles from '@core/styles/table.module.css'
import { useBranchTransfers, useDispatchTransfer } from '@/hooks/useBranchTransfers'
import type { BranchTransfer, BranchTransferItem } from '@/types/api/branchTransfer'
import { prendas } from '@/views/Dashboard/central-warehouse/units'

const itemLabel = (item: BranchTransferItem) => {
  const productColor = item.variant?.productColor

  return `${productColor?.product?.name || 'Producto'} · ${productColor?.color?.name || ''} · Talla ${
    item.variant?.size?.name || ''
  }`
}

const formatDate = (value: string | null) => (value ? new Date(value).toLocaleString('es-BO') : '—')

const ToDispatchTable = () => {
  const [target, setTarget] = useState<BranchTransfer | null>(null)
  const [partial, setPartial] = useState(false)
  const [quantities, setQuantities] = useState<Record<number, number>>({})
  const [note, setNote] = useState('')
  const [snackbar, setSnackbar] = useState<{ message: string; severity: 'success' | 'error' } | null>(null)

  const dispatchTransfer = useDispatchTransfer()

  // Pedidos que me hicieron otras tiendas: salen de MI tienda
  const { data, isLoading, isError } = useBranchTransfers({
    direction: 'outgoing',
    status: 'pending_dispatch',
    type: 'branch_request'
  })

  useEffect(() => {
    setPartial(false)
    setNote('')
    setQuantities(Object.fromEntries((target?.items || []).map(item => [item.id, item.quantity ?? 0])))
  }, [target])

  const transfers = data?.data || []

  // Un pedido entre sucursales siempre trae cantidad (solo la reposicion la deja en null)
  const requested = target?.items || []
  const totalRequested = requested.reduce((sum, item) => sum + (item.quantity ?? 0), 0)
  const totalToSend = requested.reduce((sum, item) => sum + (quantities[item.id] ?? 0), 0)

  const isShort = totalToSend < totalRequested
  const overRequested = requested.some(item => (quantities[item.id] ?? 0) > (item.quantity ?? 0))

  // El back arma el envio tomando primero de la bodega; lo que ahi no alcanza
  // sale de la tienda, donde la prenda esta a la venta. Conviene avisarlo.
  const deTienda = requested.reduce((sum, item) => sum + (item.fromSalesFloor || 0), 0)

  // Si no sale todo, la nota es obligatoria
  const isValid = !overRequested && (!isShort || !!note.trim())

  const handleDispatch = async () => {
    if (!target) return

    try {
      await dispatchTransfer.mutateAsync({
        transferId: target.id,
        data: partial
          ? {
              items: requested.map(item => ({ transferItemId: item.id, quantity: quantities[item.id] ?? 0 })),
              ...(note.trim() && { note: note.trim() })
            }
          : {}
      })

      setSnackbar({
        message:
          totalToSend === 0
            ? `Pedido #${target.id}: se informó que no se encontró la prenda`
            : `Pedido #${target.id} despachado`,
        severity: 'success'
      })
      setTarget(null)
    } catch (error: any) {
      setSnackbar({ message: error?.response?.data?.message || 'No se pudo despachar', severity: 'error' })
    }
  }

  return (
    <>
      <Card>
        <CardHeader
          title='Por enviar'
          subheader='Pedidos de otras sucursales. La prenda salió de la tienda al momento del pedido.'
        />

        <Divider />

        {isError ? (
          <Box sx={{ p: 4 }}>
            <Alert severity='error'>Error al cargar los pedidos.</Alert>
          </Box>
        ) : isLoading ? (
          <Box sx={{ p: 6 }}>
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} height={48} sx={{ mb: 1 }} />
            ))}
          </Box>
        ) : transfers.length === 0 ? (
          <Box sx={{ p: 8, textAlign: 'center' }}>
            <Typography color='text.secondary'>No hay pedidos por despachar</Typography>
          </Box>
        ) : (
          <div className='overflow-x-auto'>
            <table className={tableStyles.table}>
              <thead>
                <tr>
                  <th>Pedido</th>
                  <th>Lo pide</th>
                  <th>Para</th>
                  <th>Prendas</th>
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
                        {formatDate(transfer.requestedAt)}
                      </Typography>
                    </td>
                    <td>
                      <Typography variant='body2'>{transfer.destinationBranch?.name || '—'}</Typography>
                    </td>
                    <td>
                      <Typography variant='body2'>{transfer.customerName || 'Sin cliente'}</Typography>
                      {transfer.customerPhone && (
                        <Typography variant='caption' color='text.secondary'>
                          {transfer.customerPhone}
                        </Typography>
                      )}
                    </td>
                    <td>
                      {transfer.items.map(item => (
                        <Typography key={item.id} variant='body2'>
                          {item.quantity} × {itemLabel(item)}
                        </Typography>
                      ))}
                    </td>
                    <td>
                      <Button
                        variant='contained'
                        size='small'
                        startIcon={<i className='tabler-send' />}
                        onClick={() => setTarget(transfer)}
                      >
                        Despachar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Dialog open={!!target} onClose={() => setTarget(null)} maxWidth='sm' fullWidth>
        <DialogTitle>
          Despachar pedido #{target?.id}
          <Typography variant='body2' color='text.secondary' sx={{ mt: 1 }}>
            {prendas(totalRequested)} para {target?.destinationBranch?.name}
          </Typography>
        </DialogTitle>

        <DialogContent>
          <Alert severity='info' sx={{ mb: 4 }}>
            Confirme <strong>antes</strong> de entregar el paquete. Si el pedido se anuló, se lo avisamos acá.
          </Alert>

          <FormControlLabel
            control={<Switch checked={partial} onChange={e => setPartial(e.target.checked)} />}
            label='No se encontró todo'
            sx={{ mb: 3 }}
          />

          <div className='overflow-x-auto'>
            <table className={tableStyles.table}>
              <thead>
                <tr>
                  <th>Prenda</th>
                  <th>De dónde sale</th>
                  <th>Pedido</th>
                  <th>Envío</th>
                </tr>
              </thead>
              <tbody>
                {requested.map(item => (
                  <tr key={item.id}>
                    <td>
                      <Typography variant='body2'>{itemLabel(item)}</Typography>
                    </td>
                    <td>
                      {/* El back descuenta primero de la bodega y solo toma del
                          tienda lo que ahi no alcanza: decirlo evita que el
                          cajero busque la prenda donde no esta. */}
                      {item.fromWarehouse || item.fromSalesFloor ? (
                        <Box className='flex flex-wrap items-center gap-2'>
                          {!!item.fromWarehouse && (
                            <Chip
                              label={`${item.fromWarehouse} de bodega`}
                              size='small'
                              variant='tonal'
                              color='primary'
                            />
                          )}
                          {!!item.fromSalesFloor && (
                            <Chip
                              label={`${item.fromSalesFloor} de tienda`}
                              size='small'
                              variant='tonal'
                              color='warning'
                            />
                          )}
                        </Box>
                      ) : (
                        <Typography variant='body2' color='text.secondary'>
                          —
                        </Typography>
                      )}
                    </td>
                    <td>
                      <Typography variant='body2'>{item.quantity}</Typography>
                    </td>
                    <td>
                      {partial ? (
                        <CustomTextField
                          type='number'
                          size='small'
                          placeholder='0'
                          value={quantities[item.id] || ''}
                          error={(quantities[item.id] ?? 0) > (item.quantity ?? 0)}
                          onChange={e =>
                            setQuantities(prev => ({ ...prev, [item.id]: parseInt(e.target.value, 10) || 0 }))
                          }
                          sx={{ width: '100px' }}
                          inputProps={{ min: 0, max: item.quantity }}
                        />
                      ) : (
                        <Typography variant='body2' className='font-medium'>
                          {item.quantity}
                        </Typography>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {deTienda > 0 && (
            <Alert severity='info' sx={{ mt: 3 }}>
              {deTienda === 1 ? 'Una prenda sale' : `${deTienda} prendas salen`} <strong>de la tienda</strong>: no
              había suficiente en la bodega. Búsquela ahí antes de despachar.
            </Alert>
          )}

          {isShort && !overRequested && (
            <Alert severity='warning' sx={{ mt: 3 }}>
              {totalToSend === 0
                ? 'No se envía nada: el pedido queda como no encontrado y la otra sucursal deberá informar al cliente.'
                : `Salen ${totalToSend} de ${totalRequested}. El motivo es obligatorio.`}
            </Alert>
          )}

          {partial && (
            <CustomTextField
              fullWidth
              multiline
              rows={2}
              label={isShort ? 'Motivo' : 'Nota (opcional)'}
              placeholder='No estaba en la sucursal'
              value={note}
              onChange={e => setNote(e.target.value)}
              sx={{ mt: 4 }}
            />
          )}
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setTarget(null)} color='secondary' disabled={dispatchTransfer.isPending}>
            Volver
          </Button>
          <Button
            onClick={handleDispatch}
            variant='contained'
            disabled={!isValid || dispatchTransfer.isPending}
            startIcon={dispatchTransfer.isPending ? <CircularProgress size={16} /> : <i className='tabler-send' />}
          >
            {dispatchTransfer.isPending ? 'Despachando...' : totalToSend === 0 ? 'No se encontró' : 'Despachar'}
          </Button>
        </DialogActions>
      </Dialog>

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

export default ToDispatchTable
