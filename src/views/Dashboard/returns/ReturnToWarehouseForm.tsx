'use client'

import { useEffect, useMemo, useState } from 'react'

import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Button from '@mui/material/Button'
import Divider from '@mui/material/Divider'
import Typography from '@mui/material/Typography'
import Skeleton from '@mui/material/Skeleton'
import TablePagination from '@mui/material/TablePagination'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Accordion from '@mui/material/Accordion'
import AccordionSummary from '@mui/material/AccordionSummary'
import AccordionDetails from '@mui/material/AccordionDetails'

import CustomTextField from '@core/components/mui/TextField'
import tableStyles from '@core/styles/table.module.css'
import { useVariantProducts } from '@/hooks/useVariants'
import { useCreateReturn } from '@/hooks/useBranchTransfers'
import { prendas } from '@/views/Dashboard/central-warehouse/units'
import ConfirmReturnModal from './ConfirmReturnModal'
import type { ReturnLine } from './ConfirmReturnModal'
import type { Variant, VariantSize } from '@/types/api/variants'

type Location = 'warehouse' | 'sales_floor'

type Row = {
  variantSizeId: number
  sizeName: string

  // Lo que se puede devolver de la ubicacion elegida
  disponible: number
}

type ColorGroup = {
  key: string
  colorName: string
  colorCode: string
  sizes: Row[]
}

type ProductGroup = {
  key: string
  productName: string
  colors: ColorGroup[]
}

type Props = {
  showMessage: (message: string, severity: 'success' | 'error') => void
}

// Una devolucion sale de UNA sola ubicacion: el selector decide contra que
// stock se compara. En la bodega no se puede devolver lo apartado por pedidos
// con QR sin pagar; en el piso, availableStock ya viene neto de reservas.
const disponibleEn = (size: VariantSize, location: Location) =>
  location === 'warehouse'
    ? (size.warehouseStock || 0) - (size.heldInWarehouse || 0)
    : size.availableStock || 0

const ReturnToWarehouseForm = ({ showMessage }: Props) => {
  const [location, setLocation] = useState<Location>('warehouse')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [quantities, setQuantities] = useState<Record<number, number>>({})
  const [note, setNote] = useState('')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [confirmOpen, setConfirmOpen] = useState(false)

  const createReturn = useCreateReturn()

  // branchId undefined: el back resuelve la sucursal del encargado o cajero
  const { data, isLoading, isPlaceholderData } = useVariantProducts(page, pageSize, search, undefined, true, true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput)
      setPage(1)
    }, 500)

    return () => clearTimeout(timer)
  }, [searchInput])

  // Al cambiar de ubicacion se limpia lo cargado: los topes son otros y lo
  // escrito para la bodega no vale para la tienda
  useEffect(() => {
    setQuantities({})
  }, [location])

  // Producto > color > talla, igual que Inventario -> Stock. El endpoint ya
  // pagina por producto: aca solo se reagrupa lo que vino aplanado.
  const groups: ProductGroup[] = useMemo(() => {
    const map = new Map<string, ProductGroup>()

    ;(data?.data || []).forEach((variant: Variant, index: number) => {
      const productName = variant.product?.name || 'Producto'
      const productKey = String(variant.product?.id ?? variant.productId ?? productName)

      const color: ColorGroup = {
        key: `${productKey}-${variant.id ?? index}`,
        colorName: variant.color?.name || variant.colorName || 'Color',
        colorCode: variant.color?.code || variant.colorCode || '#000',
        sizes: (variant.variants || []).map(size => ({
          variantSizeId: Number(size.id),
          sizeName: typeof size.size === 'object' ? size.size.name : String(size.size ?? ''),
          disponible: disponibleEn(size, location)
        }))
      }

      const existing = map.get(productKey)

      if (existing) existing.colors.push(color)
      else map.set(productKey, { key: productKey, productName, colors: [color] })
    })

    return [...map.values()]
  }, [data, location])

  // Lo cargado de ese producto, para avisarlo en el encabezado cerrado
  const pendingInProduct = (group: ProductGroup) =>
    group.colors.reduce(
      (sum, color) => sum + color.sizes.reduce((acc, size) => acc + (quantities[size.variantSizeId] || 0), 0),
      0
    )

  const entries = Object.entries(quantities).filter(([, quantity]) => quantity > 0)
  const totalUnits = entries.reduce((sum, [, quantity]) => sum + quantity, 0)

  // Lo cargado con su nombre completo, para que el modal muestre que se devuelve
  const lines: ReturnLine[] = useMemo(() => {
    const labels = new Map<number, string>()

    groups.forEach(group =>
      group.colors.forEach(color =>
        color.sizes.forEach(size =>
          labels.set(size.variantSizeId, `${group.productName} · ${color.colorName} · Talla ${size.sizeName}`)
        )
      )
    )

    return entries.map(([variantSizeId, quantity]) => ({
      variantSizeId: Number(variantSizeId),
      label: labels.get(Number(variantSizeId)) || `Variante ${variantSizeId}`,
      quantity
    }))
  }, [groups, entries])

  const setQuantity = (variantSizeId: number, value: string, max: number) => {
    const quantity = parseInt(value, 10)

    setQuantities(prev => {
      const next = { ...prev }

      if (!quantity || quantity <= 0) delete next[variantSizeId]
      else next[variantSizeId] = Math.min(quantity, max)

      return next
    })
  }

  const handleConfirm = async () => {
    try {
      const created = await createReturn.mutateAsync({
        items: entries.map(([variantSizeId, quantity]) => ({ variantId: Number(variantSizeId), quantity })),
        location,
        ...(note.trim() && { note: note.trim() })
      })

      showMessage('Devolución #' + created.id + ' en camino a la Bodega Central', 'success')
      setConfirmOpen(false)
      setQuantities({})
      setNote('')
    } catch (error: any) {
      showMessage(error?.response?.data?.message || 'No se pudo registrar la devolución', 'error')
    }
  }

  return (
    <Card>
      <CardHeader
        title='Devolver a bodega'
        subheader='Lo que se devuelve sale de su sucursal al confirmar y queda en camino a la Bodega Central.'
      />

      <Box sx={{ px: 6, pb: 4 }}>
        <Typography variant='body2' sx={{ mb: 2 }}>
          ¿De dónde salen las prendas?
        </Typography>

        <ToggleButtonGroup
          exclusive
          size='small'
          value={location}
          onChange={(_, value) => value && setLocation(value)}
          sx={{
            mb: 4,
            '& .MuiToggleButton-root': {
              textTransform: 'none',
              paddingInline: 4,
              '&.Mui-selected': {
                backgroundColor: 'primary.main',
                color: 'primary.contrastText',
                '&:hover': { backgroundColor: 'primary.dark' }
              }
            }
          }}
        >
          <ToggleButton value='warehouse'>De la bodega</ToggleButton>
          <ToggleButton value='sales_floor'>De la tienda</ToggleButton>
        </ToggleButtonGroup>

        <Box className='flex flex-wrap items-center justify-between gap-4'>
          <CustomTextField
            placeholder='Buscar producto'
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            className='max-sm:is-full sm:is-[300px]'
          />

          <Box className='flex flex-wrap items-center gap-3 max-sm:is-full'>
            {totalUnits > 0 && (
              <Chip label={prendas(totalUnits) + ' a devolver'} color='primary' variant='tonal' size='small' />
            )}
            {totalUnits > 0 && (
              <Button color='secondary' onClick={() => setQuantities({})} disabled={createReturn.isPending}>
                Descartar
              </Button>
            )}
            <Button
              variant='contained'
              onClick={() => setConfirmOpen(true)}
              disabled={entries.length === 0 || createReturn.isPending}
              startIcon={<i className='tabler-truck-return' />}
            >
              Devolver
            </Button>
          </Box>
        </Box>
      </Box>

      <Divider />

      {isLoading ? (
        <Box sx={{ p: 6 }}>
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} height={44} sx={{ mb: 1 }} />
          ))}
        </Box>
      ) : groups.length === 0 ? (
        <Box sx={{ p: 8, textAlign: 'center' }}>
          <Typography color='text.secondary'>No hay productos para mostrar</Typography>
        </Box>
      ) : (
        <Box sx={{ opacity: isPlaceholderData ? 0.6 : 1 }}>
          {groups.map(group => {
            const pending = pendingInProduct(group)
            const isOpen = !!expanded[group.key]

            return (
              <Accordion
                key={group.key}
                disableGutters

                // Lo cerrado no se monta: con muchos productos eran cientos de
                // inputs invisibles. Las cantidades viven en `quantities`, no en
                // los inputs, asi que al plegar y desplegar no se pierden.
                slotProps={{ transition: { unmountOnExit: true } }}
                expanded={isOpen}
                onChange={(_, open) => setExpanded(prev => ({ ...prev, [group.key]: open }))}
                sx={{
                  borderInlineStart: '3px solid',
                  borderInlineStartColor: isOpen ? 'primary.main' : 'transparent'
                }}
              >
                <AccordionSummary
                  expandIcon={<i className='tabler-chevron-down' />}
                  sx={{ bgcolor: isOpen ? 'primary.lighterOpacity' : 'transparent' }}
                >
                  <Box className='flex items-center gap-3'>
                    <Typography className='font-medium'>{group.productName}</Typography>
                    {/* Lo cargado se ve con el producto cerrado: si no, al
                        plegarlo se pierde de vista lo que ya se escribio */}
                    {pending > 0 && (
                      <Chip label={prendas(pending)} size='small' variant='tonal' color='primary' />
                    )}
                  </Box>
                </AccordionSummary>

                <AccordionDetails sx={{ p: 0 }}>
                  <div className='overflow-x-auto'>
                    <table className={tableStyles.table}>
                      <thead>
                        <tr>
                          <th>Color</th>
                          <th>Talla</th>
                          <th>{location === 'warehouse' ? 'En bodega' : 'En tienda'}</th>
                          <th>Devolver</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.colors.flatMap(color =>
                          color.sizes.map((size, sizeIndex) => (
                            <tr key={size.variantSizeId}>
                              <td>
                                {/* El color se escribe una sola vez por bloque de tallas */}
                                {sizeIndex === 0 && (
                                  <Box className='flex items-center gap-2'>
                                    <Box
                                      sx={{
                                        width: 16,
                                        height: 16,
                                        borderRadius: '50%',
                                        bgcolor: color.colorCode,
                                        border: '1px solid',
                                        borderColor: 'divider'
                                      }}
                                    />
                                    <Typography variant='body2'>{color.colorName}</Typography>
                                  </Box>
                                )}
                              </td>
                              <td>
                                <Typography variant='body2'>{size.sizeName}</Typography>
                              </td>
                              <td>
                                <Chip
                                  label={size.disponible}
                                  size='small'
                                  variant='tonal'
                                  color={size.disponible > 0 ? 'success' : 'default'}
                                />
                              </td>
                              <td>
                                <CustomTextField
                                  type='number'
                                  size='small'
                                  placeholder='0'
                                  disabled={size.disponible === 0}
                                  value={quantities[size.variantSizeId] || ''}
                                  onChange={e => setQuantity(size.variantSizeId, e.target.value, size.disponible)}
                                  sx={{ width: '100px' }}
                                  inputProps={{ min: 0, max: size.disponible }}
                                />
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </AccordionDetails>
              </Accordion>
            )
          })}
        </Box>
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

      <ConfirmReturnModal
        open={confirmOpen}
        lines={lines}
        location={location}
        note={note}
        onNoteChange={setNote}
        isPending={createReturn.isPending}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirm}
      />

    </Card>
  )
}

export default ReturnToWarehouseForm
