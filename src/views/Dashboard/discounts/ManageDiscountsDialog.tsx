'use client'

// Gestión de los descuentos en sí (no de los productos que los llevan).
//
// Existe por un problema concreto: hasta ahora lo único para sacar un descuento
// eran los botones de "eliminar todos los permanentes / temporales", que borran
// los de TODAS las sucursales. Si solo querías sacarlo de una tienda, no había
// forma.
//
// Acá cada descuento se edita con `PATCH /discounts/:tipo/:id`, que reemplaza
// sus listas de sucursales. Para quitarlo de una tienda se manda la lista sin
// esa sucursal: sigue vivo en las demás.
//
// La sucursal sobre la que se opera es la del selector de la navbar, igual que
// al crear.

import { useState } from 'react'

import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Skeleton from '@mui/material/Skeleton'
import CircularProgress from '@mui/material/CircularProgress'

import { useBranchContext } from '@/contexts/BranchContext'
import {
  useDeleteDiscount,
  useDiscountsList,
  useUpdatePermanentDiscount,
  useUpdateSeasonalDiscount
} from '@/hooks/useDiscounts'
import type { DiscountResponse } from '@/types/api/discounts'

type Props = {
  open: boolean
  onClose: () => void
  showMessage: (message: string, severity: 'success' | 'error' | 'info' | 'warning') => void
}

// Un descuento con fechas es de temporada: decide a qué endpoint va el PATCH
const esDeTemporada = (discount: DiscountResponse) => !!discount.startDate

const ManageDiscountsDialog = ({ open, onClose, showMessage }: Props) => {
  const { selectedBranch, selectedBranchId } = useBranchContext()

  const { data: discounts = [], isLoading } = useDiscountsList(open)
  const updatePermanent = useUpdatePermanentDiscount()
  const updateSeasonal = useUpdateSeasonalDiscount()
  const eliminar = useDeleteDiscount()

  const [aEliminar, setAEliminar] = useState<DiscountResponse | null>(null)

  // Qué fila se está guardando: sin esto, al tocar una casilla se bloquean todas
  const [guardando, setGuardando] = useState<number | null>(null)

  const aplicaEnCanal = (discount: DiscountResponse, canal: 'in_store' | 'online') => {
    const lista = canal === 'online' ? discount.onlineBranches : discount.inStoreBranches

    return !!lista?.some(b => b.id === selectedBranchId)
  }

  // El PATCH reemplaza la lista entera, así que se manda la actual con la
  // sucursal agregada o quitada. Las demás sucursales quedan como estaban.
  const cambiarCanal = async (discount: DiscountResponse, canal: 'in_store' | 'online', activar: boolean) => {
    if (!selectedBranchId) return

    const idsDe = (lista?: { id: number }[]) => (lista || []).map(b => b.id)

    const conSucursal = (ids: number[]) =>
      activar ? [...new Set([...ids, selectedBranchId])] : ids.filter(id => id !== selectedBranchId)

    const inStore = idsDe(discount.inStoreBranches)
    const online = idsDe(discount.onlineBranches)

    const data = {
      inStoreBranchIds: canal === 'in_store' ? conSucursal(inStore) : inStore,
      onlineBranchIds: canal === 'online' ? conSucursal(online) : online
    }

    setGuardando(discount.id)

    try {
      if (esDeTemporada(discount)) {
        await updateSeasonal.mutateAsync({ id: discount.id, data })
      } else {
        await updatePermanent.mutateAsync({ id: discount.id, data })
      }

      showMessage(
        activar
          ? `El descuento ahora aplica en ${selectedBranch?.name || 'esta sucursal'}`
          : `El descuento dejó de aplicar en ${selectedBranch?.name || 'esta sucursal'}`,
        'success'
      )
    } catch (error: any) {
      showMessage(error?.response?.data?.message || 'No se pudo actualizar el descuento', 'error')
    } finally {
      setGuardando(null)
    }
  }

  const confirmarEliminar = async () => {
    if (!aEliminar) return

    try {
      await eliminar.mutateAsync(aEliminar.id)
      showMessage('Descuento eliminado', 'success')
      setAEliminar(null)
    } catch (error: any) {
      showMessage(error?.response?.data?.message || 'No se pudo eliminar', 'error')
    }
  }

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth='md' fullWidth>
        <DialogTitle>Descuentos existentes</DialogTitle>
        <DialogContent>
          <Alert severity='info' sx={{ mb: 4 }}>
            Las casillas son para <strong>{selectedBranch?.name || 'la sucursal seleccionada'}</strong>. Destildar
            saca el descuento de esta sucursal y lo deja vivo en las demás.
          </Alert>

          {isLoading ? (
            <Box>
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} height={64} sx={{ mb: 1 }} />
              ))}
            </Box>
          ) : discounts.length === 0 ? (
            <Typography color='text.secondary' sx={{ py: 6, textAlign: 'center' }}>
              Todavía no hay descuentos creados
            </Typography>
          ) : (
            discounts.map(discount => (
              <Box key={discount.id} sx={{ py: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Typography variant='body1' fontWeight='bold'>
                    {discount.description}
                  </Typography>
                  <Chip label={`-${discount.value}%`} size='small' color='error' variant='tonal' />
                  <Chip
                    label={esDeTemporada(discount) ? 'Temporal' : 'Permanente'}
                    size='small'
                    variant='tonal'
                    color={esDeTemporada(discount) ? 'warning' : 'secondary'}
                  />

                  {/* Existe y se lista, pero todavia no se cobra: sin esto se
                      confunde con uno vigente y nadie entiende por que el
                      precio no baja */}
                  {discount.scheduled && (
                    <Chip
                      label={
                        discount.startDate
                          ? `Programado desde ${new Date(discount.startDate).toLocaleDateString('es-BO')}`
                          : 'Programado'
                      }
                      size='small'
                      variant='tonal'
                      color='info'
                    />
                  )}

                  <Box sx={{ flex: 1 }} />

                  <Tooltip title='Eliminar este descuento'>
                    <span>
                      <IconButton size='small' color='error' onClick={() => setAEliminar(discount)}>
                        <i className='tabler-trash' />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Box>

                {/* Dónde vale hoy, para no editar a ciegas */}
                {esDeTemporada(discount) && (
                  <Typography variant='caption' color='text.secondary' sx={{ display: 'block', mt: 0.5 }}>
                    Del {new Date(discount.startDate as string).toLocaleDateString('es-BO')} al{' '}
                    {discount.endDate ? new Date(discount.endDate).toLocaleDateString('es-BO') : '—'}
                  </Typography>
                )}

                <Typography variant='caption' color='text.secondary' sx={{ display: 'block', mt: 0.5 }}>
                  Tienda física: {discount.inStoreBranches?.map(b => b.name).join(', ') || 'ninguna'} · Web:{' '}
                  {discount.onlineBranches?.map(b => b.name).join(', ') || 'ninguna'}
                </Typography>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1 }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={aplicaEnCanal(discount, 'in_store')}
                        disabled={guardando === discount.id || !selectedBranchId}
                        onChange={e => cambiarCanal(discount, 'in_store', e.target.checked)}
                      />
                    }
                    label='Tienda física'
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={aplicaEnCanal(discount, 'online')}
                        disabled={guardando === discount.id || !selectedBranchId}
                        onChange={e => cambiarCanal(discount, 'online', e.target.checked)}
                      />
                    }
                    label='Web'
                  />

                  {guardando === discount.id && <CircularProgress size={16} />}
                </Box>

                <Divider sx={{ mt: 2 }} />
              </Box>
            ))
          )}
        </DialogContent>
        <DialogActions>
          <Button variant='contained' onClick={onClose}>
            Cerrar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Eliminar es de TODAS las sucursales: no es lo mismo que destildar */}
      <Dialog open={!!aEliminar} onClose={() => setAEliminar(null)} maxWidth='xs' fullWidth>
        <DialogTitle>
          <Typography fontWeight='bold'>¿Eliminar este descuento?</Typography>
        </DialogTitle>
        <DialogContent>
          <Typography>
            <strong>{aEliminar?.description}</strong> (-{aEliminar?.value}%). Esta acción no se puede deshacer.
          </Typography>

          <Alert severity='warning' sx={{ mt: 3 }}>
            Se elimina de <strong>todas las sucursales</strong> y de los productos que lo tengan. Si solo querés
            sacarlo de {selectedBranch?.name || 'esta sucursal'}, cerrá esto y destildá sus casillas.
          </Alert>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={() => setAEliminar(null)} disabled={eliminar.isPending} variant='outlined' fullWidth>
            No, volver
          </Button>
          <Button
            onClick={confirmarEliminar}
            color='error'
            variant='contained'
            disabled={eliminar.isPending}
            startIcon={eliminar.isPending ? <CircularProgress size={16} color='inherit' /> : null}
            fullWidth
          >
            {eliminar.isPending ? 'Eliminando...' : 'Sí, eliminar'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

export default ManageDiscountsDialog
