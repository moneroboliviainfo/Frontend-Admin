'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

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
import TablePagination from '@mui/material/TablePagination'
import Skeleton from '@mui/material/Skeleton'
import Alert from '@mui/material/Alert'
import Snackbar from '@mui/material/Snackbar'
import CircularProgress from '@mui/material/CircularProgress'
import Tooltip from '@mui/material/Tooltip'
import IconButton from '@mui/material/IconButton'

import CustomTextField from '@core/components/mui/TextField'
import tableStyles from '@core/styles/table.module.css'
import { useBranchContext } from '@/contexts/BranchContext'
import { useAuthContext } from '@/contexts/AuthContext'
import type { DispatchNote } from '@/utils/receptionReceipt'
import { useCentralWarehouse, useCentralDispatch } from '@/hooks/useBranchTransfers'
import { useVariantProducts, useSubtractStockBulk } from '@/hooks/useVariants'
import { variantService } from '@/services/variantService'
import type { Variant, VariantSize } from '@/types/api/variants'
import { prendas, variantes } from './units'
import ConfirmWarehouseChangesModal from './ConfirmWarehouseChangesModal'
import ExportMenu from './ExportMenu'
import ExcelImportModal from './ExcelImportModal'
import DispatchCreatedModal from './DispatchCreatedModal'
import type { ImportMode } from './ExcelImportModal'
import LowStockPanel from './LowStockPanel'
import MovementsModal from './MovementsModal'
import type { MovementsTarget } from './MovementsModal'
import RenameWarehouseModal from './RenameWarehouseModal'
import StockStatusCell from './StockStatusCell'
import ConfirmBulkSubtractModal from './ConfirmBulkSubtractModal'
import DispatchShortcuts from './DispatchShortcuts'
import type { ShortcutEntry } from './DispatchShortcuts'

export type SizeRow = {
  variantSizeId: number
  sizeName: string
  warehouseStock: number
}

export type ColorGroup = {
  key: string
  colorName: string
  colorCode: string
  sizes: SizeRow[]
}

export type ProductGroup = {
  key: string
  productName: string
  totalStock: number
  colors: ColorGroup[]
}

// Cada variante del back es un producto-color: para el acordeon hay que reagrupar por producto
const groupByProduct = (variants: Variant[]): ProductGroup[] => {
  const groups = new Map<string, ProductGroup>()

  variants.forEach((variant, index) => {
    const productName = variant.product?.name || 'Producto'
    const productKey = String(variant.product?.id ?? variant.productId ?? productName)

    const sizes: SizeRow[] = (variant.variants || []).map((size: VariantSize) => ({
      variantSizeId: Number(size.id),
      sizeName: typeof size.size === 'object' ? size.size.name : String(size.size ?? ''),

      // La bodega solo tiene deposito: su stock real es warehouseStock (availableStock siempre es 0)
      warehouseStock: size.warehouseStock || 0
    }))

    const color: ColorGroup = {
      key: `${productKey}-${variant.id ?? index}`,
      colorName: variant.color?.name || variant.colorName || 'Color',
      colorCode: variant.color?.code || variant.colorCode || '#000',
      sizes
    }

    const existing = groups.get(productKey)
    const stock = sizes.reduce((sum, size) => sum + size.warehouseStock, 0)

    if (existing) {
      existing.colors.push(color)
      existing.totalStock += stock
    } else {
      groups.set(productKey, { key: productKey, productName, totalStock: stock, colors: [color] })
    }
  })

  return [...groups.values()]
}

const CentralWarehouseTable = () => {
  const queryClient = useQueryClient()

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [incoming, setIncoming] = useState<Record<number, number>>({})
  const [outgoing, setOutgoing] = useState<Record<number, number>>({})
  const [labels, setLabels] = useState<Record<number, string>>({})
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [renameOpen, setRenameOpen] = useState(false)

  // Las dos importaciones viven acá porque son la version masiva de las dos
  // columnas de esta tabla: Ingresar y Enviar a <tienda>.
  const [importMode, setImportMode] = useState<ImportMode | null>(null)

  // El remito se ofrece DESPUES de confirmar, con el envio ya creado: asi lleva
  // su numero y refleja lo que quedo registrado
  const [dispatchNote, setDispatchNote] = useState<DispatchNote | null>(null)
  const [movementsTarget, setMovementsTarget] = useState<MovementsTarget | null>(null)

  // Dar de baja varias de una: el icono de basurero abre un input ahi mismo en
  // vez de un modal por variante; se junta todo y se manda con un solo motivo
  // via subtractstock/bulk (doc 06)
  const [subtractOpenRows, setSubtractOpenRows] = useState<Record<number, boolean>>({})
  const [toSubtract, setToSubtract] = useState<Record<number, number>>({})
  const [confirmSubtractOpen, setConfirmSubtractOpen] = useState(false)
  const subtractStockBulk = useSubtractStockBulk()

  // Atajos para llenar "Enviar" de todo un producto de una: viven en un modal
  // aparte, abierto por el boton del acordeon de ese producto
  const [shortcutsGroup, setShortcutsGroup] = useState<ProductGroup | null>(null)

  const [isSaving, setIsSaving] = useState(false)

  const [snackbar, setSnackbar] = useState<{ message: string; severity: 'success' | 'error' | 'warning' } | null>(null)

  // La sucursal destino es la que esta elegida en la navbar
  const { selectedBranch } = useBranchContext()

  // Quien despacha, para el remito
  const { user } = useAuthContext()
  const previousBranchId = useRef<number | null>(null)

  const { data: warehouse, isLoading: isLoadingWarehouse, isError: isWarehouseError } = useCentralWarehouse()
  const dispatchToBranch = useCentralDispatch()

  const {
    data,
    isLoading: isLoadingVariants,
    isError: isVariantsError,
    isPlaceholderData
  } = useVariantProducts(page, pageSize, search, warehouse?.id, !!warehouse?.id, true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput)
      setPage(1)
    }, 500)

    return () => clearTimeout(timer)
  }, [searchInput])

  // Al cambiar de sucursal lo que iba a salir apuntaba a otro destino: se vacia.
  // Los ingresos no se tocan, van a la bodega y no dependen del destino.
  useEffect(() => {
    const branchId = selectedBranch?.id ?? null
    const previous = previousBranchId.current

    previousBranchId.current = branchId

    if (previous === null || previous === branchId) return

    if (Object.keys(outgoing).length > 0) {
      setOutgoing({})
      setSnackbar({
        message: 'Cambió la sucursal seleccionada: se vaciaron las cantidades a enviar',
        severity: 'warning'
      })
    }
  }, [selectedBranch?.id, outgoing])

  const groups = useMemo(() => groupByProduct(data?.data || []), [data])

  const stockById = useMemo(() => {
    const map: Record<number, number> = {}

    groups.forEach(group =>
      group.colors.forEach(color =>
        color.sizes.forEach(size => {
          map[size.variantSizeId] = size.warehouseStock
        })
      )
    )

    return map
  }, [groups])

  const incomingEntries = Object.entries(incoming).filter(([, quantity]) => quantity > 0)
  const outgoingEntries = Object.entries(outgoing).filter(([, quantity]) => quantity > 0)
  const hasChanges = incomingEntries.length > 0 || outgoingEntries.length > 0

  const incomingUnits = incomingEntries.reduce((sum, [, quantity]) => sum + quantity, 0)
  const outgoingUnits = outgoingEntries.reduce((sum, [, quantity]) => sum + quantity, 0)

  // Lo que se ingresa en esta misma pantalla ya cuenta como disponible para enviar,
  // porque el addstock se guarda antes que el envio
  const maxToSend = (variantSizeId: number) => (stockById[variantSizeId] ?? 0) + (incoming[variantSizeId] || 0)

  const overStock = outgoingEntries.filter(([id, quantity]) => quantity > maxToSend(Number(id)))

  const canSave = hasChanges && overStock.length === 0 && (outgoingEntries.length === 0 || !!selectedBranch)

  const total = data?.meta?.total || 0
  const isLoading = isLoadingWarehouse || isLoadingVariants

  const setQuantity = (setter: typeof setIncoming, variantSizeId: number, label: string, value: string) => {
    const quantity = parseInt(value, 10)

    setLabels(prev => ({ ...prev, [variantSizeId]: label }))

    setter(prev => {
      const next = { ...prev }

      if (!quantity || quantity <= 0) delete next[variantSizeId]
      else next[variantSizeId] = quantity

      return next
    })
  }

  // Los atajos llenan muchas variantes de una: se mezclan igual que si se
  // hubiera tipeado cada input de "Enviar" a mano
  const applyShortcut = (entries: ShortcutEntry[]) => {
    setOutgoing(prev => {
      const next = { ...prev }

      entries.forEach(entry => {
        next[entry.variantSizeId] = entry.quantity
      })

      return next
    })

    setLabels(prev => {
      const next = { ...prev }

      entries.forEach(entry => {
        next[entry.variantSizeId] = entry.label
      })

      return next
    })
  }

  const pendingInProduct = (group: ProductGroup) =>
    group.colors.reduce(
      (sum, color) =>
        sum +
        color.sizes.reduce(
          (acc, size) => acc + (incoming[size.variantSizeId] || 0) + (outgoing[size.variantSizeId] || 0),
          0
        ),
      0
    )

  const discardAll = () => {
    setIncoming({})
    setOutgoing({})
  }

  const toSubtractEntries = Object.entries(toSubtract).filter(([, quantity]) => quantity > 0)
  const toSubtractUnits = toSubtractEntries.reduce((sum, [, quantity]) => sum + quantity, 0)
  const subtractOverStock = toSubtractEntries.some(([id, qty]) => qty > (stockById[Number(id)] ?? 0))

  const openSubtractRow = (variantSizeId: number) =>
    setSubtractOpenRows(prev => ({ ...prev, [variantSizeId]: true }))

  const closeSubtractRow = (variantSizeId: number) => {
    setSubtractOpenRows(prev => {
      const next = { ...prev }

      delete next[variantSizeId]

      return next
    })
    setToSubtract(prev => {
      const next = { ...prev }

      delete next[variantSizeId]

      return next
    })
  }

  const handleConfirmSubtractBulk = async (reason: string) => {
    try {
      await subtractStockBulk.mutateAsync({
        items: toSubtractEntries.map(([variantSizeId, quantity]) => ({
          variantId: Number(variantSizeId),

          // El back espera la cantidad en negativo
          quantity: -quantity
        })),
        reason
      })

      setToSubtract({})
      setSubtractOpenRows({})
      setConfirmSubtractOpen(false)
      setSnackbar({ message: `Se dieron de baja ${prendas(toSubtractUnits)} de la bodega`, severity: 'success' })
    } catch (error: any) {
      setSnackbar({ message: error?.response?.data?.message || 'No se pudo dar de baja', severity: 'error' })
    }
  }

  const handleConfirm = async (comment: string) => {
    setConfirmOpen(false)
    setIsSaving(true)

    const failedIncoming: Record<number, number> = {}
    let saved = 0
    let savedUnits = 0

    for (const [variantSizeId, quantity] of incomingEntries) {
      try {
        await variantService.addStock({ variantId: Number(variantSizeId), quantity })
        saved++
        savedUnits += quantity
      } catch {
        failedIncoming[Number(variantSizeId)] = quantity
      }
    }

    setIncoming(failedIncoming)

    const messages: string[] = []
    let severity: 'success' | 'error' = 'success'

    if (saved > 0) messages.push(`${prendas(savedUnits)} ingresadas a la bodega`)

    if (Object.keys(failedIncoming).length > 0) {
      messages.push(`${variantes(Object.keys(failedIncoming).length)} no se pudieron ingresar`)
      severity = 'error'
    }

    // El envio va despues de los ingresos, pero solo si todos entraron:
    // si falto stock que debia entrar, el back rechazaria el envio entero
    const canDispatch = outgoingEntries.length > 0 && Object.keys(failedIncoming).length === 0 && selectedBranch

    if (outgoingEntries.length > 0 && !canDispatch) {
      messages.push('el envio no se hizo')
      severity = 'error'
    } else if (canDispatch) {
      try {
        const created = await dispatchToBranch.mutateAsync({
          destinationBranchId: selectedBranch.id,
          items: outgoingEntries.map(([variantSizeId, quantity]) => ({
            variantId: Number(variantSizeId),
            quantity
          })),
          ...(comment && { note: comment })
        })

        messages.push(`${prendas(outgoingUnits)} en camino a ${selectedBranch.name}`)

        setDispatchNote({
          transferId: created.id,
          destination: selectedBranch.name,
          dispatchedBy: created.dispatchedBy?.name || user?.name || 'Bodega Central',
          lines: outgoingEntries.map(([variantSizeId, quantity]) => ({
            label: labels[Number(variantSizeId)] || `Variante ${variantSizeId}`,
            quantity
          }))
        })

        setOutgoing({})
      } catch (error: any) {
        messages.push(error?.response?.data?.message || 'el envio fallo')
        severity = 'error'
      }
    }

    queryClient.invalidateQueries({ queryKey: ['variants'] })
    setIsSaving(false)
    setSnackbar({ message: messages.join(' · '), severity })
  }

  if (isWarehouseError) {
    return (
      <Card>
        <Box sx={{ p: 4 }}>
          <Alert severity='error'>
            No se pudo acceder a la bodega central. Verifique que su usuario tenga permiso (ADMIN o SUPERVISOR).
          </Alert>
        </Box>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader
          title={
            <Box className='flex items-center gap-2'>
              <span>{warehouse?.name || 'Bodega Central'}</span>
              <Tooltip title='Renombrar bodega'>
                <IconButton size='small' onClick={() => setRenameOpen(true)} disabled={!warehouse?.id}>
                  <i className='tabler-pencil' />
                </IconButton>
              </Tooltip>
            </Box>
          }
          subheader={
            selectedBranch
              ? `Registre lo que entra a la bodega y lo que sale hacia ${selectedBranch.name} (la sucursal de la barra superior).`
              : 'Registre lo que entra a la bodega. Para enviar, seleccione una sucursal en la barra superior.'
          }
        />

        <Box className='flex flex-wrap items-center justify-between gap-4 px-6 pb-4'>
          <CustomTextField
            placeholder='Buscar producto...'
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            className='max-sm:is-full sm:is-[300px]'
          />

          <Box className='flex flex-wrap items-center gap-3 max-sm:is-full'>
            <ExportMenu
              warehouseId={warehouse?.id}
              showMessage={(message, severity) => setSnackbar({ message, severity })}
            />
            <Button
              size='small'
              variant='outlined'
              startIcon={<i className='tabler-file-spreadsheet' />}
              onClick={() => setImportMode('stock')}
            >
              Ingresar por Excel
            </Button>
            <Tooltip title={selectedBranch ? '' : 'Seleccione una sucursal en la barra superior'}>
              <span>
                <Button
                  size='small'
                  variant='outlined'
                  disabled={!selectedBranch}
                  startIcon={<i className='tabler-file-spreadsheet' />}
                  onClick={() => setImportMode('dispatch')}
                >
                  Enviar por Excel
                </Button>
              </span>
            </Tooltip>
            <LowStockPanel warehouseId={warehouse?.id} onPick={setSearchInput} />
            {incomingEntries.length > 0 && (
              <Chip label={`+${prendas(incomingUnits)} a bodega`} color='success' variant='tonal' size='small' />
            )}
            {outgoingEntries.length > 0 && (
              <Chip
                label={`-${prendas(outgoingUnits)} a ${selectedBranch?.name || 'sucursal'}`}
                color='primary'
                variant='tonal'
                size='small'
              />
            )}
            {hasChanges && (
              <Button color='secondary' onClick={discardAll} disabled={isSaving}>
                Descartar
              </Button>
            )}
            <Button
              variant='contained'
              onClick={() => setConfirmOpen(true)}
              disabled={!canSave || isSaving}
              startIcon={isSaving ? <CircularProgress size={16} /> : <i className='tabler-device-floppy' />}
            >
              {isSaving ? 'Guardando...' : 'Guardar cambios'}
            </Button>

            {toSubtractEntries.length > 0 && (
              <>
                <Chip
                  label={`-${prendas(toSubtractUnits)} a dar de baja`}
                  color='error'
                  variant='tonal'
                  size='small'
                />
                <Button
                  variant='outlined'
                  color='error'
                  onClick={() => setConfirmSubtractOpen(true)}
                  disabled={subtractOverStock}
                  startIcon={<i className='tabler-trash' />}
                >
                  Dar de baja
                </Button>
              </>
            )}
          </Box>
        </Box>

        {subtractOverStock && (
          <Box sx={{ px: 6, pb: 4 }}>
            <Alert severity='error'>Hay cantidades a dar de baja que superan el stock de la bodega.</Alert>
          </Box>
        )}

        {overStock.length > 0 && (
          <Box sx={{ px: 6, pb: 4 }}>
            <Alert severity='error'>
              Hay cantidades a enviar que superan el stock de la bodega. El envío se rechaza entero, no se despacha
              parcial.
            </Alert>
          </Box>
        )}

        {outgoingEntries.length > 0 && !selectedBranch && (
          <Box sx={{ px: 6, pb: 4 }}>
            <Alert severity='warning'>Seleccione una sucursal en la barra superior para poder enviar.</Alert>
          </Box>
        )}

        <Divider />

        {isVariantsError ? (
          <Box sx={{ p: 4 }}>
            <Alert severity='error'>Error al cargar el stock de la bodega.</Alert>
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
              {search ? 'No se encontraron productos' : 'La bodega central no tiene stock todavía'}
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
                  // Las cantidades viven en incoming/outgoing, no en los inputs, asi que no se pierden.
                  slotProps={{ transition: { unmountOnExit: true } }}
                  expanded={isOpen}
                  onChange={(_, isExpanded) => setExpanded(prev => ({ ...prev, [group.key]: isExpanded }))}
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
                        label={`${group.totalStock} en bodega`}
                        size='small'
                        variant='tonal'
                        color={group.totalStock > 0 ? 'success' : 'default'}
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
                    <Box sx={{ px: 4, pt: 4 }}>
                      <Tooltip title={selectedBranch ? '' : 'Seleccione una sucursal en la barra superior'}>
                        <span>
                          <Button
                            size='small'
                            variant='outlined'
                            disabled={!selectedBranch}
                            startIcon={<i className='tabler-bolt' />}
                            onClick={() => setShortcutsGroup(group)}
                          >
                            Atajos
                          </Button>
                        </span>
                      </Tooltip>
                    </Box>
                    <div className='overflow-x-auto'>
                      <table className={tableStyles.table}>
                        <thead>
                          <tr>
                            <th>Color</th>
                            <th>Talla</th>
                            <th>Añadir stock</th>
                            <th>En bodega</th>
                            <th>
                              {selectedBranch ? (
                                <Chip
                                  label={`Enviar a ${selectedBranch.name}`}
                                  size='small'
                                  variant='tonal'
                                  color='primary'
                                />
                              ) : (
                                'Enviar'
                              )}
                            </th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {group.colors.flatMap(color =>
                            color.sizes.map((size, sizeIndex) => {
                              const label = `${group.productName} · ${color.colorName} · Talla ${size.sizeName}`
                              const max = maxToSend(size.variantSizeId)
                              const toSend = outgoing[size.variantSizeId] || 0

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
                                    <CustomTextField
                                      type='number'
                                      size='small'
                                      placeholder='0'
                                      value={incoming[size.variantSizeId] || ''}
                                      onChange={e =>
                                        setQuantity(setIncoming, size.variantSizeId, label, e.target.value)
                                      }
                                      sx={{ width: '100px' }}
                                      inputProps={{ min: 0 }}
                                    />
                                  </td>
                                  <td>
                                    <StockStatusCell stock={size.warehouseStock} />
                                  </td>
                                  <td>
                                    <Tooltip
                                      title={
                                        !selectedBranch
                                          ? 'Seleccione una sucursal en la barra superior'
                                          : max === 0
                                            ? 'Sin stock en la bodega'
                                            : `Hasta ${max}`
                                      }
                                    >
                                      <span>
                                        <CustomTextField
                                          type='number'
                                          size='small'
                                          placeholder='0'
                                          disabled={!selectedBranch || max === 0}
                                          error={toSend > max}
                                          value={toSend || ''}
                                          onChange={e =>
                                            setQuantity(setOutgoing, size.variantSizeId, label, e.target.value)
                                          }
                                          sx={{ width: '100px' }}
                                          inputProps={{ min: 0, max }}
                                        />
                                      </span>
                                    </Tooltip>
                                  </td>
                                  <td>
                                    <Tooltip title='Ver movimientos'>
                                      <IconButton
                                        size='small'
                                        onClick={() => setMovementsTarget({ variantSizeId: size.variantSizeId, label })}
                                      >
                                        <i className='tabler-history' />
                                      </IconButton>
                                    </Tooltip>
                                    {subtractOpenRows[size.variantSizeId] ? (
                                      <Box className='flex items-center gap-1'>
                                        <CustomTextField
                                          autoFocus
                                          type='number'
                                          size='small'
                                          placeholder='0'
                                          error={(toSubtract[size.variantSizeId] || 0) > size.warehouseStock}
                                          value={toSubtract[size.variantSizeId] || ''}
                                          onChange={e =>
                                            setQuantity(setToSubtract, size.variantSizeId, label, e.target.value)
                                          }
                                          sx={{ width: '90px' }}
                                          inputProps={{ min: 0, max: size.warehouseStock }}
                                        />
                                        <Tooltip title='Cancelar'>
                                          <IconButton size='small' onClick={() => closeSubtractRow(size.variantSizeId)}>
                                            <i className='tabler-x' />
                                          </IconButton>
                                        </Tooltip>
                                      </Box>
                                    ) : (
                                      <Tooltip title='Dar de baja'>
                                        <span>
                                          <IconButton
                                            size='small'
                                            color='error'
                                            disabled={size.warehouseStock === 0}
                                            onClick={() => openSubtractRow(size.variantSizeId)}
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

      <MovementsModal target={movementsTarget} warehouseId={warehouse?.id} onClose={() => setMovementsTarget(null)} />

      <DispatchCreatedModal note={dispatchNote} onClose={() => setDispatchNote(null)} />

      <ExcelImportModal
        mode={importMode}
        destinationBranch={selectedBranch}
        onClose={() => setImportMode(null)}
        showMessage={(message, severity) => setSnackbar({ message, severity })}
      />

      <RenameWarehouseModal
        open={renameOpen}
        currentName={warehouse?.name || ''}
        onClose={() => setRenameOpen(false)}
        showMessage={(message, severity) => setSnackbar({ message, severity })}
      />

      <ConfirmBulkSubtractModal
        open={confirmSubtractOpen}
        lines={toSubtractEntries.map(([variantSizeId, quantity]) => ({
          variantSizeId: Number(variantSizeId),
          label: labels[Number(variantSizeId)] || `Variante ${variantSizeId}`,
          quantity
        }))}
        isPending={subtractStockBulk.isPending}
        onClose={() => setConfirmSubtractOpen(false)}
        onConfirm={handleConfirmSubtractBulk}
      />

      {shortcutsGroup && (
        <DispatchShortcuts
          group={shortcutsGroup}
          onApply={applyShortcut}
          onClose={() => setShortcutsGroup(null)}
        />
      )}

      <ConfirmWarehouseChangesModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirm}
        branchName={selectedBranch?.name}
        labels={labels}
        incoming={incomingEntries}
        outgoing={outgoingEntries}
      />

      <Snackbar
        open={!!snackbar}
        autoHideDuration={6000}
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

export default CentralWarehouseTable
