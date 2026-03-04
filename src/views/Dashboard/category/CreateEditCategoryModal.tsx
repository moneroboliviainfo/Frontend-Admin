'use client'

import { useState, useEffect, useCallback } from 'react'

import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import MenuItem from '@mui/material/MenuItem'
import Card from '@mui/material/Card'
import CardMedia from '@mui/material/CardMedia'
import IconButton from '@mui/material/IconButton'
import Skeleton from '@mui/material/Skeleton'
import Backdrop from '@mui/material/Backdrop'
import Fade from '@mui/material/Fade'
import LinearProgress from '@mui/material/LinearProgress'

import CustomTextField from '@core/components/mui/TextField'
import {
  useCategory,
  useCreateCategory,
  useCreateSubcategory,
  useUpdateCategory,
  useUpdateSubcategory,
  useDeleteSubcategory,
  useDeleteMultimedia
} from '@/hooks/useCategory'
import { categoryService } from '@/services/categoryService'
import type { Gender } from '@/types/api/category'

interface CreateEditCategoryModalProps {
  open: boolean
  onClose: () => void
  categoryId?: number | null
  mode?: 'create' | 'edit'
  onSuccess: (message: string) => void
  onError: (message: string) => void
}

type SubcategoryData = {
  id?: number
  name: string
  enabled: boolean
  videos?: string[]
  videoFiles?: File[]
  videoPreview?: string
  isNew?: boolean
  isDeleted?: boolean
}

const CreateEditCategoryModal = ({
  open,
  onClose,
  categoryId,
  mode = 'create',
  onSuccess,
  onError
}: CreateEditCategoryModalProps) => {
  const [name, setName] = useState('')
  const [gender, setGender] = useState<Gender>('male')
  const [image, setImage] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string>('')
  const [isDragging, setIsDragging] = useState(false)
  const [subcategorias, setSubcategorias] = useState<SubcategoryData[]>([{ name: '', enabled: true, isNew: true }])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [savingMessage, setSavingMessage] = useState('')
  const [isProcessingImage, setIsProcessingImage] = useState(false)
  const [processingVideoIndex, setProcessingVideoIndex] = useState<number | null>(null)
  const [playingVideoIndex, setPlayingVideoIndex] = useState<number | null>(null)
  const [urlsToDelete, setUrlsToDelete] = useState<string[]>([])

  const isEditMode = mode === 'edit' && categoryId

  const createCategory = useCreateCategory()
  const createSubcategory = useCreateSubcategory()
  const updateCategory = useUpdateCategory()
  const updateSubcategory = useUpdateSubcategory()
  const deleteSubcategory = useDeleteSubcategory()
  const deleteMultimedia = useDeleteMultimedia()

  const {
    data: category,
    isLoading: isLoadingCategory,
    error: categoryError
  } = useCategory(isEditMode ? categoryId : 0)

  useEffect(() => {
    if (open && isEditMode && category) {
      setName(category.name)
      setGender(category.gender)
      setImage(category.image || '')
      setImagePreview(category.image || '')
      setImageFile(null)
      setPlayingVideoIndex(null)

      const subcatsWithFlags =
        category.subcategories?.map(sub => ({
          id: sub.id,
          name: sub.name,
          enabled: sub.enabled,
          videos: sub.videos || [],
          videoPreview: sub.videos && sub.videos.length > 0 ? sub.videos[0] : undefined,
          isNew: false,
          isDeleted: false
        })) || []

      setSubcategorias(subcatsWithFlags.length > 0 ? subcatsWithFlags : [{ name: '', enabled: true, isNew: true }])
    } else if (open && !isEditMode) {
      setName('')
      setGender('male')
      setImage('')
      setImagePreview('')
      setImageFile(null)
      setSubcategorias([{ name: '', enabled: true, isNew: true }])
      setPlayingVideoIndex(null)
    }
  }, [open, isEditMode, category])

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

  const processImageFile = useCallback(
    (file: File) => {
      if (!validateImageFile(file)) return

      setIsProcessingImage(true)
      setImageFile(file)
      const reader = new FileReader()

      reader.onloadend = () => {
        setImagePreview(reader.result as string)
        setIsProcessingImage(false)
      }

      reader.onerror = () => {
        setIsProcessingImage(false)
        onError('Error al procesar la imagen')
      }

      reader.readAsDataURL(file)
    },
    [validateImageFile, onError]
  )

  const handleImageChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]

      if (file) {
        processImageFile(file)
      }
    },
    [processImageFile]
  )

  const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)

      const file = e.dataTransfer.files?.[0]

      if (file) {
        processImageFile(file)
      }
    },
    [processImageFile]
  )

  const handleRemoveImage = useCallback(() => {
    if (image && !imageFile) {
      setUrlsToDelete(prev => [...prev, image])
    }

    setImageFile(null)
    setImagePreview('')
    setImage('')
  }, [image, imageFile])

  const handleVideoChange = useCallback(
    (index: number, event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]

      if (file && validateVideoFile(file)) {
        setProcessingVideoIndex(index)

        const oldPreview = subcategorias[index].videoPreview

        if (oldPreview) {
          URL.revokeObjectURL(oldPreview)
        }

        setTimeout(() => {
          const nuevasSubcategorias = [...subcategorias]
          const videoPreviewUrl = URL.createObjectURL(file)

          nuevasSubcategorias[index] = {
            ...nuevasSubcategorias[index],
            videoFiles: [file],
            videoPreview: videoPreviewUrl
          }
          setSubcategorias(nuevasSubcategorias)
          setProcessingVideoIndex(null)
        }, 300)
      }
    },
    [subcategorias, validateVideoFile]
  )

  const handleRemoveVideo = useCallback(
    (index: number) => {
      const subcategoria = subcategorias[index]

      if (subcategoria.videoPreview) {
        URL.revokeObjectURL(subcategoria.videoPreview)
      }

      if (subcategoria.videos && subcategoria.videos.length > 0 && !subcategoria.videoFiles) {
        setUrlsToDelete(prev => [...prev, ...subcategoria.videos!])
      }

      const nuevasSubcategorias = [...subcategorias]

      nuevasSubcategorias[index] = {
        ...nuevasSubcategorias[index],
        videoFiles: undefined,
        videoPreview: undefined,
        videos: []
      }
      setSubcategorias(nuevasSubcategorias)
    },
    [subcategorias]
  )

  const añadirSubcategoria = () => {
    setSubcategorias([...subcategorias, { name: '', enabled: true, isNew: true }])
  }

  const actualizarSubcategoria = (index: number, campo: string, valor: string | boolean) => {
    const nuevasSubcategorias = [...subcategorias]

    if (campo === 'name') {
      nuevasSubcategorias[index].name = valor as string
    } else {
      nuevasSubcategorias[index] = { ...nuevasSubcategorias[index], [campo]: valor }
    }

    setSubcategorias(nuevasSubcategorias)
  }

  const eliminarSubcategoria = (index: number) => {
    const subcategoria = subcategorias[index]

    if (subcategoria.isNew) {
      if (subcategorias.filter(sub => !sub.isDeleted).length > 1) {
        const nuevasSubcategorias = subcategorias.filter((_, i) => i !== index)

        setSubcategorias(nuevasSubcategorias)
      }
    } else {
      const nuevasSubcategorias = [...subcategorias]

      nuevasSubcategorias[index] = { ...subcategoria, isDeleted: true }
      setSubcategorias(nuevasSubcategorias)
    }
  }

  const restaurarSubcategoria = (index: number) => {
    const nuevasSubcategorias = [...subcategorias]

    nuevasSubcategorias[index] = { ...nuevasSubcategorias[index], isDeleted: false }
    setSubcategorias(nuevasSubcategorias)
  }

  const handleSubmit = async () => {
    if (!name.trim()) {
      onError('El nombre de la categoría es obligatorio')

      return
    }

    setIsSubmitting(true)
    setSavingMessage('Preparando archivos...')

    try {
      let uploadedImageUrl = image

      if (imageFile) {
        setSavingMessage('Subiendo imagen de categoría...')

        if (image) {
          try {
            await deleteMultimedia.mutateAsync([image])
          } catch (error) {
            console.error('Error deleting old image:', error)
          }
        }

        const uploadResult = await categoryService.uploadImage(imageFile)

        uploadedImageUrl = uploadResult.url
      }

      if (isEditMode && categoryId) {
        setSavingMessage('Actualizando categoría...')

        await updateCategory.mutateAsync({
          id: categoryId,
          data: {
            name,
            gender,
            image: uploadedImageUrl || undefined
          }
        })

        setSavingMessage('Procesando subcategorías...')
        const subcategoriesPromises = []

        for (const subcat of subcategorias) {
          if (subcat.isDeleted && subcat.id) {
            subcategoriesPromises.push(deleteSubcategory.mutateAsync({ id: subcat.id, categoryId }))
          } else if (subcat.isNew && subcat.name.trim()) {
            let videoUrls: string[] = []

            if (subcat.videoFiles && subcat.videoFiles.length > 0) {
              setSavingMessage(`Subiendo video de "${subcat.name}"...`)
              const uploadResult = await categoryService.uploadVideo(subcat.videoFiles[0])

              videoUrls = [uploadResult.url]
            }

            subcategoriesPromises.push(
              createSubcategory.mutateAsync({
                name: subcat.name,
                enabled: subcat.enabled,
                videos: videoUrls.length > 0 ? videoUrls : undefined,
                category: categoryId
              })
            )
          } else if (!subcat.isNew && !subcat.isDeleted && subcat.id && subcat.name.trim()) {
            let videoUrls = subcat.videos || []

            if (subcat.videoFiles && subcat.videoFiles.length > 0) {
              setSavingMessage(`Subiendo video de "${subcat.name}"...`)

              if (subcat.videos && subcat.videos.length > 0) {
                try {
                  await deleteMultimedia.mutateAsync(subcat.videos)
                } catch (error) {
                  console.error('Error deleting old video:', error)
                }
              }

              const uploadResult = await categoryService.uploadVideo(subcat.videoFiles[0])

              videoUrls = [uploadResult.url]
            }

            subcategoriesPromises.push(
              updateSubcategory.mutateAsync({
                id: subcat.id,
                data: {
                  name: subcat.name,
                  enabled: subcat.enabled,
                  videos: videoUrls.length > 0 ? videoUrls : [],
                  category: categoryId
                }
              })
            )
          }
        }

        setSavingMessage('Guardando subcategorías...')
        await Promise.all(subcategoriesPromises)
        onSuccess('Categoría actualizada exitosamente')
      } else {
        setSavingMessage('Creando categoría...')
        const subcategoriasValidas = subcategorias.filter(sub => sub.name.trim() !== '')

        const newCategory = await createCategory.mutateAsync({
          name,
          gender,
          image: uploadedImageUrl || undefined
        })

        if (subcategoriasValidas.length > 0) {
          setSavingMessage('Creando subcategorías...')

          const subcategoryPromises = subcategoriasValidas.map(async subcatData => {
            let videoUrls: string[] = []

            if (subcatData.videoFiles && subcatData.videoFiles.length > 0) {
              setSavingMessage(`Subiendo video de "${subcatData.name}"...`)
              const uploadResult = await categoryService.uploadVideo(subcatData.videoFiles[0])

              videoUrls = [uploadResult.url]
            }

            return createSubcategory.mutateAsync({
              name: subcatData.name,
              enabled: subcatData.enabled,
              videos: videoUrls.length > 0 ? videoUrls : undefined,
              category: newCategory.id
            })
          })

          await Promise.all(subcategoryPromises)
        }

        onSuccess('Categoría creada exitosamente')
      }

      if (urlsToDelete.length > 0) {
        setSavingMessage('Limpiando archivos antiguos...')

        try {
          await deleteMultimedia.mutateAsync(urlsToDelete)
        } catch (error) {
          console.error('Error deleting old files:', error)
        }
      }

      handleReset()
    } catch (error) {
      console.error('Error creating/updating category:', error)

      const apiError = error as any

      if (apiError?.code === 'ECONNABORTED' || apiError?.message?.includes('timeout')) {
        onError('La conexión tardó demasiado. Verifica tu internet e intenta de nuevo.')

        return
      }

      if (apiError?.code === 'ERR_NETWORK' || apiError?.message?.includes('Network Error')) {
        onError('Error de conexión. Verifica tu internet e inténtalo de nuevo.')

        return
      }

      let errorMessage = isEditMode ? 'Error al actualizar la categoría' : 'Error al crear la categoría'

      if (error instanceof Error) {
        errorMessage = error.message
      }

      if (error && typeof error === 'object' && 'response' in error) {
        if (apiError.response?.data?.message) {
          errorMessage = apiError.response.data.message
        } else if (apiError.response?.data?.error) {
          errorMessage = apiError.response.data.error
        }
      }

      onError(errorMessage)
    } finally {
      setIsSubmitting(false)
      setSavingMessage('')
    }
  }

  const handleReset = () => {
    subcategorias.forEach(sub => {
      if (sub.videoPreview) {
        URL.revokeObjectURL(sub.videoPreview)
      }
    })

    onClose()
    setName('')
    setGender('male')
    setImage('')
    setImagePreview('')
    setImageFile(null)
    setSubcategorias([{ name: '', enabled: true, isNew: true }])
    setPlayingVideoIndex(null)
    setUrlsToDelete([])
  }

  const isProcessingFiles = isProcessingImage || processingVideoIndex !== null

  return (
    <>
      <Backdrop
        sx={{
          zIndex: theme => theme.zIndex.modal + 1,
          backdropFilter: 'blur(4px)',
          backgroundColor: 'rgba(0, 0, 0, 0.5)'
        }}
        open={isSubmitting}
      >
        <Fade in={isSubmitting}>
          <Card
            sx={{
              minWidth: 380,
              maxWidth: 420,
              boxShadow: 'var(--mui-customShadows-xl)',
              border: '1px solid',
              borderColor: 'divider'
            }}
          >
            <Box sx={{ p: 6, textAlign: 'center' }}>
              <Box
                sx={{
                  width: 80,
                  height: 80,
                  borderRadius: '50%',
                  backgroundColor: 'primary.lighter',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mx: 'auto',
                  mb: 4
                }}
              >
                <CircularProgress color='primary' size={40} thickness={4} />
              </Box>

              <Typography variant='h5' sx={{ mb: 1, fontWeight: 600 }}>
                {isEditMode ? 'Actualizando Categoría' : 'Creando Categoría'}
              </Typography>

              <Typography variant='body2' color='text.secondary' sx={{ mb: 4 }}>
                {savingMessage || 'Procesando...'}
              </Typography>

              <LinearProgress
                sx={{
                  height: 6,
                  borderRadius: 3,
                  mb: 3,
                  backgroundColor: 'action.hover',
                  '& .MuiLinearProgress-bar': {
                    borderRadius: 3
                  }
                }}
              />

              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                <i className='tabler-info-circle' style={{ fontSize: '16px', color: 'var(--mui-palette-text-secondary)' }} />
                <Typography variant='caption' color='text.secondary'>
                  Por favor no cierres esta ventana
                </Typography>
              </Box>
            </Box>
          </Card>
        </Fade>
      </Backdrop>

      <Dialog open={open} onClose={handleReset} maxWidth='md' fullWidth>
        <DialogTitle>{isEditMode ? 'Editar Categoría' : 'Registrar Categoría'}</DialogTitle>
      <DialogContent>
        {isEditMode && isLoadingCategory ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            <Skeleton variant='rectangular' height={56} />
            <Skeleton variant='rectangular' height={56} />
            <Skeleton variant='rectangular' height={200} />
          </Box>
        ) : isEditMode && categoryError ? (
          <Alert severity='error' sx={{ mt: 2 }}>
            Error al cargar la categoría: {categoryError instanceof Error ? categoryError.message : 'Error desconocido'}
          </Alert>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 2 }}>
            <CustomTextField
              select
              fullWidth
              label='Género'
              value={gender}
              onChange={e => setGender(e.target.value as Gender)}
            >
              <MenuItem value='male'>Hombres</MenuItem>
              <MenuItem value='female'>Mujeres</MenuItem>
            </CustomTextField>

            <CustomTextField
              fullWidth
              label='Nombre de la categoría'
              placeholder='Ingrese el nombre de la categoría'
              value={name}
              onChange={e => setName(e.target.value)}
            />

            <Box>
              <Typography variant='subtitle2' sx={{ mb: 1 }}>
                Imagen de la categoría (opcional)
              </Typography>
              <Box
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                sx={{
                  border: '2px dashed',
                  borderColor: isProcessingImage
                    ? 'primary.main'
                    : isDragging
                      ? 'primary.main'
                      : 'divider',
                  borderRadius: 1,
                  p: 3,
                  textAlign: 'center',
                  backgroundColor: isProcessingImage
                    ? 'rgba(25, 118, 210, 0.08)'
                    : isDragging
                      ? 'action.hover'
                      : 'background.paper',
                  transition: 'all 0.2s',
                  cursor: isProcessingImage ? 'not-allowed' : 'pointer',
                  pointerEvents: isProcessingImage ? 'none' : 'auto'
                }}
              >
                {isProcessingImage ? (
                  <Box sx={{ py: 4 }}>
                    <CircularProgress size={32} sx={{ mb: 1 }} />
                    <Typography variant='body2' color='primary' sx={{ mt: 1, fontWeight: 600 }}>
                      Procesando imagen...
                    </Typography>
                    <Typography variant='caption' color='text.secondary'>
                      Por favor espera
                    </Typography>
                  </Box>
                ) : imagePreview ? (
                  <Card sx={{ maxWidth: 300, margin: '0 auto', position: 'relative' }}>
                    <CardMedia component='img' height='200' image={imagePreview} alt='Vista previa' />
                    <IconButton
                      onClick={handleRemoveImage}
                      sx={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        backgroundColor: 'background.paper'
                      }}
                    >
                      <i className='tabler-x' />
                    </IconButton>
                  </Card>
                ) : (
                  <label htmlFor='category-image-upload' style={{ cursor: 'pointer', display: 'block' }}>
                    <input
                      id='category-image-upload'
                      type='file'
                      accept='image/jpeg,image/jpg,image/png,image/webp'
                      style={{ display: 'none' }}
                      onChange={handleImageChange}
                    />
                    <Box sx={{ py: 4 }}>
                      <i className='tabler-upload' style={{ fontSize: '3rem', opacity: 0.5 }} />
                      <Typography variant='body1' sx={{ mt: 2 }}>
                        Arrastra una imagen aquí o haz clic para seleccionar
                      </Typography>
                      <Typography variant='caption' color='text.secondary'>
                        Máximo 2MB - Formatos: JPG, JPEG, PNG, WEBP
                      </Typography>
                    </Box>
                  </label>
                )}
              </Box>
            </Box>

            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant='h6'>Subcategorías</Typography>
                <Button variant='contained' size='small' onClick={añadirSubcategoria}>
                  Añadir Subcategoría
                </Button>
              </Box>

              {!isEditMode && (
                <Typography variant='body2' color='text.secondary' sx={{ mb: 2 }}>
                  (Las subcategorías vacías no serán añadidas)
                </Typography>
              )}

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {subcategorias
                  .filter(sub => !sub.isDeleted)
                  .map((subcategoria, index) => (
                    <Card key={subcategoria.id || `new-${index}`} variant='outlined' sx={{ p: 2 }}>
                      <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                        <CustomTextField
                          fullWidth
                          label={`Subcategoría ${index + 1}`}
                          placeholder='Nombre de la subcategoría'
                          value={subcategoria.name}
                          onChange={e => actualizarSubcategoria(index, 'name', e.target.value)}
                        />
                        {(subcategorias.filter(sub => !sub.isDeleted).length > 1 || isEditMode) && (
                          <IconButton size='small' onClick={() => eliminarSubcategoria(index)} color='error'>
                            <i className='tabler-trash' />
                          </IconButton>
                        )}
                      </Box>

                      <Box sx={{ mt: 2 }}>
                        <Typography variant='caption' color='text.secondary' sx={{ mb: 1, display: 'block' }}>
                          Video (opcional, máximo 3MB, solo MP4)
                        </Typography>
                        {(subcategoria.videoFiles && subcategoria.videoFiles.length > 0) ||
                        (subcategoria.videos && subcategoria.videos.length > 0) ? (
                          <Box
                            sx={{
                              position: 'relative',
                              width: '100%',
                              maxWidth: 280,
                              borderRadius: 2,
                              overflow: 'hidden',
                              border: '1px solid',
                              borderColor: 'divider',
                              bgcolor: 'black'
                            }}
                          >
                            {playingVideoIndex === index ? (
                              <video
                                src={subcategoria.videoPreview || subcategoria.videos?.[0]}
                                controls
                                autoPlay
                                style={{
                                  width: '100%',
                                  height: 160,
                                  objectFit: 'contain',
                                  backgroundColor: 'black'
                                }}
                                onEnded={() => setPlayingVideoIndex(null)}
                              />
                            ) : (
                              <Box
                                onClick={() => setPlayingVideoIndex(index)}
                                sx={{
                                  position: 'relative',
                                  width: '100%',
                                  height: 160,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  bgcolor: 'grey.900',
                                  '&:hover .play-overlay': {
                                    transform: 'translate(-50%, -50%) scale(1.1)',
                                    bgcolor: 'primary.main'
                                  }
                                }}
                              >
                                <video
                                  src={subcategoria.videoPreview || subcategoria.videos?.[0]}
                                  style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'contain',
                                    opacity: 0.7
                                  }}
                                  muted
                                />
                                <Box
                                  className='play-overlay'
                                  sx={{
                                    position: 'absolute',
                                    top: '50%',
                                    left: '50%',
                                    transform: 'translate(-50%, -50%)',
                                    width: 56,
                                    height: 56,
                                    borderRadius: '50%',
                                    bgcolor: 'rgba(0,0,0,0.7)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'all 0.2s ease',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                                  }}
                                >
                                  <i
                                    className='tabler-player-play-filled'
                                    style={{ fontSize: '24px', color: 'white', marginLeft: 3 }}
                                  />
                                </Box>
                                <Box
                                  sx={{
                                    position: 'absolute',
                                    bottom: 8,
                                    left: 8,
                                    bgcolor: 'rgba(0,0,0,0.8)',
                                    borderRadius: 1,
                                    px: 1,
                                    py: 0.5,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 0.5
                                  }}
                                >
                                  <i className='tabler-video' style={{ fontSize: '14px', color: 'white' }} />
                                  <Typography variant='caption' sx={{ color: 'white', fontWeight: 600 }}>
                                    VIDEO
                                  </Typography>
                                </Box>
                              </Box>
                            )}
                            <Box
                              sx={{
                                p: 1.5,
                                bgcolor: 'background.paper',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between'
                              }}
                            >
                              <Typography
                                variant='caption'
                                sx={{
                                  flex: 1,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  fontWeight: 500
                                }}
                              >
                                {subcategoria.videoFiles?.[0]?.name || 'Video cargado'}
                              </Typography>
                              <IconButton
                                size='small'
                                onClick={() => {
                                  setPlayingVideoIndex(null)
                                  handleRemoveVideo(index)
                                }}
                                color='error'
                                sx={{ ml: 1 }}
                              >
                                <i className='tabler-trash' style={{ fontSize: '16px' }} />
                              </IconButton>
                            </Box>
                          </Box>
                        ) : processingVideoIndex === index ? (
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1.5,
                              p: 1.5,
                              borderRadius: 1,
                              bgcolor: 'rgba(25, 118, 210, 0.08)',
                              border: '1px solid',
                              borderColor: 'primary.main'
                            }}
                          >
                            <CircularProgress size={20} />
                            <Typography variant='body2' color='primary' sx={{ fontWeight: 500 }}>
                              Procesando video...
                            </Typography>
                          </Box>
                        ) : (
                          <Button
                            variant='outlined'
                            component='label'
                            size='small'
                            startIcon={<i className='tabler-upload' />}
                          >
                            Seleccionar Video MP4
                            <input type='file' accept='video/mp4' hidden onChange={e => handleVideoChange(index, e)} />
                          </Button>
                        )}
                      </Box>
                    </Card>
                  ))}

                {isEditMode && subcategorias.filter(sub => sub.isDeleted).length > 0 && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant='subtitle2' color='text.secondary' sx={{ mb: 1 }}>
                      Subcategorías eliminadas (se eliminarán al guardar):
                    </Typography>
                    {subcategorias
                      .filter(sub => sub.isDeleted)
                      .map((subcategoria, index) => (
                        <Box
                          key={subcategoria.id}
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            p: 2,
                            bgcolor: 'action.hover',
                            borderRadius: 1,
                            mb: 1
                          }}
                        >
                          <Typography variant='body2' sx={{ textDecoration: 'line-through', color: 'text.disabled' }}>
                            {subcategoria.name}
                          </Typography>
                          <Button
                            size='small'
                            onClick={() => restaurarSubcategoria(subcategorias.findIndex(s => s === subcategoria))}
                          >
                            Restaurar
                          </Button>
                        </Box>
                      ))}
                  </Box>
                )}
              </Box>
            </Box>
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button
          onClick={handleReset}
          variant='outlined'
          color='secondary'
          disabled={isSubmitting || isProcessingFiles}
        >
          Cancelar
        </Button>
        <Button
          onClick={handleSubmit}
          variant='contained'
          disabled={isSubmitting || isProcessingFiles || !name.trim()}
          startIcon={
            isSubmitting || isProcessingFiles ? <CircularProgress size={16} /> : undefined
          }
        >
          {isProcessingFiles
            ? 'Procesando archivos...'
            : isSubmitting
              ? isEditMode
                ? 'Actualizando...'
                : 'Registrando...'
              : isEditMode
                ? 'Actualizar'
                : 'Registrar'}
        </Button>
      </DialogActions>
      </Dialog>
    </>
  )
}

export default CreateEditCategoryModal
