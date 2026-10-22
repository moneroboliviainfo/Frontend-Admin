'use client'

import { useEffect, useMemo, useState } from 'react'

import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Skeleton from '@mui/material/Skeleton'
import Alert from '@mui/material/Alert'
import Snackbar from '@mui/material/Snackbar'
import TablePagination from '@mui/material/TablePagination'
import Accordion from '@mui/material/Accordion'
import AccordionSummary from '@mui/material/AccordionSummary'
import AccordionDetails from '@mui/material/AccordionDetails'

import CustomTextField from '@core/components/mui/TextField'
import tableStyles from '@core/styles/table.module.css'
import { useBranchContext } from '@/contexts/BranchContext'
import { useVariants } from '@/hooks/useVariants'
import PositiveAdjustmentModal from '@/views/Dashboard/products/add/components/PositiveAdjustmentModal'
import type { Variant, VariantSize } from '@/types/api/variants'

type SizeRow = {
  variantSizeId: number
  sizeName: string

  // Lo FISICO de cada ubicacion, que es contra lo que se cuenta. `availableStock`
  // (lo vendible) no sirve acá: ya resta carritos y apartados que siguen colgados.
  salesFloorStock: number
  warehouseStock: number

  // Ya descontado por pedidos sin despachar, pero todavia en el local
  pendingDispatchSalesFloor: number
  pendingDispatchWarehouse: number
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
      salesFloorStock: size.salesFloorStock ?? size.availableStock ?? 0,
      warehouseStock: size.warehouseStock || 0,
      pendingDispatchSalesFloor: size.pendingDispatchSalesFloor || 0,
      pendingDispatchWarehouse: size.pendingDispatchWarehouse || 0
    }))

    const color: ColorGroup = {
      key: `${productKey}-${variant.id ?? index}`,
      colorName: variant.color?.name || variant.colorName || 'Color',
      colorCode: variant.color?.code || variant.colorCode || '#000',
      sizes
    }

    const existing = groups.get(productKey)
    const onFloor = sizes.reduce((sum, size) => sum + size.salesFloorStock, 0)

    if (existing) {
      existing.colors.push(color)
      existing.onFloor += onFloor
    } else {
      groups.set(productKey, { key: productKey, productName, onFloor, colors: [color] })
    }
  })

  return [...groups.values()]
}

const BranchStockAdminTable = () => {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [snackbar, setSnackbar] = useState<{ message: string; severity: 'success' | 'error' | 'warning' } | null>(null)

  const [adjustTarget, setAdjustTarget] = useState<{
    variantSizeId: number
    sizeName: string
    pendingDispatchSalesFloor: number
    pendingDispatchWarehouse: number
  } | null>(null)

  // Toda la pantalla cuelga del selector de la navbar: sin sucursal no hay nada
  // que mostrar, porque el stock que se lista es el de esa tienda.
  const { selectedBranchId, selectedBranch } = useBranchContext()

  const { data, isLoading, isError, isPlaceholderData } = useVariants(
    page,
    pageSize,
    search,
    selectedBranchId ?? undefined,
    !!selectedBranchId,
    true
  )

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput)
      setPage(1)
    }, 500)

    return () => clearTimeout(timer)
  }, [searchInput])

  // Al cambiar de sucursal se vuelve al principio: la pagina 4 de una tienda no
  // significa nada en otra
  useEffect(() => {
    setPage(1)
  }, [selectedBranchId])

  const groups = useMemo(() => groupByProduct(data?.data || []), [data])

  const total = data?.meta?.total || 0

  return (
    <>
      <Card>
        <CardHeader
          title='Stock de sucursales'
          subheader='Lo que tiene la sucursal seleccionada, para corregir diferencias de conteo.'
        />

        <Box className='flex flex-wrap items-center justify-between gap-4 px-6 pb-4'>
          <CustomTextField
            placeholder='Buscar producto'
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            className='max-sm:is-full sm:is-[300px]'
          />
          {selectedBranch && <Chip label={selectedBranch.name} color='primary' sx={{ fontWeight: 700 }} />}
        </Box>

        <Divider />

        {!selectedBranchId ? (
          <Box sx={{ p: 8, textAlign: 'center' }}>
            <Typography color='text.secondary'>Seleccione una sucursal en la barra superior</Typography>
          </Box>
        ) : isError ? (
          <Box sx={{ p: 4 }}>
            <Alert severity='error'>Error al cargar el stock de la sucursal.</Alert>
          </Box>
        ) : isLoading ? (
          <Box sx={{ p: 6 }}>
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} height={52} sx={{ mb: 1 }} />
            ))}
          </Box>
        ) : groups.length === 0 ? (
          <Box sx={{ p: 8, textAlign: 'center' }}>
            <Typography color='text.secondary'>No hay productos para mostrar</Typography>
          </Box>
        ) : (
          <Box sx={{ opacity: isPlaceholderData ? 0.6 : 1 }}>
            {groups.map(group => (
              <Accordion key={group.key} disableGutters>
                <AccordionSummary expandIcon={<i className='tabler-chevron-down' />}>
                  <Box className='flex items-center gap-3'>
                    <Typography className='font-medium'>{group.productName}</Typography>
                    <Chip label={`${group.onFloor} en tienda`} size='small' variant='tonal' color='primary' />
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
                          <th>Tienda</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {group.colors.flatMap(color =>
                          color.sizes.map((size, sizeIndex) => {
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
                                  <Typography variant='body2'>{size.warehouseStock}</Typography>
                                  {/* Ya descontadas pero todavia en el local: al contar
                                      aparecen, y sin este aviso se registran de mas */}
                                  {size.pendingDispatchWarehouse > 0 && (
                                    <Typography variant='caption' color='warning.main' display='block'>
                                      +{size.pendingDispatchWarehouse} por despachar
                                    </Typography>
                                  )}
                                </td>
                                <td>
                                  <Chip
                                    label={size.salesFloorStock}
                                    size='small'
                                    variant='tonal'
                                    color={size.salesFloorStock > 0 ? 'success' : 'default'}
                                  />
                                  {size.pendingDispatchSalesFloor > 0 && (
                                    <Typography variant='caption' color='warning.main' display='block'>
                                      +{size.pendingDispatchSalesFloor} por despachar
                                    </Typography>
                                  )}
                                </td>
                                <td>
                                  <Button
                                    size='small'
                                    variant='outlined'
                                    startIcon={<i className='tabler-adjustments' />}
                                    onClick={() =>
                                      setAdjustTarget({
                                        variantSizeId: size.variantSizeId,
                                        sizeName: size.sizeName,
                                        pendingDispatchSalesFloor: size.pendingDispatchSalesFloor,
                                        pendingDispatchWarehouse: size.pendingDispatchWarehouse
                                      })
                                    }
                                  >
                                    Ajustar
                                  </Button>
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
            ))}
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

      {/* A proposito no se le pasan los numeros de la fila: el listado trae
          `availableStock` NETO de reservas, y para contar hace falta el fisico.
          El modal consulta `branch-stock`, que da `salesFloor` y lo apartado. */}
      <PositiveAdjustmentModal
        open={!!adjustTarget}
        onClose={() => setAdjustTarget(null)}
        variants={adjustTarget ? [{ id: adjustTarget.variantSizeId, size: { name: adjustTarget.sizeName } }] : []}
        pendingDispatchSalesFloor={adjustTarget?.pendingDispatchSalesFloor}
        pendingDispatchWarehouse={adjustTarget?.pendingDispatchWarehouse}
        showMessage={(message, severity) =>
          setSnackbar({ message, severity: severity === 'info' ? 'warning' : severity })
        }
      />

      <Snackbar
        open={!!snackbar}
        autoHideDuration={5000}
        onClose={() => setSnackbar(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={snackbar?.severity} onClose={() => setSnackbar(null)}>
          {snackbar?.message}
        </Alert>
      </Snackbar>
    </>
  )
}

export default BranchStockAdminTable
