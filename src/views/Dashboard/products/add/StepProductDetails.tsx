import { useMemo, useState, useEffect } from 'react'

import Grid from '@mui/material/Grid2'
import Radio from '@mui/material/Radio'
import RadioGroup from '@mui/material/RadioGroup'
import FormControlLabel from '@mui/material/FormControlLabel'
import Button from '@mui/material/Button'
import FormLabel from '@mui/material/FormLabel'
import FormHelperText from '@mui/material/FormHelperText'
import MenuItem from '@mui/material/MenuItem'
import FormControl from '@mui/material/FormControl'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import CircularProgress from '@mui/material/CircularProgress'
import Autocomplete from '@mui/material/Autocomplete'
import TextField from '@mui/material/TextField'
import { toast } from 'react-toastify'
import { useForm, Controller, useWatch } from 'react-hook-form'

import DirectionalIcon from '@components/DirectionalIcon'
import CustomTextField from '@core/components/mui/TextField'
import { useCategories } from '@/hooks/useCategory'
import { useCreateProduct, useProduct, useUpdateProduct, useProductosSIN } from '@/hooks/useProducts'
import { useBrands, useCreateBrand } from '@/hooks/useVariants'
import type { ProductoSIN } from '@/types/api/product'

type Props = {
  activeStep: number
  handleNext: () => void
  handlePrev: () => void
  steps: { icon: string; title: string; subtitle: string }[]
  mode: 'create' | 'edit'
  productId?: string
  onProductCreated?: (id: string, name: string) => void
}

type FormValues = {
  genero: 'male' | 'female' | ''
  categoria: string
  subcategoria: string
  nombreProducto: string
  precio: string
  descripcion: string
  brand: string
  discount: string
  codigoProductoSin: ProductoSIN | null
}

type BrandFormValues = {
  name: string
  description: string
}

const StepProductDetails = ({ activeStep, handleNext, handlePrev, mode, productId, onProductCreated }: Props) => {
  const {
    control,
    reset,
    handleSubmit,
    setValue,
    formState: { errors }
  } = useForm<FormValues>({
    defaultValues: {
      genero: '',
      categoria: '',
      subcategoria: '',
      nombreProducto: '',
      precio: '',
      descripcion: '',
      brand: '',
      discount: '1',
      codigoProductoSin: null
    }
  })

  const {
    control: brandControl,
    reset: resetBrand,
    handleSubmit: handleBrandSubmit,
    formState: { errors: brandErrors }
  } = useForm<BrandFormValues>({
    defaultValues: {
      name: '',
      description: ''
    }
  })

  const [brandDialogOpen, setBrandDialogOpen] = useState(false)

  const selectedGender = useWatch({ control, name: 'genero' })
  const selectedCategory = useWatch({ control, name: 'categoria' })

  const { data: categoriesData, isLoading: categoriesLoading } = useCategories()

  const { data: brandsData, isLoading: brandsLoading } = useBrands()

  // Obtener productos SIN para facturación
  const { data: productosSINData, isLoading: productosSINLoading } = useProductosSIN()

  // Extraer lista de productos SIN (solo actividad 4771100)
  const productosSIN: ProductoSIN[] = useMemo(() => {
    if (productosSINData?.listas?.[0]?.payload?.RespuestaListaProductos?.listaCodigos) {
      // Filtrar por codigoActividad y eliminar duplicados
      const uniqueProducts = new Map<number, ProductoSIN>()

      productosSINData.listas[0].payload.RespuestaListaProductos.listaCodigos
        .filter(producto => producto.codigoActividad === '4771100')
        .forEach(producto => {
          if (!uniqueProducts.has(producto.codigoProducto)) {
            uniqueProducts.set(producto.codigoProducto, producto)
          }
        })

      return Array.from(uniqueProducts.values())
    }

    return []
  }, [productosSINData])

  const { data: productData, isLoading: productLoading } = useProduct(
    mode === 'edit' && productId ? parseInt(productId) : 0
  )

  const createProduct = useCreateProduct()
  const updateProduct = useUpdateProduct()
  const createBrand = useCreateBrand()

  useEffect(() => {
    if (productData && mode === 'edit' && categoriesData) {
      let foundCategory = null
      let foundSubcategory = null

      for (const cat of categoriesData) {
        const subcat = cat.subcategories?.find(sub => sub.id === productData.subcategory.id)

        if (subcat) {
          foundCategory = cat
          foundSubcategory = subcat
          break
        }
      }

      if (foundCategory && foundSubcategory) {
        setValue('genero', foundCategory.gender as 'male' | 'female')
        setValue('categoria', foundCategory.id.toString())
        setValue('subcategoria', foundSubcategory.id.toString())
      }

      setValue('nombreProducto', productData.name)
      setValue('precio', productData.price)
      setValue('descripcion', productData.description)
      setValue('brand', productData.brand?.toString() || '')
      setValue('discount', productData.discount?.toString() || '1')
    }
  }, [productData, mode, categoriesData, setValue])

  const filteredCategories = useMemo(() => {
    if (!categoriesData || !selectedGender) return []

    return categoriesData
      .filter((cat: any) => cat.gender === selectedGender && cat.enabled)
      .sort((a: any, b: any) => a.displayOrder - b.displayOrder)
  }, [categoriesData, selectedGender])

  const availableSubcategories = useMemo(() => {
    if (!selectedCategory) return []
    const category = filteredCategories.find((cat: any) => cat.id.toString() === selectedCategory)

    return category?.subcategories?.filter((sub: any) => sub.enabled) || []
  }, [filteredCategories, selectedCategory])

  const handleGenderChange = (gender: 'male' | 'female' | '') => {
    if (mode === 'create') {
      setValue('categoria', '')
      setValue('subcategoria', '')
    }
  }

  const handleCategoryChange = () => {
    if (mode === 'create') {
      setValue('subcategoria', '')
    }
  }

  const handleCreateBrand = async (brandData: BrandFormValues) => {
    try {
      const newBrand = await createBrand.mutateAsync(brandData)

      setValue('brand', newBrand.id.toString())
      resetBrand()
      setBrandDialogOpen(false)
      toast.success('Marca creada exitosamente')
    } catch (error) {
      toast.error('Error al crear la marca')
      console.error(error)
    }
  }

  const onSubmit = async (data: FormValues) => {
    try {
      const productData: any = {
        name: data.nombreProducto,
        description: data.descripcion,
        price: Number(data.precio).toFixed(2),
        enabled: true,
        subcategory: parseInt(data.subcategoria),
        codigoProductoSin: data.codigoProductoSin?.codigoProducto,
        unidadMedida: 57
      }

      if (data.brand) {
        productData.brand = parseInt(data.brand)
      }

      if (mode === 'create') {
        const newProduct = await createProduct.mutateAsync(productData)

        toast.success('Producto registrado exitosamente')
        onProductCreated?.(newProduct.id.toString(), newProduct.name)
        handleNext()
      } else {
        await updateProduct.mutateAsync({
          id: parseInt(productId!),
          data: productData
        })
        toast.success('Producto actualizado exitosamente')
        handleNext()
      }
    } catch (error) {
      toast.error(mode === 'create' ? 'Error al guardar el producto' : 'Error al actualizar el producto')
      console.error(error)
    }
  }

  const isCreateMode = mode === 'create'
  const isSubmitting = createProduct.isPending || updateProduct.isPending || createBrand.isPending

  if (mode === 'edit' && (productLoading || !productData)) {
    return (
      <div className='flex justify-center items-center py-8'>
        <CircularProgress />
      </div>
    )
  }

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)}>
        <Grid container spacing={6}>
          <Grid size={{ xs: 12 }}>
            <FormControl error={Boolean(errors.genero)}>
              <FormLabel>Género</FormLabel>
              <Controller
                name='genero'
                control={control}
                rules={{ required: true }}
                render={({ field }) => (
                  <RadioGroup
                    row
                    {...field}
                    name='genero-group'
                    onChange={e => {
                      field.onChange(e)
                      handleGenderChange(e.target.value as 'male' | 'female')
                    }}
                  >
                    <FormControlLabel value='male' control={<Radio />} label='Hombres' />
                    <FormControlLabel value='female' control={<Radio />} label='Mujeres' />
                  </RadioGroup>
                )}
              />
              {errors.genero && <FormHelperText error>Este campo es requerido.</FormHelperText>}
            </FormControl>
          </Grid>

          <Grid size={{ xs: 12, sm: 6 }}>
            <Controller
              name='categoria'
              control={control}
              rules={{ required: true }}
              render={({ field }) => (
                <CustomTextField
                  select
                  fullWidth
                  label='Categoría'
                  {...field}
                  onChange={e => {
                    field.onChange(e)
                    handleCategoryChange()
                  }}
                  error={Boolean(errors.categoria)}
                  disabled={!selectedGender || categoriesLoading}
                >
                  <MenuItem value=''>
                    {!selectedGender ? 'Selecciona un género primero' : 'Seleccionar Categoría'}
                  </MenuItem>
                  {filteredCategories.map((category: any) => (
                    <MenuItem key={category.id} value={category.id.toString()}>
                      {category.name}
                    </MenuItem>
                  ))}
                </CustomTextField>
              )}
            />
            {errors.categoria && <FormHelperText error>Este campo es requerido.</FormHelperText>}
          </Grid>

          <Grid size={{ xs: 12, sm: 6 }}>
            <Controller
              name='subcategoria'
              control={control}
              rules={{ required: true }}
              render={({ field }) => (
                <CustomTextField
                  select
                  fullWidth
                  label='Subcategoría'
                  {...field}
                  error={Boolean(errors.subcategoria)}
                  disabled={!selectedCategory || availableSubcategories.length === 0}
                >
                  <MenuItem value=''>
                    {!selectedCategory
                      ? 'Selecciona una categoría primero'
                      : availableSubcategories.length === 0
                        ? 'No hay subcategorías disponibles'
                        : 'Seleccionar Subcategoría'}
                  </MenuItem>
                  {availableSubcategories.map((subcategory: any) => (
                    <MenuItem key={subcategory.id} value={subcategory.id.toString()}>
                      {subcategory.name}
                    </MenuItem>
                  ))}
                </CustomTextField>
              )}
            />
            {errors.subcategoria && <FormHelperText error>Este campo es requerido.</FormHelperText>}
          </Grid>

          <Grid size={{ xs: 12, sm: 8 }}>
            <Controller
              name='nombreProducto'
              control={control}
              rules={{ required: true }}
              render={({ field }) => (
                <CustomTextField
                  {...field}
                  fullWidth
                  label='Nombre del Producto'
                  placeholder='Ingresa el nombre del producto'
                  {...(errors.nombreProducto && { error: true, helperText: 'Este campo es requerido.' })}
                />
              )}
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 4 }}>
            <Controller
              name='precio'
              control={control}
              rules={{ required: true }}
              render={({ field }) => (
                <CustomTextField
                  {...field}
                  fullWidth
                  label='Precio'
                  placeholder='0.00'
                  type='number'
                  inputProps={{ step: '0.01', min: '0' }}
                  {...(errors.precio && { error: true, helperText: 'Este campo es requerido.' })}
                />
              )}
            />
          </Grid>

          <Grid size={{ xs: 12 }}>
            <Controller
              name='descripcion'
              control={control}
              rules={{ required: true }}
              render={({ field }) => (
                <CustomTextField
                  {...field}
                  rows={4}
                  fullWidth
                  multiline
                  label='Descripción'
                  placeholder='Descripción detallada del producto'
                  {...(errors.descripcion && { error: true, helperText: 'Este campo es requerido.' })}
                />
              )}
            />
          </Grid>

          <Grid size={{ xs: 12 }}>
            <Controller
              name='codigoProductoSin'
              control={control}
              rules={{ required: true }}
              render={({ field: { onChange, value, ...field } }) => (
                <Autocomplete
                  {...field}
                  value={value}
                  onChange={(_, newValue) => onChange(newValue)}
                  options={productosSIN}
                  loading={productosSINLoading}
                  getOptionLabel={option => option.descripcionProducto}
                  isOptionEqualToValue={(option, value) => option.codigoProducto === value?.codigoProducto}
                  renderInput={params => (
                    <TextField
                      {...params}
                      label='Producto SIN *'
                      placeholder='Buscar producto SIN...'
                      error={Boolean(errors.codigoProductoSin)}
                      helperText={
                        errors.codigoProductoSin
                          ? 'Este campo es requerido.'
                          : 'Seleccione el producto para facturación'
                      }
                      slotProps={{
                        input: {
                          ...params.InputProps,
                          endAdornment: (
                            <>
                              {productosSINLoading ? <CircularProgress color='inherit' size={20} /> : null}
                              {params.InputProps.endAdornment}
                            </>
                          )
                        }
                      }}
                    />
                  )}
                  renderOption={(props, option) => (
                    <li {...props} key={option.codigoProducto}>
                      {option.descripcionProducto}
                    </li>
                  )}
                  noOptionsText='No se encontraron productos'
                  loadingText='Cargando productos SIN...'
                />
              )}
            />
          </Grid>

          <Grid size={{ xs: 12 }}>
            <div className='flex items-center justify-between'>
              <Button
                variant='tonal'
                color='secondary'
                disabled={activeStep === 0}
                onClick={handlePrev}
                type='button'
                startIcon={<DirectionalIcon ltrIconClass='tabler-arrow-left' rtlIconClass='tabler-arrow-right' />}
              >
                Anterior
              </Button>

              <div className='flex gap-4'>
                <Button variant='tonal' color='secondary' type='button' onClick={() => reset()} disabled={isSubmitting}>
                  Limpiar
                </Button>

                <Button
                  variant='contained'
                  color='primary'
                  type='submit'
                  disabled={isSubmitting}
                  endIcon={
                    isSubmitting ? (
                      <CircularProgress size={16} />
                    ) : isCreateMode ? (
                      <DirectionalIcon ltrIconClass='tabler-arrow-right' rtlIconClass='tabler-arrow-left' />
                    ) : (
                      <DirectionalIcon ltrIconClass='tabler-arrow-right' rtlIconClass='tabler-arrow-left' />
                    )
                  }
                >
                  {isSubmitting
                    ? isCreateMode
                      ? 'Guardando...'
                      : 'Actualizando...'
                    : isCreateMode
                      ? 'Registrar y Continuar'
                      : 'Actualizar y Continuar'}
                </Button>
              </div>
            </div>
          </Grid>
        </Grid>
      </form>

      <Dialog open={brandDialogOpen} onClose={() => setBrandDialogOpen(false)} maxWidth='sm' fullWidth>
        <DialogTitle>Nueva Marca</DialogTitle>
        <form onSubmit={handleBrandSubmit(handleCreateBrand)}>
          <DialogContent>
            <Grid container spacing={3} sx={{ mt: 1 }}>
              <Grid size={{ xs: 12 }}>
                <Controller
                  name='name'
                  control={brandControl}
                  rules={{ required: true }}
                  render={({ field }) => (
                    <CustomTextField
                      {...field}
                      fullWidth
                      label='Nombre de la Marca'
                      placeholder='Ej: Nike, Adidas'
                      {...(brandErrors.name && { error: true, helperText: 'Este campo es requerido.' })}
                    />
                  )}
                />
              </Grid>

              <Grid size={{ xs: 12 }}>
                <Controller
                  name='description'
                  control={brandControl}
                  rules={{ required: true }}
                  render={({ field }) => (
                    <CustomTextField
                      {...field}
                      fullWidth
                      multiline
                      rows={3}
                      label='Descripción'
                      placeholder='Descripción de la marca'
                      {...(brandErrors.description && { error: true, helperText: 'Este campo es requerido.' })}
                    />
                  )}
                />
              </Grid>
            </Grid>
          </DialogContent>

          <DialogActions>
            <Button onClick={() => setBrandDialogOpen(false)} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button
              type='submit'
              variant='contained'
              disabled={isSubmitting}
              startIcon={isSubmitting ? <CircularProgress size={16} /> : <i className='tabler-plus' />}
            >
              {isSubmitting ? 'Creando...' : 'Crear Marca'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </>
  )
}

export default StepProductDetails
