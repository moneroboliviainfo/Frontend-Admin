'use client'

import { useState } from 'react'

import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Divider from '@mui/material/Divider'
import IconButton from '@mui/material/IconButton'
import Skeleton from '@mui/material/Skeleton'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import Snackbar from '@mui/material/Snackbar'

import tableStyles from '@core/styles/table.module.css'
import { useBranchTransfers, useRemoveReplenishmentItem } from '@/hooks/useBranchTransfers'
import type { BranchTransferItem } from '@/types/api/branchTransfer'
import TransferActionsModal from '@/views/Dashboard/central-warehouse/TransferActionsModal'
import StageChip from '@/views/Dashboard/central-warehouse/StageChip'
import { canDo } from '@/views/Dashboard/central-warehouse/transfers'
import { variantes } from '@/views/Dashboard/central-warehouse/units'
import AddVariantsDialog from './AddVariantsDialog'

const formatDate = (value: string | null) => (value ? new Date(value).toLocaleString('es-BO') : '—')

// La tienda tiene una sola reposicion abierta a la vez: funciona como un carrito que
// la central atiende cuando puede. Pedir de nuevo agrega a la misma
const MyReplenishment = () => {
  const [addOpen, setAddOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [removing, setRemoving] = useState<number | null>(null)
  const [snackbar, setSnackbar] = useState<{ message: string; severity: 'success' | 'error' } | null>(null)

  const { data, isLoading, isError } = useBranchTransfers({ replenishment: true, status: 'pending_dispatch', limit: 1 })
  const removeItem = useRemoveReplenishmentItem()

  const open = data?.data?.[0] || null
  const showMessage = (message: string, severity: 'success' | 'error') => setSnackbar({ message, severity })

  const handleRemove = async (item: BranchTransferItem) => {
    if (!open) return

    setRemoving(item.id)

    try {
      await removeItem.mutateAsync({ transferId: open.id, itemId: item.id })

      // Quitar la ultima no la deja vacia: la anula
      showMessage(
        open.items.length === 1 ? 'Se quitó la última variante: la reposición quedó anulada' : 'Variante quitada',
        'success'
      )
    } catch (error: any) {
      showMessage(error?.response?.data?.message || 'No se pudo quitar la variante', 'error')
    } finally {
      setRemoving(null)
    }
  }

  // Sin reposicion abierta se puede crear una; con una abierta, solo si el back lo permite
  const canAdd = open ? canDo(open, 'addVariants', true) : true

  return (
    <>
      <Card>
        <CardHeader
          title={
            <Box className='flex flex-wrap items-center gap-3'>
              <span>{open ? `Reposición #${open.id}` : 'Mi reposición'}</span>
              {open && <StageChip transfer={open} />}
            </Box>
          }
          subheader='Pida a la central las variantes que le faltan. No hace falta poner cantidad: la central decide cuánto manda. Lo que mande se recibe en Inventario → Envíos de la central.'
          action={
            <Box className='flex flex-wrap gap-2'>
              {open && canDo(open, 'cancel', true) && (
                <Button color='secondary' onClick={() => setCancelOpen(true)}>
                  Anular reposición
                </Button>
              )}
              {canAdd && (
                <Button variant='contained' startIcon={<i className='tabler-plus' />} onClick={() => setAddOpen(true)}>
                  Agregar variantes
                </Button>
              )}
            </Box>
          }
        />

        <Divider />

        {isError ? (
          <Box sx={{ p: 4 }}>
            <Alert severity='error'>Error al cargar la reposición.</Alert>
          </Box>
        ) : isLoading ? (
          <Box sx={{ p: 6 }}>
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} height={44} sx={{ mb: 1 }} />
            ))}
          </Box>
        ) : !open ? (
          <Box sx={{ p: 8, textAlign: 'center' }}>
            <Typography color='text.secondary'>No tiene ninguna reposición pendiente.</Typography>
            <Typography variant='body2' color='text.secondary' sx={{ mt: 1 }}>
              Use <strong>Agregar variantes</strong>, o el ícono de reposición en Inventario → Stock.
            </Typography>
          </Box>
        ) : (
          <>
            <Box className='flex flex-wrap gap-6' sx={{ px: 6, py: 4 }}>
              <Box>
                <Typography variant='caption' color='text.secondary'>
                  Pedida
                </Typography>
                <Typography variant='body2'>
                  {formatDate(open.requestedAt)} · {open.requestedBy?.name || '—'}
                </Typography>
              </Box>
              <Box>
                <Typography variant='caption' color='text.secondary'>
                  Variantes
                </Typography>
                <Typography variant='body2'>{variantes(open.items.length)}</Typography>
              </Box>
            </Box>

            {open.note && (
              <Box sx={{ px: 6, pb: 4 }}>
                <Alert severity='info' sx={{ whiteSpace: 'pre-line' }}>
                  {open.note}
                </Alert>
              </Box>
            )}

            <div className='overflow-x-auto'>
              <table className={tableStyles.table}>
                <thead>
                  <tr>
                    <th>Prenda</th>
                    <th>Color</th>
                    <th>Talla</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {open.items.map(item => {
                    const productColor = item.variant?.productColor

                    return (
                      <tr key={item.id}>
                        <td>
                          <Typography variant='body2'>{productColor?.product?.name || 'Producto'}</Typography>
                        </td>
                        <td>
                          <Box className='flex items-center gap-2'>
                            <Box
                              sx={{
                                width: 14,
                                height: 14,
                                borderRadius: '50%',
                                bgcolor: productColor?.color?.code || '#000',
                                border: '1px solid',
                                borderColor: 'divider'
                              }}
                            />
                            <Typography variant='body2'>{productColor?.color?.name}</Typography>
                          </Box>
                        </td>
                        <td>
                          <Typography variant='body2'>{item.variant?.size?.name}</Typography>
                        </td>
                        <td>
                          {canDo(open, 'removeVariant', true) && (
                            <Tooltip title='Quitar de la reposición'>
                              <span>
                                <IconButton
                                  size='small'
                                  color='error'
                                  disabled={removing !== null}
                                  onClick={() => handleRemove(item)}
                                >
                                  <i className='tabler-x' />
                                </IconButton>
                              </span>
                            </Tooltip>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      <AddVariantsDialog open={addOpen} onClose={() => setAddOpen(false)} showMessage={showMessage} />

      <TransferActionsModal
        action={cancelOpen && open ? { kind: 'cancel', transfer: open } : null}
        onClose={() => setCancelOpen(false)}
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

export default MyReplenishment
