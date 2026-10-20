'use client'

import { useEffect, useState } from 'react'

import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Checkbox from '@mui/material/Checkbox'
import Chip from '@mui/material/Chip'
import Skeleton from '@mui/material/Skeleton'
import Typography from '@mui/material/Typography'
import TablePagination from '@mui/material/TablePagination'
import CircularProgress from '@mui/material/CircularProgress'

import CustomTextField from '@core/components/mui/TextField'
import tableStyles from '@core/styles/table.module.css'
import { useRequestReplenishment } from '@/hooks/useBranchTransfers'
import { useVariants } from '@/hooks/useVariants'
import type { VariantSize } from '@/types/api/variants'
import StockStatusCell from '@/views/Dashboard/central-warehouse/StockStatusCell'
import { variantes } from '@/views/Dashboard/central-warehouse/units'

type Props = {
  open: boolean
  onClose: () => void
  showMessage: (message: string, severity: 'success' | 'error') => void
}

const sizeName = (size: VariantSize) => (typeof size.size === 'object' ? size.size.name : String(size.size ?? ''))

// La tienda elige QUE variantes necesita, no cuantas: eso lo decide la central al atender
const AddVariantsDialog = ({ open, onClose, showMessage }: Props) => {
  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [note, setNote] = useState('')

  const request = useRequestReplenishment()

  // Sin branchId: el back resuelve la sucursal del usuario (y su marca pendingReplenishment)
  const { data, isLoading, isPlaceholderData } = useVariants(page, 10, search, undefined, open, true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput)
      setPage(1)
    }, 500)

    return () => clearTimeout(timer)
  }, [searchInput])

  useEffect(() => {
    if (!open) return

    setSelected(new Set())
    setNote('')
    setSearchInput('')
  }, [open])

  const toggle = (variantSizeId: number) =>
    setSelected(prev => {
      const next = new Set(prev)

      if (next.has(variantSizeId)) next.delete(variantSizeId)
      else next.add(variantSizeId)

      return next
    })

  const handleConfirm = async () => {
    try {
      await request.mutateAsync({ variantIds: [...selected], ...(note.trim() && { note: note.trim() }) })
      showMessage(
        `${variantes(selected.size)} ${selected.size === 1 ? 'agregada' : 'agregadas'} a la reposición`,
        'success'
      )
      onClose()
    } catch (error: any) {
      showMessage(error?.response?.data?.message || 'No se pudo pedir la reposición', 'error')
    }
  }

  const rows = (data?.data || []).flatMap(variant =>
    (variant.variants || []).map(size => ({
      variantSizeId: Number(size.id),
      label: `${variant.product?.name || 'Producto'} · ${variant.color?.name || variant.colorName || ''}`,
      size
    }))
  )

  return (
    <Dialog open={open} onClose={onClose} maxWidth='md' fullWidth>
      <DialogTitle>
        Agregar variantes a la reposición
        <Typography variant='body2' color='text.secondary' sx={{ mt: 1 }}>
          Marque lo que necesita. La central decide cuánto mandar de cada una.
        </Typography>
      </DialogTitle>

      <DialogContent>
        <CustomTextField
          fullWidth
          placeholder='Buscar producto...'
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          sx={{ mb: 4 }}
        />

        {isLoading ? (
          <Box>
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} height={44} sx={{ mb: 1 }} />
            ))}
          </Box>
        ) : rows.length === 0 ? (
          <Typography color='text.secondary' sx={{ textAlign: 'center', py: 6 }}>
            No se encontraron productos
          </Typography>
        ) : (
          <div className='overflow-x-auto' style={{ opacity: isPlaceholderData ? 0.6 : 1 }}>
            <table className={tableStyles.table}>
              <thead>
                <tr>
                  <th />
                  <th>Prenda</th>
                  <th>Talla</th>
                  <th>Tienda</th>
                  <th>Bodega central</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ variantSizeId, label, size }) => {
                  const alreadyRequested = !!size.pendingReplenishment

                  return (
                    <tr
                      key={variantSizeId}
                      onClick={() => !alreadyRequested && toggle(variantSizeId)}
                      style={{ cursor: alreadyRequested ? 'default' : 'pointer' }}
                    >
                      <td>
                        <Checkbox
                          size='small'
                          checked={alreadyRequested || selected.has(variantSizeId)}
                          disabled={alreadyRequested}
                        />
                      </td>
                      <td>
                        <Typography variant='body2'>{label}</Typography>
                      </td>
                      <td>
                        <Box className='flex items-center gap-2'>
                          <Typography variant='body2'>{sizeName(size)}</Typography>
                          {alreadyRequested && (
                            <Chip label='Ya pedida' size='small' variant='tonal' color='secondary' />
                          )}
                        </Box>
                      </td>
                      <td>
                        <StockStatusCell stock={size.availableStock || 0} />
                      </td>
                      <td>
                        <Typography variant='body2'>{size.centralWarehouseStock ?? 0}</Typography>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <TablePagination
          component='div'
          count={data?.meta?.total || 0}
          page={page - 1}
          onPageChange={(_, newPage) => setPage(newPage + 1)}
          rowsPerPage={10}
          rowsPerPageOptions={[10]}
          labelRowsPerPage='Filas por página'
        />

        <CustomTextField
          fullWidth
          multiline
          rows={2}
          label='Nota para la central (opcional)'
          placeholder='Se acabaron las M y L'
          value={note}
          onChange={e => setNote(e.target.value)}
          sx={{ mt: 2 }}
        />
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} color='secondary' disabled={request.isPending}>
          Volver
        </Button>
        <Button
          onClick={handleConfirm}
          variant='contained'
          disabled={selected.size === 0 || request.isPending}
          startIcon={request.isPending ? <CircularProgress size={16} /> : <i className='tabler-plus' />}
        >
          {request.isPending ? 'Agregando...' : selected.size > 0 ? `Agregar ${variantes(selected.size)}` : 'Agregar'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default AddVariantsDialog
