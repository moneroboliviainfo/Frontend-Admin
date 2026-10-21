'use client'

import { useEffect, useMemo, useState } from 'react'

import { useQueries } from '@tanstack/react-query'

import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Skeleton from '@mui/material/Skeleton'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'

import CustomTextField from '@core/components/mui/TextField'
import tableStyles from '@core/styles/table.module.css'
import { useAttendReplenishment, useBranchTransfer } from '@/hooks/useBranchTransfers'
import { useAddStock } from '@/hooks/useVariants'
import { variantService } from '@/services/variantService'
import type { VariantSize } from '@/types/api/variants'
import { itemLabel } from '@/views/Dashboard/central-warehouse/transfers'
import { prendas } from '@/views/Dashboard/central-warehouse/units'
import StockStatusCell from '@/views/Dashboard/central-warehouse/StockStatusCell'

type Props = {
  transferId: number | null
  onClose: () => void
  showMessage: (message: string, severity: 'success' | 'error') => void
}

const AttendReplenishmentModal = ({ transferId, onClose, showMessage }: Props) => {
  const [quantities, setQuantities] = useState<Record<number, number>>({})
  const [note, setNote] = useState('')

  const attend = useAttendReplenishment()

  // Ingresar a la bodega sin salir de acá: si falta stock para atender, el
  // admin lo carga en la misma fila en vez de ir a Bodega Central y volver.
  // `addstock` entra SIEMPRE a la bodega principal (ignora branchId, doc 06).
  const addStock = useAddStock()
  const [ingresando, setIngresando] = useState<number | null>(null)
  const [aIngresar, setAIngresar] = useState('')

  // Detalle fresco: la tienda puede haber agregado o quitado variantes desde que se listo
  const { data: transfer, isLoading: isLoadingTransfer, refetch } = useBranchTransfer(transferId)

  // El detalle no trae stock: se pide por color de producto, una llamada por color y no por
  // linea. Con la tienda destino como branchId (obligatorio para el admin) cada talla trae lo
  // que hay en la bodega (centralWarehouseStock) y lo que ya tiene la tienda (doc 15 §1.4)
  const productColorIds = useMemo(
    () => [...new Set((transfer?.items || []).map(item => item.variant?.productColor?.id).filter(Boolean))] as number[],
    [transfer]
  )

  const stockQueries = useQueries({
    queries: productColorIds.map(productColorId => ({
      queryKey: ['variant', productColorId, transfer?.destinationBranchId],
      queryFn: () => variantService.getVariantById(productColorId, transfer?.destinationBranchId),
      enabled: !!transfer
    }))
  })

  const isLoadingStock = stockQueries.some(query => query.isLoading)

  const stockBySize = useMemo(() => {
    const map: Record<number, VariantSize> = {}

    stockQueries.forEach(query =>
      (query.data?.variants || []).forEach(size => {
        if (size.id) map[Number(size.id)] = size
      })
    )

    return map

    // stockQueries cambia de identidad en cada render: se depende de sus datos
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stockQueries.map(query => query.dataUpdatedAt).join(',')])

  useEffect(() => {
    setQuantities({})
    setNote('')
    setIngresando(null)
    setAIngresar('')
  }, [transferId])

  if (!transferId) return null

  const items = transfer?.items || []
  const maxOf = (variantId: number) => stockBySize[variantId]?.centralWarehouseStock ?? 0

  const totalToSend = items.reduce((sum, item) => sum + (quantities[item.id] || 0), 0)
  const overStock = items.some(item => (quantities[item.id] || 0) > maxOf(item.variantId))

  // Todo en 0 = rechazo, y ahi el back exige nota
  const isRejection = totalToSend === 0
  const isValid = !overStock && (!isRejection || !!note.trim())

  const handleIngresar = async (variantId: number) => {
    const quantity = parseInt(aIngresar, 10)

    if (!quantity || quantity <= 0) return

    try {
      await addStock.mutateAsync({ variantId, quantity })
      showMessage(`Ingresaron ${quantity} unidades a la bodega`, 'success')
      setIngresando(null)
      setAIngresar('')
    } catch {
      showMessage('No se pudo ingresar el stock', 'error')
    }
  }

  const handleConfirm = async () => {
    if (!transfer) return

    try {
      await attend.mutateAsync({
        transferId: transfer.id,
        data: {
          // Hay que mandar todas las lineas, cada una con su cantidad
          items: items.map(item => ({ transferItemId: item.id, quantity: quantities[item.id] || 0 })),
          ...(note.trim() && { note: note.trim() })
        }
      })

      showMessage(
        isRejection
          ? `Reposición #${transfer.id} rechazada`
          : `Reposición #${transfer.id} atendida: ${prendas(totalToSend)} en camino a ${transfer.destinationBranch?.name}`,
        'success'
      )
      onClose()
    } catch (error: any) {
      const message = error?.response?.data?.message || 'No se pudo atender la reposición'

      // "Faltan las líneas" / "no es de este traslado": la tienda cambio la reposicion mientras tanto
      if (/Faltan las l[ií]neas|no es de este traslado/i.test(message)) {
        await refetch()
        showMessage('La tienda cambió la reposición mientras la atendía: se recargó, revise las cantidades', 'error')

        return
      }

      showMessage(message, 'error')
    }
  }

  return (
    <Dialog open onClose={onClose} maxWidth='md' fullWidth>
      <DialogTitle>
        Atender reposición #{transferId}
        {transfer && (
          <Typography variant='body2' color='text.secondary' sx={{ mt: 1 }}>
            Pedida por {transfer.destinationBranch?.name}
            {transfer.requestedBy ? ` · ${transfer.requestedBy.name}` : ''}
          </Typography>
        )}
      </DialogTitle>

      <DialogContent>
        {transfer?.note && (
          <Alert severity='info' sx={{ mb: 4, whiteSpace: 'pre-line' }}>
            {transfer.note}
          </Alert>
        )}

        <Typography variant='body2' color='text.secondary' sx={{ mb: 3 }}>
          La tienda pide variantes, no cantidades: elija cuánto mandar de cada una. Lo que deje en 0 no se manda. Si
          deja todo en 0, la reposición se rechaza.
        </Typography>

        {isLoadingTransfer || isLoadingStock ? (
          <Box>
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} height={44} sx={{ mb: 1 }} />
            ))}
          </Box>
        ) : (
          <div className='overflow-x-auto'>
            <table className={tableStyles.table}>
              <thead>
                <tr>
                  <th>Prenda</th>
                  <th>En bodega central</th>
                  <th>La tienda tiene</th>
                  <th>Mandar</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => {
                  const size = stockBySize[item.variantId]
                  const max = maxOf(item.variantId)
                  const value = quantities[item.id] || 0

                  return (
                    <tr key={item.id}>
                      <td>
                        <Typography variant='body2'>{itemLabel(item)}</Typography>
                      </td>
                      <td>
                        <Box className='flex items-center gap-2'>
                          <StockStatusCell stock={max} />
                          {ingresando === item.id ? (
                            <>
                              <CustomTextField
                                autoFocus
                                type='number'
                                size='small'
                                placeholder='0'
                                value={aIngresar}
                                onChange={e => setAIngresar(e.target.value)}
                                sx={{ width: '90px' }}
                                inputProps={{ min: 1 }}
                              />
                              <Tooltip title='Ingresar a la bodega'>
                                <span>
                                  <IconButton
                                    size='small'
                                    color='success'
                                    disabled={!parseInt(aIngresar, 10) || addStock.isPending}
                                    onClick={() => handleIngresar(item.variantId)}
                                  >
                                    {addStock.isPending ? (
                                      <CircularProgress size={16} />
                                    ) : (
                                      <i className='tabler-check' />
                                    )}
                                  </IconButton>
                                </span>
                              </Tooltip>
                              <IconButton size='small' onClick={() => setIngresando(null)}>
                                <i className='tabler-x' />
                              </IconButton>
                            </>
                          ) : (
                            <Tooltip title='Ingresar stock a la bodega central'>
                              <IconButton
                                size='small'
                                onClick={() => {
                                  setIngresando(item.id)
                                  setAIngresar('')
                                }}
                              >
                                <i className='tabler-plus' />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Box>
                      </td>
                      <td>
                        <Typography variant='body2'>
                          {size ? `Tienda ${size.availableStock ?? 0} · Bodega ${size.warehouseStock ?? 0}` : '—'}
                        </Typography>
                      </td>
                      <td>
                        <CustomTextField
                          type='number'
                          size='small'
                          placeholder='0'
                          disabled={max === 0}
                          error={value > max}
                          value={value || ''}
                          onChange={e => {
                            const quantity = parseInt(e.target.value, 10)

                            setQuantities(prev => ({ ...prev, [item.id]: quantity > 0 ? quantity : 0 }))
                          }}
                          sx={{ width: '100px' }}
                          inputProps={{ min: 0, max }}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {overStock && (
          <Alert severity='error' sx={{ mt: 3 }}>
            Hay cantidades mayores a lo que tiene la bodega. El envío no se hace parcial.
          </Alert>
        )}

        {isRejection && !isLoadingTransfer && (
          <Alert severity='warning' sx={{ mt: 3 }}>
            Con todo en 0 la reposición se <strong>rechaza</strong>. El motivo es obligatorio y la tienda lo verá.
          </Alert>
        )}

        <CustomTextField
          fullWidth
          multiline
          rows={2}
          label={isRejection ? 'Motivo del rechazo' : 'Nota para la tienda (opcional)'}
          placeholder={isRejection ? 'No hay stock de estas tallas' : 'Las L no había'}
          value={note}
          onChange={e => setNote(e.target.value)}
          sx={{ mt: 4 }}
        />
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} color='secondary' disabled={attend.isPending}>
          Volver
        </Button>
        <Button
          onClick={handleConfirm}
          variant='contained'
          color={isRejection ? 'error' : 'primary'}
          disabled={!isValid || attend.isPending || !transfer}
          startIcon={attend.isPending ? <CircularProgress size={16} /> : undefined}
        >
          {attend.isPending ? 'Guardando...' : isRejection ? 'Rechazar reposición' : `Enviar ${prendas(totalToSend)}`}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default AttendReplenishmentModal
