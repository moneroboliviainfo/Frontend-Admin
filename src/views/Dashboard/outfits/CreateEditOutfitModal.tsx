'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'

import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardMedia from '@mui/material/CardMedia'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import Divider from '@mui/material/Divider'
import Badge from '@mui/material/Badge'
import IconButton from '@mui/material/IconButton'
import Radio from '@mui/material/Radio'
import RadioGroup from '@mui/material/RadioGroup'
import FormControlLabel from '@mui/material/FormControlLabel'
import FormControl from '@mui/material/FormControl'
import FormLabel from '@mui/material/FormLabel'
import type { TextFieldProps } from '@mui/material/TextField'

import CustomTextField from '@core/components/mui/TextField'
import { useVariants, useCreateOutfit, useUpdateOutfit, useDeleteMultimedia, useOutfitById } from '@/hooks/useOutfits'
import { outfitService } from '@/services/outfitService'

import type { Outfit, ProductColor, OutfitProductColor, Gender } from '@/types/api/outfits'

interface CreateEditOutfitModalProps {
  open: boolean
  onClose: () => void
  outfit?: Outfit | null
  onSuccess: (message: string) => void
  onError: (message: string) => void
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

const CreateEditOutfitModal = ({ open, onClose, outfit, onSuccess, onError }: CreateEditOutfitModalProps) => {
  const [outfitName, setOutfitName] = useState('')
  const [selectedProductColors, setSelectedProductColors] = useState<number[]>([])
  const [selectedProductColorsCache, setSelectedProductColorsCache] = useState<ProductColor[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [videoFiles, setVideoFiles] = useState<File[]>([])
  const [images, setImages] = useState<string[]>([])
  const [videos, setVideos] = useState<string[]>([])
  const [imagePreviews, setImagePreviews] = useState<string[]>([])
  const [isDraggingImage, setIsDraggingImage] = useState(false)
  const [gender, setGender] = useState<Gender>('male')
  const [urlsToDelete, setUrlsToDelete] = useState<string[]>([])

  const createOutfit = useCreateOutfit()
  const updateOutfit = useUpdateOutfit()
  const deleteMultimedia = useDeleteMultimedia()

  const { data: outfitDetails } = useOutfitById(outfit?.id || 0)
  const fullOutfit = outfit?.id ? outfitDetails : outfit

  const queryParams = useMemo(
    () => ({
      limit: 8,
      page: 1,
      search: searchTerm
    }),
    [searchTerm]
  )

  const { data: variantsData, isLoading } = useVariants(queryParams)

  const productColors = useMemo(() => {
    return variantsData?.data || []
  }, [variantsData])

  const validateImageFile = useCallback(
    (file: File): boolean => {
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']

      if (!validTypes.includes(file.type.toLowerCase())) {
        onError('Solo se permiten imágenes en formato JPG, JPEG, PNG o WEBP')

        return false
      }

      if (file.size > 2 * 1024 * 1024) {
        onError('La imagen no debe superar los 2MB')

        return false
      }

      return true
    },
    [onError]
  )

  const validateVideoFile = useCallback(
    (file: File): boolean => {
      if (file.type !== 'video/mp4') {
        onError('Solo se permiten videos en formato MP4')

        return false
      }

      if (file.size > 3 * 1024 * 1024) {
        onError('El video no debe superar los 3MB')

        return false
      }

      return true
    },
    [onError]
  )

  useEffect(() => {
    if (open) {
      if (fullOutfit) {
        setOutfitName(fullOutfit.name)
        const productColorIds = fullOutfit.productColors?.map(pc => pc.id) || []

        setSelectedProductColors(productColorIds)
        setImages(fullOutfit.images || [])
        setVideos(fullOutfit.videos || [])
        setImagePreviews(fullOutfit.images || [])
        setImageFiles([])
        setVideoFiles([])
        setGender(fullOutfit.gender)
        setSelectedProductColorsCache([])
      } else {
        setOutfitName('')
        setSelectedProductColors([])
        setImages([])
        setVideos([])
        setImagePreviews([])
        setImageFiles([])
        setVideoFiles([])
        setGender('male')
        setSelectedProductColorsCache([])
      }

      setSearchTerm('')
      setUrlsToDelete([])
    }
  }, [open, fullOutfit])

  const handleToggleProductColor = useCallback(
    (productColorId: number, productColorData?: ProductColor) => {
      setSelectedProductColors(prev => {
        if (prev.includes(productColorId)) {
          return prev.filter(id => id !== productColorId)
        } else {
          return [...prev, productColorId]
        }
      })

      if (productColorData && !selectedProductColors.includes(productColorId)) {
        setSelectedProductColorsCache(prev => {
          if (!prev.find(pc => pc.id === productColorId)) {
            return [...prev, productColorData]
          }

          return prev
        })
      }
    },
    [selectedProductColors]
  )

  const handleRemoveProductColor = useCallback((productColorId: number) => {
    setSelectedProductColors(prev => prev.filter(id => id !== productColorId))
  }, [])

  const isProductColorSelected = useCallback(
    (productColorId: number) => {
      return selectedProductColors.includes(productColorId)
    },
    [selectedProductColors]
  )

  const selectedProductColorsDetails = useMemo(() => {
    const allAvailable: (ProductColor | OutfitProductColor)[] = [
      ...productColors,
      ...selectedProductColorsCache
    ]

    if (fullOutfit) {
      const outfitProductColors = fullOutfit.productColors || []

      allAvailable.push(...outfitProductColors)
    }

    const unique = allAvailable.filter((pc, index, self) => self.findIndex(p => p.id === pc.id) === index)

    return unique.filter(pc => selectedProductColors.includes(pc.id))
  }, [productColors, selectedProductColors, fullOutfit, selectedProductColorsCache])

  const handleImageChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || [])
      const validFiles = files.filter(file => validateImageFile(file))

      if (validFiles.length > 0) {
        setImageFiles(prev => [...prev, ...validFiles])

        validFiles.forEach(file => {
          const reader = new FileReader()

          reader.onloadend = () => {
            setImagePreviews(prev => [...prev, reader.result as string])
          }

          reader.readAsDataURL(file)
        })
      }
    },
    [validateImageFile]
  )

  const handleImageDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingImage(true)
  }, [])

  const handleImageDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingImage(false)
  }, [])

  const handleImageDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleImageDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDraggingImage(false)

      const files = Array.from(e.dataTransfer.files)
      const validFiles = files.filter(file => validateImageFile(file))

      if (validFiles.length > 0) {
        setImageFiles(prev => [...prev, ...validFiles])

        validFiles.forEach(file => {
          const reader = new FileReader()

          reader.onloadend = () => {
            setImagePreviews(prev => [...prev, reader.result as string])
          }

          reader.readAsDataURL(file)
        })
      }
    },
    [validateImageFile]
  )

  const handleRemoveImage = useCallback(
    (index: number) => {
      const totalImages = images.length
      const isServerImage = index < totalImages

      if (isServerImage) {
        const imageUrl = images[index]

        setUrlsToDelete(prev => [...prev, imageUrl])
        setImages(prev => prev.filter((_, i) => i !== index))
        setImagePreviews(prev => prev.filter((_, i) => i !== index))
      } else {
        const localIndex = index - totalImages

        setImageFiles(prev => prev.filter((_, i) => i !== localIndex))
        setImagePreviews(prev => prev.filter((_, i) => i !== index))
      }
    },
    [images]
  )

  const handleVideoChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || [])
      const validFiles = files.filter(file => validateVideoFile(file))

      if (validFiles.length > 0) {
        setVideoFiles(prev => [...prev, ...validFiles])
      }
    },
    [validateVideoFile]
  )

  const handleRemoveVideo = useCallback(
    (index: number) => {
      const totalVideos = videos.length
      const isServerVideo = index < totalVideos

      if (isServerVideo) {
        const videoUrl = videos[index]

        setUrlsToDelete(prev => [...prev, videoUrl])
        setVideos(prev => prev.filter((_, i) => i !== index))
      } else {
        const localIndex = index - totalVideos

        setVideoFiles(prev => prev.filter((_, i) => i !== localIndex))
      }
    },
    [videos]
  )

  const handleSubmit = useCallback(async () => {
    if (!outfitName.trim()) {
      onError('Debe ingresar un nombre para el outfit')

      return
    }

    if (selectedProductColors.length < 1) {
      onError('Debe seleccionar al menos 1 prenda')

      return
    }

    try {
      // Subir nuevas imágenes
      const uploadedImageUrls = [...images]

      for (const imageFile of imageFiles) {
        const result = await outfitService.uploadImage(imageFile)

        uploadedImageUrls.push(result.url)
      }

      // Subir nuevos videos
      const uploadedVideoUrls = [...videos]

      for (const videoFile of videoFiles) {
        const result = await outfitService.uploadVideo(videoFile)

        uploadedVideoUrls.push(result.url)
      }

      if (fullOutfit) {
        await updateOutfit.mutateAsync({
          id: fullOutfit.id,
          data: {
            name: outfitName,
            productColorIds: selectedProductColors,
            images: uploadedImageUrls.length > 0 ? uploadedImageUrls : [],
            videos: uploadedVideoUrls.length > 0 ? uploadedVideoUrls : [],
            gender: gender
          }
        })
        onSuccess('Outfit actualizado correctamente')
      } else {
        await createOutfit.mutateAsync({
          name: outfitName,
          productColorIds: selectedProductColors,
          images: uploadedImageUrls.length > 0 ? uploadedImageUrls : [],
          videos: uploadedVideoUrls.length > 0 ? uploadedVideoUrls : [],
          gender: gender
        })
        onSuccess('Outfit creado correctamente')
      }

      if (urlsToDelete.length > 0) {
        try {
          await deleteMultimedia.mutateAsync(urlsToDelete)
          setUrlsToDelete([])
        } catch (error) {
          console.error('Error deleting old files:', error)
        }
      }

      onClose()
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Error al guardar el outfit')
    }
  }, [
    outfitName,
    selectedProductColors,
    images,
    videos,
    imageFiles,
    videoFiles,
    gender,
    fullOutfit,
    createOutfit,
    updateOutfit,
    deleteMultimedia,
    urlsToDelete,
    onSuccess,
    onError,
    onClose
  ])

  return (
    <Dialog open={open} onClose={onClose} maxWidth='lg' fullWidth>
      <DialogTitle>{fullOutfit ? 'Editar Outfit' : 'Crear Nuevo Outfit'}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 2 }}>
          <CustomTextField
            label='Nombre del Outfit'
            value={outfitName}
            onChange={e => setOutfitName(e.target.value)}
            fullWidth
            required
          />

          <FormControl component='fieldset'>
            <FormLabel component='legend' sx={{ fontWeight: 600, mb: 1 }}>
              Género *
            </FormLabel>
            <RadioGroup row value={gender} onChange={e => setGender(e.target.value as Gender)}>
              <FormControlLabel value='male' control={<Radio />} label='Masculino' />
              <FormControlLabel value='female' control={<Radio />} label='Femenino' />
            </RadioGroup>
          </FormControl>

          <Box>
            <Typography variant='subtitle1' sx={{ mb: 2, fontWeight: 600 }}>
              Imágenes del Outfit
            </Typography>
            <Box
              onDragEnter={handleImageDragEnter}
              onDragOver={handleImageDragOver}
              onDragLeave={handleImageDragLeave}
              onDrop={handleImageDrop}
              sx={{
                border: '2px dashed',
                borderColor: isDraggingImage ? 'primary.main' : 'divider',
                borderRadius: 1,
                p: 3,
                textAlign: 'center',
                backgroundColor: isDraggingImage ? 'action.hover' : 'background.paper',
                transition: 'all 0.2s',
                cursor: 'pointer',
                mb: 2
              }}
            >
              <label htmlFor='outfit-images-upload' style={{ cursor: 'pointer', display: 'block' }}>
                <input
                  id='outfit-images-upload'
                  type='file'
                  accept='image/jpeg,image/jpg,image/png,image/webp'
                  multiple
                  style={{ display: 'none' }}
                  onChange={handleImageChange}
                />
                <Box sx={{ py: 2 }}>
                  <i className='tabler-upload' style={{ fontSize: '2rem', opacity: 0.5 }} />
                  <Typography variant='body2' sx={{ mt: 1 }}>
                    Arrastra imágenes aquí o haz clic para seleccionar
                  </Typography>
                  <Typography variant='caption' color='text.secondary'>
                    2MB cada una - JPG, JPEG, PNG, WEBP
                  </Typography>
                </Box>
              </label>
            </Box>
            {imagePreviews.length > 0 && (
              <Grid container spacing={2}>
                {imagePreviews.map((preview, index) => (
                  <Grid item xs={12} sm={4} key={index}>
                    <Card sx={{ position: 'relative' }}>
                      <CardMedia component='img' height='150' image={preview} alt={`Imagen ${index + 1}`} />
                    <IconButton
                      onClick={() => handleRemoveImage(index)}
                      sx={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        backgroundColor: 'background.paper'
                      }}
                      size='small'
                    >
                      <i className='tabler-x' />
                    </IconButton>
                  </Card>
                  </Grid>
                ))}
              </Grid>
            )}
          </Box>

          <Box>
            <Typography variant='subtitle1' sx={{ mb: 2, fontWeight: 600 }}>
              Videos del Outfit
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {videos.map((videoUrl, index) => (
                <Box
                  key={`server-video-${index}`}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    p: 1.5,
                    bgcolor: 'primary.lighter',
                    borderRadius: 1,
                    border: '1px solid',
                    borderColor: 'primary.main'
                  }}
                >
                  <i className='tabler-video' style={{ fontSize: '1.25rem' }} />
                  <Typography variant='body2' sx={{ flex: 1, fontWeight: 500, color: 'primary.main' }}>
                    Video {index + 1} (MP4)
                  </Typography>
                  <IconButton size='small' onClick={() => handleRemoveVideo(index)} color='error'>
                    <i className='tabler-trash' />
                  </IconButton>
                </Box>
              ))}
              {videoFiles.map((file, index) => (
                <Box
                  key={`local-video-${index}`}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    p: 1.5,
                    bgcolor: 'success.lighter',
                    borderRadius: 1,
                    border: '1px solid',
                    borderColor: 'success.main'
                  }}
                >
                  <i className='tabler-video' style={{ fontSize: '1.25rem', color: 'green' }} />
                  <Typography variant='body2' sx={{ flex: 1, fontWeight: 500 }}>
                    {file.name}
                  </Typography>
                  <IconButton size='small' onClick={() => handleRemoveVideo(videos.length + index)} color='error'>
                    <i className='tabler-x' />
                  </IconButton>
                </Box>
              ))}
              <Button
                variant='outlined'
                component='label'
                size='small'
                startIcon={<i className='tabler-upload' />}
                sx={{ alignSelf: 'flex-start' }}
              >
                Seleccionar Video MP4
                <input type='file' accept='video/mp4' multiple hidden onChange={handleVideoChange} />
              </Button>
            </Box>
          </Box>

          <Divider />

          <Box>
            <Typography variant='subtitle1' sx={{ mb: 2, fontWeight: 600 }}>
              Buscar Prendas
            </Typography>

            {selectedProductColors.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography variant='body2' sx={{ mb: 1, fontWeight: 500 }}>
                  Seleccionadas ({selectedProductColors.length}):
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                  {selectedProductColorsDetails.map(pc => {
                    const productName = pc.product?.name || 'Producto'
                    const colorName = pc.color?.name || 'Color'

                    return (
                      <Chip
                        key={pc.id}
                        label={`${productName} - ${colorName}`}
                        onDelete={() => handleRemoveProductColor(pc.id)}
                        color='primary'
                        variant='filled'
                        size='small'
                      />
                    )
                  })}
                </Box>
              </Box>
            )}

            <DebouncedInput
              value={searchTerm}
              onChange={value => setSearchTerm(String(value))}
              placeholder='Buscar por nombre de producto...'
              fullWidth
              size='small'
            />
          </Box>

          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : productColors.length === 0 ? (
            <Alert severity='info'>No se encontraron productos</Alert>
          ) : (
            <Grid container spacing={2}>
              {productColors.map(productColor => {
                const isSelected = isProductColorSelected(productColor.id)
                const imageUrl = productColor.multimedia?.[0] || ''

                return (
                  <Grid item xs={12} sm={6} md={4} lg={3} key={productColor.id}>
                    <Card
                      sx={{
                        cursor: 'pointer',
                        border: isSelected ? 2 : 1,
                        borderColor: isSelected ? 'primary.main' : 'divider',
                        transition: 'all 0.2s',
                        '&:hover': {
                          transform: 'translateY(-4px)',
                          boxShadow: 4
                        }
                      }}
                      onClick={() => handleToggleProductColor(productColor.id, productColor)}
                    >
                      <Badge
                        badgeContent={isSelected ? <i className='tabler-check' /> : null}
                        color='primary'
                        sx={{
                          width: '100%',
                          '& .MuiBadge-badge': {
                            top: 10,
                            right: 10
                          }
                        }}
                      >
                        <CardMedia
                          component='img'
                          height='200'
                          image={imageUrl || '/images/placeholder.png'}
                          alt={productColor.product.name}
                          sx={{ objectFit: 'cover', height: 200 }}
                        />
                      </Badge>
                      <CardContent>
                        <Typography variant='subtitle2' noWrap sx={{ fontWeight: 600 }}>
                          {productColor.product.name}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 0.5, mt: 1, alignItems: 'center' }}>
                          <Chip
                            label={productColor.color.name}
                            size='small'
                            sx={{
                              backgroundColor: productColor.color.code,
                              color: 'white'
                            }}
                          />
                          <Typography variant='caption' color='text.secondary'>
                            ${productColor.product.price}
                          </Typography>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                )
              })}
            </Grid>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color='secondary'>
          Cancelar
        </Button>
        <Button
          onClick={handleSubmit}
          color='primary'
          variant='contained'
          disabled={createOutfit.isPending || updateOutfit.isPending}
        >
          {createOutfit.isPending || updateOutfit.isPending ? (
            <CircularProgress size={20} />
          ) : outfit ? (
            'Actualizar Outfit'
          ) : (
            'Crear Outfit'
          )}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default CreateEditOutfitModal
