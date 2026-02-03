'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import type { SyntheticEvent } from 'react'

import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import type { Dayjs } from 'dayjs'
import dayjs from 'dayjs'
import 'dayjs/locale/es'
import Checkbox from '@mui/material/Checkbox'
import Snackbar from '@mui/material/Snackbar'

import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import Chip from '@mui/material/Chip'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Skeleton from '@mui/material/Skeleton'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import DialogContentText from '@mui/material/DialogContentText'
import Button from '@mui/material/Button'
import MenuItem from '@mui/material/MenuItem'
import TablePagination from '@mui/material/TablePagination'
import IconButton from '@mui/material/IconButton'
import type { TextFieldProps } from '@mui/material/TextField'
import { useTheme } from '@mui/material/styles'
import classnames from 'classnames'
import { rankItem } from '@tanstack/match-sorter-utils'
import Avatar from '@mui/material/Avatar'
import AvatarGroup from '@mui/material/AvatarGroup'
import Tooltip from '@mui/material/Tooltip'
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFacetedMinMaxValues,
  getSortedRowModel
} from '@tanstack/react-table'
import type { ColumnDef, FilterFn } from '@tanstack/react-table'
import type { RankingInfo } from '@tanstack/match-sorter-utils'

import {
  useCreatePermanentDiscount,
  useCreateSeasonalDiscount,
  useAddDiscountsToProducts,
  useRemoveDiscountFromProduct,
  useApplyDiscountToAll,
  useDeleteAllPermanentDiscounts,
  useDeleteAllSeasonalDiscounts
} from '@/hooks/useDiscounts'

import CustomTextField from '@core/components/mui/TextField'
import { useProducts } from '@/hooks/useProducts'
import tableStyles from '@core/styles/table.module.css'

declare module '@tanstack/table-core' {
  interface FilterFns {
    fuzzy: FilterFn<unknown>
  }
  interface FilterMeta {
    itemRank: RankingInfo
  }
}

export type SnackbarMessage = {
  key: number
  message: string
  severity: 'success' | 'error' | 'info' | 'warning'
}

const fuzzyFilter: FilterFn<any> = (row, columnId, value, addMeta) => {
  const itemRank = rankItem(row.getValue(columnId), value)

  addMeta({ itemRank })

  return itemRank.passed
}

const DebouncedInput = ({
  value: initialValue,
  onChange,
  debounce = 500,
  ...props
}: {
  value: string | number
  onChange: (value: string | number) => void
  debounce?: number
} & Omit<TextFieldProps, 'onChange'>) => {
  const [value, setValue] = useState(initialValue)

  useEffect(() => {
    setValue(initialValue)
  }, [initialValue])

  useEffect(() => {
    const timeout = setTimeout(() => {
      onChange(value)
    }, debounce)

    return () => clearTimeout(timeout)
  }, [value, onChange, debounce])

  return <CustomTextField {...props} value={value} onChange={e => setValue(e.target.value)} />
}

const DiscountsListTable = () => {
  const theme = useTheme()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [search, setSearch] = useState('')

  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteAllPermanentDialogOpen, setDeleteAllPermanentDialogOpen] = useState(false)
  const [deleteAllSeasonalDialogOpen, setDeleteAllSeasonalDialogOpen] = useState(false)
  const [productToRemoveDiscount, setProductToRemoveDiscount] = useState<number | null>(null)
  const [discountType, setDiscountType] = useState<'permanent' | 'temporary'>('permanent')

  const [formData, setFormData] = useState({
    description: '',
    value: 0,
    startDate: null as Dayjs | null,
    endDate: null as Dayjs | null
  })

  const [selectedProducts, setSelectedProducts] = useState<number[]>([])
  const [applyToAll, setApplyToAll] = useState(false)

  const [open, setOpen] = useState<boolean>(false)
  const [snackPack, setSnackPack] = useState<SnackbarMessage[]>([])
  const [messageInfo, setMessageInfo] = useState<SnackbarMessage | undefined>(undefined)

  const createPermanentDiscount = useCreatePermanentDiscount()
  const createSeasonalDiscount = useCreateSeasonalDiscount()
  const addDiscountsToProducts = useAddDiscountsToProducts()
  const removeDiscountFromProduct = useRemoveDiscountFromProduct()
  const applyDiscountToAll = useApplyDiscountToAll()
  const deleteAllPermanentDiscounts = useDeleteAllPermanentDiscounts()
  const deleteAllSeasonalDiscounts = useDeleteAllSeasonalDiscounts()

  const queryParams = useMemo(
    () => ({
      limit: pageSize,
      page: page,
      search: search
    }),
    [pageSize, page, search]
  )

  const { data: productsData, isLoading, error, isFetching } = useProducts(queryParams)

  const allProducts = useMemo(() => {
    return productsData?.products || []
  }, [productsData])

  const totalRecords = useMemo(() => {
    return productsData?.total || 0
  }, [productsData])

  useEffect(() => {
    if (snackPack.length && !messageInfo) {
      setOpen(true)
      setSnackPack(prev => prev.slice(1))
      setMessageInfo({ ...snackPack[0] })
    } else if (snackPack.length && messageInfo && open) {
      setOpen(false)
    }
  }, [snackPack, messageInfo, open])

  const showMessage = useCallback((message: string, severity: 'success' | 'error' | 'info' | 'warning') => {
    setSnackPack(prev => [...prev, { message, severity, key: new Date().getTime() }])
  }, [])

  const handleSnackbarClose = (event: Event | SyntheticEvent, reason?: string) => {
    if (reason === 'clickaway') {
      return
    }

    setOpen(false)
  }

  const handleExited = () => {
    setMessageInfo(undefined)
  }

  const handleCloseAddDialog = useCallback(() => {
    setAddDialogOpen(false)
    setApplyToAll(false)
  }, [])

  const handleSelectAll = useCallback(
    (checked: boolean) => {
      if (checked) {
        const allIds = allProducts.map(product => product.id)

        setSelectedProducts(allIds)
      } else {
        setSelectedProducts([])
      }
    },
    [allProducts]
  )

  const handleSelectProduct = useCallback((productId: number, checked: boolean) => {
    if (checked) {
      setSelectedProducts(prev => [...prev, productId])
    } else {
      setSelectedProducts(prev => prev.filter(id => id !== productId))
    }
  }, [])

  const isProductSelected = useCallback(
    (productId: number) => {
      return selectedProducts.includes(productId)
    },
    [selectedProducts]
  )

  const isAllSelected = useMemo(() => {
    return allProducts.length > 0 && selectedProducts.length === allProducts.length
  }, [allProducts, selectedProducts])

  const isIndeterminate = useMemo(() => {
    return selectedProducts.length > 0 && selectedProducts.length < allProducts.length
  }, [allProducts, selectedProducts])

  const handleOpenAddDialog = useCallback(() => {
    setFormData({
      description: '',
      value: 0,
      startDate: null,
      endDate: null
    })
    setDiscountType('permanent')
    setApplyToAll(false)
    setAddDialogOpen(true)
  }, [])

  const handleSubmitDiscount = useCallback(async () => {
    if (!applyToAll && selectedProducts.length === 0) {
      showMessage('Debe seleccionar al menos un producto o marcar "Aplicar a todos"', 'warning')

      return
    }

    if (!formData.description || formData.value <= 0) {
      showMessage('Complete todos los campos correctamente', 'warning')

      return
    }

    if (discountType === 'temporary' && (!formData.startDate || !formData.endDate)) {
      showMessage('Debe seleccionar las fechas de inicio y fin', 'warning')

      return
    }

    if (applyToAll && discountType !== 'temporary') {
      showMessage('Solo los descuentos temporales se pueden aplicar a todos los productos', 'warning')

      return
    }

    try {
      let discountResponse

      if (discountType === 'permanent') {
        discountResponse = await createPermanentDiscount.mutateAsync({
          description: formData.description,
          isActive: true,
          value: formData.value
        })
      } else {
        discountResponse = await createSeasonalDiscount.mutateAsync({
          description: formData.description,
          isActive: true,
          value: formData.value,
          startDate: formData.startDate!.toISOString(),
          endDate: formData.endDate!.toISOString()
        })
      }

      if (applyToAll) {
        await applyDiscountToAll.mutateAsync(discountResponse.id)
        showMessage('Descuento aplicado a TODOS los productos', 'success')
      } else {
        await addDiscountsToProducts.mutateAsync({
          productsIds: selectedProducts,
          discountId: discountResponse.id
        })
        showMessage(`Descuento aplicado a ${selectedProducts.length} producto(s)`, 'success')
      }

      handleCloseAddDialog()
      setSelectedProducts([])
    } catch (error) {
      console.error('Error al crear y asignar descuento:', error)
      showMessage(error instanceof Error ? error.message : 'Error al crear descuento', 'error')
    }
  }, [
    applyToAll,
    selectedProducts,
    formData,
    discountType,
    createPermanentDiscount,
    createSeasonalDiscount,
    addDiscountsToProducts,
    applyDiscountToAll,
    handleCloseAddDialog,
    showMessage
  ])

  const handleOpenDeleteDialog = useCallback((productId: number) => {
    setProductToRemoveDiscount(productId)
    setDeleteDialogOpen(true)
  }, [])

  const handleCloseDeleteDialog = useCallback(() => {
    setDeleteDialogOpen(false)
    setProductToRemoveDiscount(null)
  }, [])

  const handleConfirmRemoveDiscount = useCallback(async () => {
    if (productToRemoveDiscount) {
      try {
        await removeDiscountFromProduct.mutateAsync(productToRemoveDiscount)
        showMessage('Descuento eliminado correctamente', 'success')
        handleCloseDeleteDialog()
      } catch (error) {
        showMessage('Error al eliminar descuento', 'error')
      }
    }
  }, [productToRemoveDiscount, removeDiscountFromProduct, showMessage, handleCloseDeleteDialog])

  const handleConfirmDeleteAllPermanent = useCallback(async () => {
    try {
      await deleteAllPermanentDiscounts.mutateAsync()
      showMessage('Todos los descuentos permanentes han sido eliminados', 'success')
      setDeleteAllPermanentDialogOpen(false)
    } catch (error) {
      showMessage('Error al eliminar descuentos permanentes', 'error')
    }
  }, [deleteAllPermanentDiscounts, showMessage])

  const handleConfirmDeleteAllSeasonal = useCallback(async () => {
    try {
      await deleteAllSeasonalDiscounts.mutateAsync()
      showMessage('Todos los descuentos temporales han sido eliminados', 'success')
      setDeleteAllSeasonalDialogOpen(false)
    } catch (error) {
      showMessage('Error al eliminar descuentos temporales', 'error')
    }
  }, [deleteAllSeasonalDiscounts, showMessage])

  const columns = useMemo<ColumnDef<any, any>[]>(
    () => [
      {
        id: 'select',
        header: ({ table }: any) => (
          <Checkbox
            checked={isAllSelected}
            indeterminate={isIndeterminate}
            onChange={e => handleSelectAll(e.target.checked)}
            disabled={applyToAll}
          />
        ),
        cell: ({ row }: any) => (
          <Checkbox
            checked={isProductSelected(row.original.id)}
            onChange={e => handleSelectProduct(row.original.id, e.target.checked)}
            onClick={e => e.stopPropagation()}
            disabled={applyToAll}
          />
        ),
        enableSorting: false
      },
      {
        accessorKey: 'id',
        header: 'ID',
        cell: ({ row }: any) => (
          <Typography className='font-medium' color='text.primary'>
            {row.original.id}
          </Typography>
        )
      },
      {
        accessorKey: 'gender',
        header: 'Tienda',
        cell: ({ row }: any) => {
          const gender = row.original.subcategory.category.gender
          const isWomen = gender === 'female'

          return (
            <Chip
              label={isWomen ? 'MUJERES' : 'HOMBRES'}
              variant='tonal'
              color={isWomen ? 'error' : 'primary'}
              size='small'
            />
          )
        }
      },
      {
        accessorKey: 'name',
        header: 'Nombre',
        cell: ({ row }: any) => (
          <Typography className='font-medium' color='text.primary'>
            {row.original.name}
          </Typography>
        ),
        filterFn: 'fuzzy'
      },
      {
        accessorKey: 'price',
        header: 'Precio',
        cell: ({ row }: any) => (
          <Typography className='font-medium' color='text.primary'>
            ${row.original.price}
          </Typography>
        )
      },
      {
        accessorKey: 'description',
        header: 'Descripción',
        cell: ({ row }: any) => (
          <Box sx={{ maxWidth: 300 }}>
            <Typography variant='body2' className='truncate' title={row.original.description} color='text.secondary'>
              {row.original.description}
            </Typography>
          </Box>
        ),
        filterFn: 'fuzzy'
      },
      {
        accessorKey: 'images',
        header: 'Imágenes',
        cell: ({ row }: any) => {
          const productColors = row.original.productColors || []

          const allImages = productColors
            .flatMap((color: any) => color.multimedia || [])
            .filter((url: string) => url.match(/\.(jpeg|jpg|png|gif|webp)$/i))

          const displayImages = allImages.slice(0, 4)
          const remainingCount = allImages.length - 4

          if (allImages.length === 0) {
            return (
              <Typography variant='body2' color='text.secondary'>
                Sin imágenes
              </Typography>
            )
          }

          return (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AvatarGroup max={4} sx={{ '& .MuiAvatar-root': { width: 32, height: 32 } }}>
                {displayImages.map((url: string, index: number) => (
                  <Tooltip key={index} title={`Imagen ${index + 1}`}>
                    <Avatar src={url} alt={`Producto ${index + 1}`} variant='rounded' sx={{ cursor: 'pointer' }} />
                  </Tooltip>
                ))}
              </AvatarGroup>
              {remainingCount > 0 && (
                <Chip label={`+${remainingCount}`} size='small' color='default' variant='outlined' />
              )}
            </Box>
          )
        }
      },
      {
        accessorKey: 'discount',
        header: 'Descuento',
        cell: ({ row }: any) => {
          const discount = row.original.discount

          if (!discount) {
            return <Chip label='Sin descuento' size='small' variant='outlined' color='default' />
          }

          const discountTypeLabel = discount.startDate && discount.endDate ? 'Temporal' : 'Permanente'

          return (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                  <Chip label={`${discount.value}% OFF`} size='small' color='success' variant='tonal' />
                  <Chip label={discountTypeLabel} size='small' color='info' variant='outlined' />
                </Box>
                {discount.description && (
                  <Typography variant='caption' color='text.secondary' sx={{ fontSize: '0.7rem' }}>
                    {discount.description}
                  </Typography>
                )}
                {discount.startDate && discount.endDate && (
                  <Typography variant='caption' color='text.secondary' sx={{ fontSize: '0.65rem' }}>
                    {dayjs(discount.startDate).format('DD/MM/YYYY')} - {dayjs(discount.endDate).format('DD/MM/YYYY')}
                  </Typography>
                )}
              </Box>
              <IconButton
                size='small'
                color='error'
                onClick={e => {
                  e.stopPropagation()
                  handleOpenDeleteDialog(row.original.id)
                }}
              >
                <i className='tabler-x' />
              </IconButton>
            </Box>
          )
        }
      },

      {
        accessorKey: 'enabled',
        header: 'Estado',
        cell: ({ row }: any) => (
          <Chip
            label={row.original.enabled ? 'Activo' : 'Inactivo'}
            color={row.original.enabled ? 'success' : 'error'}
            size='small'
          />
        ),
        filterFn: (row: any, columnId: string, filterValue: any) => {
          if (filterValue === undefined || filterValue === '') return true

          return row.getValue(columnId) === filterValue
        }
      }
    ],
    [
      isAllSelected,
      isIndeterminate,
      handleSelectAll,
      isProductSelected,
      handleSelectProduct,
      handleOpenDeleteDialog,
      applyToAll
    ]
  )

  const table = useReactTable({
    data: allProducts,
    columns,
    filterFns: {
      fuzzy: fuzzyFilter
    },
    state: {},
    enableRowSelection: false,
    enableSorting: true,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getFacetedMinMaxValues: getFacetedMinMaxValues()
  })

  const renderSkeleton = () => (
    <tbody>
      {Array.from({ length: pageSize }).map((_, index) => (
        <tr key={index}>
          {columns.map((_, colIndex) => (
            <td key={colIndex} className='p-4'>
              <Skeleton variant='text' width='100%' height={20} />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  )

  if (error) {
    return (
      <Card>
        <Box sx={{ p: 4 }}>
          <Alert severity='error'>
            Error al cargar los productos: {error instanceof Error ? error.message : 'Error desconocido'}
          </Alert>
        </Box>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader title='Productos' />

      <Box className='flex flex-wrap justify-between gap-4 p-6'>
        <DebouncedInput
          value={search}
          onChange={value => {
            const newSearch = String(value)

            if (newSearch !== search) {
              setSearch(newSearch)
              setPage(1)
            }
          }}
          placeholder='Buscar Producto'
          className='max-sm:is-full'
          size='small'
        />
        <Box className='flex gap-4'>
          <Button
            variant='outlined'
            color='error'
            onClick={() => setDeleteAllSeasonalDialogOpen(true)}
            startIcon={<i className='tabler-trash' />}
            disabled={deleteAllSeasonalDiscounts.isPending}
          >
            Quitar Temporales
          </Button>
          <Button
            variant='outlined'
            color='error'
            onClick={() => setDeleteAllPermanentDialogOpen(true)}
            startIcon={<i className='tabler-trash' />}
            disabled={deleteAllPermanentDiscounts.isPending}
          >
            Quitar Permanentes
          </Button>
          <Button
            variant='contained'
            color='primary'
            onClick={handleOpenAddDialog}
            startIcon={<i className='tabler-plus' />}
          >
            Agregar Descuento
          </Button>
          <CustomTextField
            select
            value={pageSize}
            onChange={e => {
              setPageSize(Number(e.target.value))
              setPage(1)
            }}
            className='is-[70px]'
            size='small'
          >
            <MenuItem value={10}>10</MenuItem>
            <MenuItem value={25}>25</MenuItem>
            <MenuItem value={50}>50</MenuItem>
            <MenuItem value={100}>100</MenuItem>
          </CustomTextField>
        </Box>
      </Box>
      {isFetching && !isLoading && (
        <Box sx={{ px: 3, pb: 2 }}>
          <Alert severity='info'>Actualizando datos...</Alert>
        </Box>
      )}
      {selectedProducts.length > 0 && !applyToAll && (
        <Box sx={{ px: 3, pb: 2 }}>
          <Alert severity='info' onClose={() => setSelectedProducts([])}>
            {selectedProducts.length} producto(s) seleccionado(s)
          </Alert>
        </Box>
      )}
      <div className='overflow-x-auto'>
        <table className={tableStyles.table}>
          <thead>
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <th key={header.id} className={tableStyles.cell}>
                    {header.isPlaceholder ? null : (
                      <Box
                        className={classnames({
                          'flex items-center cursor-pointer select-none': header.column.getCanSort()
                        })}
                        onClick={header.column.getToggleSortingHandler()}
                        sx={{ color: theme.palette.text.primary }}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {{
                          asc: <i className='tabler-chevron-up text-xl' />,
                          desc: <i className='tabler-chevron-down text-xl' />
                        }[header.column.getIsSorted() as 'asc' | 'desc'] ?? null}
                      </Box>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          {isLoading ? (
            renderSkeleton()
          ) : table.getRowModel().rows.length === 0 ? (
            <tbody>
              <tr>
                <td colSpan={columns.length} className='text-center'>
                  <Typography color='text.secondary' sx={{ py: 4 }}>
                    No hay productos disponibles
                  </Typography>
                </td>
              </tr>
            </tbody>
          ) : (
            <tbody>
              {table.getRowModel().rows.map(row => (
                <tr key={row.original.id}>
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} className={tableStyles.cell}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          )}
        </table>
      </div>
      <TablePagination
        component='div'
        count={totalRecords}
        rowsPerPage={pageSize}
        page={page - 1}
        onPageChange={(_, newPage) => {
          setPage(newPage + 1)
        }}
        onRowsPerPageChange={event => {
          setPageSize(parseInt(event.target.value, 10))
          setPage(1)
        }}
        rowsPerPageOptions={[10, 25, 50, 100]}
        labelRowsPerPage='Filas por página:'
        labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count}`}
      />

      <Dialog open={addDialogOpen} onClose={handleCloseAddDialog} maxWidth='sm' fullWidth>
        <DialogTitle>Agregar Descuento</DialogTitle>
        <DialogContent>
          <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale='es'>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 2 }}>
              <CustomTextField
                select
                label='Tipo de Descuento'
                value={discountType}
                onChange={e => {
                  const newType = e.target.value as 'permanent' | 'temporary'

                  setDiscountType(newType)

                  if (newType === 'permanent') {
                    setApplyToAll(false)
                  }
                }}
                fullWidth
              >
                <MenuItem value='permanent'>Descuento Permanente</MenuItem>
                <MenuItem value='temporary'>Descuento Temporal</MenuItem>
              </CustomTextField>

              {/* Checkbox para aplicar a todos - SOLO para temporales */}
              {discountType === 'temporary' && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Checkbox
                    checked={applyToAll}
                    onChange={e => {
                      setApplyToAll(e.target.checked)

                      if (e.target.checked) {
                        setSelectedProducts([])
                      }
                    }}
                  />
                  <Typography>Aplicar descuento a TODOS los productos</Typography>
                </Box>
              )}

              {applyToAll && (
                <Alert severity='warning'>Este descuento se aplicará a TODOS los productos de la tienda</Alert>
              )}

              <CustomTextField
                label='Descripción'
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                fullWidth
                multiline
                rows={2}
              />

              <CustomTextField
                label='Valor del Descuento (%)'
                value={formData.value === 0 ? '' : formData.value}
                onChange={e => {
                  const value = e.target.value

                  if (value === '' || /^\d+$/.test(value)) {
                    const numValue = value === '' ? 0 : parseInt(value, 10)

                    if (numValue <= 100) {
                      setFormData({ ...formData, value: numValue })
                    }
                  }
                }}
                fullWidth
              />

              {discountType === 'temporary' && (
                <>
                  <DatePicker
                    label='Fecha de Inicio'
                    value={formData.startDate}
                    onChange={newValue => setFormData({ ...formData, startDate: newValue })}
                    slotProps={{
                      textField: {
                        fullWidth: true
                      }
                    }}
                  />

                  <DatePicker
                    label='Fecha de Fin'
                    value={formData.endDate}
                    onChange={newValue => setFormData({ ...formData, endDate: newValue })}
                    slotProps={{
                      textField: {
                        fullWidth: true
                      }
                    }}
                  />
                </>
              )}
            </Box>
          </LocalizationProvider>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseAddDialog} color='secondary'>
            Cancelar
          </Button>
          <Button onClick={handleSubmitDiscount} color='primary' variant='contained'>
            Crear Descuento
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteDialogOpen} onClose={handleCloseDeleteDialog}>
        <DialogTitle>Confirmar eliminación</DialogTitle>
        <DialogContent>
          <DialogContentText>
            ¿Estás seguro de que deseas eliminar el descuento de este producto? Esta acción no se puede deshacer.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeleteDialog} color='secondary'>
            Cancelar
          </Button>
          <Button onClick={handleConfirmRemoveDiscount} color='error' variant='contained'>
            Eliminar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteAllPermanentDialogOpen} onClose={() => setDeleteAllPermanentDialogOpen(false)}>
        <DialogTitle>Eliminar todos los descuentos permanentes</DialogTitle>
        <DialogContent>
          <DialogContentText>
            ¿Estás seguro de que deseas eliminar TODOS los descuentos permanentes? Esta acción no se puede deshacer.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteAllPermanentDialogOpen(false)} color='secondary'>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirmDeleteAllPermanent}
            color='error'
            variant='contained'
            disabled={deleteAllPermanentDiscounts.isPending}
          >
            {deleteAllPermanentDiscounts.isPending ? 'Eliminando...' : 'Eliminar Todos'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteAllSeasonalDialogOpen} onClose={() => setDeleteAllSeasonalDialogOpen(false)}>
        <DialogTitle>Eliminar todos los descuentos temporales</DialogTitle>
        <DialogContent>
          <DialogContentText>
            ¿Estás seguro de que deseas eliminar TODOS los descuentos temporales? Esta acción no se puede deshacer.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteAllSeasonalDialogOpen(false)} color='secondary'>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirmDeleteAllSeasonal}
            color='error'
            variant='contained'
            disabled={deleteAllSeasonalDiscounts.isPending}
          >
            {deleteAllSeasonalDiscounts.isPending ? 'Eliminando...' : 'Eliminar Todos'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={open}
        onClose={handleSnackbarClose}
        autoHideDuration={3000}
        TransitionProps={{ onExited: handleExited }}
        key={messageInfo ? messageInfo.key : undefined}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          variant='filled'
          onClose={handleSnackbarClose}
          className='is-full shadow-xs items-center'
          severity={messageInfo?.severity || 'info'}
        >
          {messageInfo?.message}
        </Alert>
      </Snackbar>
    </Card>
  )
}

export default DiscountsListTable
