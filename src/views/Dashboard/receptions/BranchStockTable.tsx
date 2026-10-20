'use client'

import { useEffect, useMemo, useState } from 'react'

import { useQueryClient } from '@tanstack/react-query'

import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import Accordion from '@mui/material/Accordion'
import AccordionSummary from '@mui/material/AccordionSummary'
import AccordionDetails from '@mui/material/AccordionDetails'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import TablePagination from '@mui/material/TablePagination'
import Skeleton from '@mui/material/Skeleton'
import Alert from '@mui/material/Alert'
import Snackbar from '@mui/material/Snackbar'
import CircularProgress from '@mui/material/CircularProgress'

import CustomTextField from '@core/components/mui/TextField'
import tableStyles from '@core/styles/table.module.css'
import { useUserRole } from '@/hooks/useUserRole'
import { useVariants } from '@/hooks/useVariants'
import { variantService } from '@/services/variantService'
import type { Variant, VariantSize } from '@/types/api/variants'
import { prendas } from '@/views/Dashboard/central-warehouse/units'
import StockStatusCell from '@/views/Dashboard/central-warehouse/StockStatusCell'
import SubtractBranchStockModal from './SubtractBranchStockModal'
import type { SubtractTarget } from './SubtractBranchStockModal'

type SizeRow = {
  variantSizeId: number
  sizeName: string
  availableStock: number
  warehouseStock: number
  inTransitStock: number
  centralWarehouseStock: number
}

type ColorGroup = {
  key: string
  colorName: string
  colorCode: string
  sizes: SizeRow[]
}

type ProductGroup = {
  key: string
  productName: string
  onFloor: number
  colors: ColorGroup[]
}

// El back devuelve una variante por producto-color: para el acordeon se reagrupa por producto
const groupByProduct = (variants: Variant[]): ProductGroup[] => {
  const groups = new Map<string, ProductGroup>()

  variants.forEach((variant, index) => {
    const productName = variant.product?.name || 'Producto'
    const productKey = String(variant.product?.id ?? variant.productId ?? productName)

    const sizes: SizeRow[] = (variant.variants || []).map((size: VariantSize) => ({
      variantSizeId: Number(size.id),
      sizeName: typeof size.size === 'object' ? size.size.name : String(size.size ?? ''),
      availableStock: size.availableStock || 0,
      warehouseStock: size.warehouseStock || 0,
      inTransitStock: size.inTransitStock || 0,
      centralWarehouseStock: size.centralWarehouseStock || 0
    }))

    const color: ColorGroup = {
      key: `${productKey}-${variant.id ?? index}`,
      colorName: variant.color?.name || variant.colorName || 'Color',
      colorCode: variant.color?.code || variant.colorCode || '#000',
      sizes
    }

    const existing = groups.get(productKey)
    const onFloor = sizes.reduce((sum, size) => sum + size.availableStock, 0)

    if (existing) {
      existing.colors.push(color)
      existing.onFloor += onFloor
    } else {
      groups.set(productKey, { key: productKey, productName, onFloor, colors: [color] })
    }
  })

  return [...groups.values()]
}

const BranchStockTable = () => {
  const queryClient = useQueryClient()

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [toFloor, setToFloor] = useState<Record<number, number>>({})
  const [toWarehouse, setToWarehouse] = useState<Record<number, number>>({})
  const [subtractTarget, setSubtractTarget] = useState<SubtractTarget | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [snackbar, setSnackbar] = useState<{ message: string; severity: 'success' | 'error' } | null>(null)

  // Dar de baja es ADMIN/SUPERVISOR/MANAGER: el cajero no la tiene
  const { isCashier } = useUserRole()

  // Sin branchId: el back resuelve la sucursal del usuario
  const { data, isLoading, isError, isPlaceholderData } = useVariants(page, pageSize, search, undefined, true, true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput)
      setPage(1)
    }, 500)

    return () => clearTimeout(timer)
  }, [searchInput])

  const groups = useMemo(() => groupByProduct(data?.data || []), [data])

  const stockById = useMemo(() => {
    const map: Record<number, SizeRow> = {}

    groups.forEach(group =>
      group.colors.forEach(color =>
        color.sizes.forEach(size => {
          map[size.variantSizeId] = size
        })
      )
    )

    return map
  }, [groups])

  const toFloorEntries = Object.entries(toFloor).filter(([, quantity]) => quantity > 0)
  const toWarehouseEntries = Object.entries(toWarehouse).filter(([, quantity]) => quantity > 0)
  const hasChanges = toFloorEntries.length > 0 || toWarehouseEntries.length > 0

  const toFloorUnits = toFloorEntries.reduce((sum, [, quantity]) => sum + quantity, 0)
  const toWarehouseUnits = toWarehouseEntries.reduce((sum, [, quantity]) => sum + quantity, 0)

  const overStock =
    toFloorEntries.some(([id, qty]) => qty > (stockById[Number(id)]?.warehouseStock ?? 0)) ||
    toWarehouseEntries.some(([id, qty]) => qty > (stockById[Number(id)]?.availableStock ?? 0))

  const total = data?.meta?.total || 0

  const setQuantity = (setter: typeof setToFloor, variantSizeId: number, value: string) => {
    const quantity = parseInt(value, 10)

    setter(prev => {
      const next = { ...prev }

      if (!quantity || quantity <= 0) delete next[variantSizeId]
      else next[variantSizeId] = quantity

      return next
    })
  }

  const pendingInProduct = (group: ProductGroup) =>
    group.colors.reduce(
      (sum, color) =>
        sum +
        color.sizes.reduce(
          (acc, size) => acc + (toFloor[size.variantSizeId] || 0) + (toWarehouse[size.variantSizeId] || 0),
          0
        ),
      0
    )

  const handleSave = async () => {
    setIsSaving(true)

    const moves = [
      ...toFloorEntries.map(([id, quantity]) => ({
        variantId: Number(id),
        quantity,
        direction: 'warehouse_to_floor' as const
      })),
      ...toWarehouseEntries.map(([id, quantity]) => ({
        variantId: Number(id),
        quantity,
        direction: 'floor_to_warehouse' as const
      }))
    ]

    const failedToFloor: Record<number, number> = {}
    const failedToWarehouse: Record<number, number> = {}
    let movedUnits = 0

    for (const move of moves) {
      try {
        await variantService.transferStock(move)
        movedUnits += move.quantity
      } catch {
        if (move.direction === 'warehouse_to_floor') failedToFloor[move.variantId] = move.quantity
        else failedToWarehouse[move.variantId] = move.quantity
      }
    }

    // Lo que fallo queda en el input para reintentar
    setToFloor(failedToFloor)
    setToWarehouse(failedToWarehouse)
    queryClient.invalidateQueries({ queryKey: ['variants'] })
    setIsSaving(false)

    const failedCount = Object.keys(failedToFloor).length + Object.keys(failedToWarehouse).length

    setSnackbar(
      failedCount === 0
        ? { message: `Se movieron ${prendas(movedUnits)}`, severity: 'success' }
        : { message: `Se movieron ${prendas(movedUnits)}; ${failedCount} no se pudieron mover`, severity: 'error' }
    )
  }

  return (
    <>
      <Card>
        <CardHeader
          title='Stock'
          subheader='Lo recibido ingresa a la bodega. Para venderlo, debe pasarse a la tienda.'
        />

        <Box className='flex flex-wrap items-center justify-between gap-4 px-6 pb-4'>
          <CustomTextField
            placeholder='Buscar producto...'
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            className='max-sm:is-full sm:is-[300px]'
          />

          <Box className='flex flex-wrap items-center gap-3 max-sm:is-full'>
            {toFloorUnits > 0 && (
              <Chip label={`${toFloorUnits} a tienda`} color='success' variant='tonal' size='small' />
            )}
            {toWarehouseUnits > 0 && (
              <Chip label={`${toWarehouseUnits} a bodega`} color='secondary' variant='tonal' size='small' />
            )}
            {hasChanges && (
              <Button
                color='secondary'
                onClick={() => {
                  setToFloor({})
                  setToWarehouse({})
                }}
                disabled={isSaving}
              >
                Descartar
              </Button>
            )}
            <Button
              variant='contained'
              onClick={handleSave}
              disabled={!hasChanges || overStock || isSaving}
              startIcon={isSaving ? <CircularProgress size={16} /> : <i className='tabler-device-floppy' />}
            >
              {isSaving ? 'Guardando...' : 'Guardar cambios'}
            </Button>
          </Box>
        </Box>

        {overStock && (
          <Box sx={{ px: 6, pb: 4 }}>
            <Alert severity='error'>Hay cantidades que superan el stock disponible.</Alert>
          </Box>
        )}

        <Divider />

        {isError ? (
          <Box sx={{ p: 4 }}>
            <Alert severity='error'>Error al cargar el stock.</Alert>
          </Box>
        ) : isLoading ? (
          <Box sx={{ p: 6 }}>
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} height={48} sx={{ mb: 1 }} />
            ))}
          </Box>
        ) : groups.length === 0 ? (
          <Box sx={{ p: 8, textAlign: 'center' }}>
            <Typography color='text.secondary'>
              {search ? 'No se encontraron productos' : 'La sucursal todavía no tiene stock'}
            </Typography>
          </Box>
        ) : (
          <Box sx={{ opacity: isPlaceholderData ? 0.6 : 1, transition: 'opacity 0.2s' }}>
            {groups.map(group => {
              const groupPending = pendingInProduct(group)
              const isOpen = expanded[group.key] ?? groupPending > 0

              return (
                <Accordion
                  key={group.key}
                  disableGutters

                  // Las filas cerradas no se montan: con muchos productos eran cientos de inputs invisibles.
                  // Las cantidades viven en toFloor/toWarehouse, no en los inputs, asi que no se pierden.
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
                    <Box className='flex flex-wrap items-center gap-3'>
                      <Typography className='font-medium' color={isOpen ? 'primary.main' : 'text.primary'}>
                        {group.productName}
                      </Typography>
                      <Chip
                        label={`${group.onFloor} en tienda`}
                        size='small'
                        variant='tonal'
                        color={group.onFloor > 0 ? 'success' : 'default'}
                      />
                      <Typography variant='body2' color='text.secondary'>
                        {group.colors.length} color(es)
                      </Typography>
                      {groupPending > 0 && (
                        <Chip label={`${groupPending} sin guardar`} size='small' variant='tonal' color='warning' />
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
                            <th>Bodega</th>
                            <th>Pasar a tienda</th>
                            <th>Tienda</th>
                            <th>Devolver a bodega</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {group.colors.flatMap(color =>
                            color.sizes.map((size, sizeIndex) => {
                              const label = `${group.productName} · ${color.colorName} · Talla ${size.sizeName}`

                              return (
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
                                    <StockStatusCell stock={size.warehouseStock} />
                                  </td>
                                  <td>
                                    <Tooltip
                                      title={
                                        size.warehouseStock === 0
                                          ? 'Sin stock en la bodega'
                                          : `Hasta ${size.warehouseStock}`
                                      }
                                    >
                                      <span>
                                        <CustomTextField
                                          type='number'
                                          size='small'
                                          placeholder='0'
                                          disabled={size.warehouseStock === 0}
                                          error={(toFloor[size.variantSizeId] || 0) > size.warehouseStock}
                                          value={toFloor[size.variantSizeId] || ''}
                                          onChange={e => setQuantity(setToFloor, size.variantSizeId, e.target.value)}
                                          sx={{ width: '100px' }}
                                          inputProps={{ min: 0, max: size.warehouseStock }}
                                        />
                                      </span>
                                    </Tooltip>
                                  </td>
                                  <td>
                                    <StockStatusCell stock={size.availableStock} />
                                  </td>
                                  <td>
                                    <Tooltip
                                      title={
                                        size.availableStock === 0
                                          ? 'Sin stock en la tienda'
                                          : `Hasta ${size.availableStock}`
                                      }
                                    >
                                      <span>
                                        <CustomTextField
                                          type='number'
                                          size='small'
                                          placeholder='0'
                                          disabled={size.availableStock === 0}
                                          error={(toWarehouse[size.variantSizeId] || 0) > size.availableStock}
                                          value={toWarehouse[size.variantSizeId] || ''}
                                          onChange={e =>
                                            setQuantity(setToWarehouse, size.variantSizeId, e.target.value)
                                          }
                                          sx={{ width: '100px' }}
                                          inputProps={{ min: 0, max: size.availableStock }}
                                        />
                                      </span>
                                    </Tooltip>
                                  </td>
                                  <td>
                                    {!isCashier && (
                                      <Tooltip title='Dar de baja'>
                                        <span>
                                          <IconButton
                                            size='small'
                                            color='error'
                                            disabled={size.availableStock === 0 && size.warehouseStock === 0}
                                            onClick={() =>
                                              setSubtractTarget({
                                                variantSizeId: size.variantSizeId,
                                                label,
                                                availableStock: size.availableStock,
                                                warehouseStock: size.warehouseStock
                                              })
                                            }
                                          >
                                            <i className='tabler-trash' />
                                          </IconButton>
                                        </span>
                                      </Tooltip>
                                    )}
                                  </td>
                                </tr>
                              )
                            })
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

      <SubtractBranchStockModal
        target={subtractTarget}
        onClose={() => setSubtractTarget(null)}
        showMessage={(message, severity) => setSnackbar({ message, severity })}
      />

      <Snackbar
        open={!!snackbar}
        autoHideDuration={4000}
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

export default BranchStockTable
