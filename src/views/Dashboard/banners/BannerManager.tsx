'use client'

import { useState, useEffect, useCallback } from 'react'
import type { SyntheticEvent } from 'react'

import {
  Card,
  CardContent,
  Typography,
  Button,
  Box,
  Alert,
  CircularProgress,
  Snackbar,
  Grid2 as Grid,
  Chip
} from '@mui/material'
import { useDropzone } from 'react-dropzone'

import { useBanners, useUpdateBanner } from '@/hooks/useBanner'
import { bannerService } from '@/services/bannerService'
import type { Banner } from '@/types/api/banner'

export type SnackbarMessage = {
  key: number
  message: string
  severity: 'success' | 'error' | 'info' | 'warning'
}

const BannerManager = () => {
  const [open, setOpen] = useState<boolean>(false)
  const [snackPack, setSnackPack] = useState<SnackbarMessage[]>([])
  const [messageInfo, setMessageInfo] = useState<SnackbarMessage | undefined>(undefined)
  const [uploadingBannerId, setUploadingBannerId] = useState<number | null>(null)

  const { data: banners, isLoading, error } = useBanners()
  const updateBanner = useUpdateBanner()

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

  const handleVideoUpload = async (bannerId: number, file: File, currentVideo: string) => {
    setUploadingBannerId(bannerId)

    try {
      // 1. Subir el nuevo video
      const { url } = await bannerService.uploadVideo(file)

      // 2. Actualizar el banner con el nuevo video
      await updateBanner.mutateAsync({
        id: bannerId,
        data: { video: url }
      })

      // 3. Eliminar el video anterior
      if (currentVideo) {
        await bannerService.deleteMultimedia([currentVideo])
      }

      showMessage('Video actualizado exitosamente', 'success')
    } catch (err: any) {
      showMessage(err?.response?.data?.message || 'Error al actualizar el video', 'error')
    } finally {
      setUploadingBannerId(null)
    }
  }

  const getBannerLabel = (banner: Banner) => {
    const typeLabel = banner.type === 'desktop' ? 'Desktop' : 'Mobile'
    const genderLabel = banner.gender === 'male' ? 'Masculino' : 'Femenino'

    return `${typeLabel} - ${genderLabel}`
  }

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    )
  }

  if (error) {
    return (
      <Alert severity='error' sx={{ m: 3 }}>
        Error al cargar los banners
      </Alert>
    )
  }

  return (
    <>
      <Card>
        <CardContent>
          <Grid container spacing={4}>
            {banners
              ?.sort((a, b) => {
                const genderOrder = { male: 0, female: 1 }
                const typeOrder = { desktop: 0, mobile: 1 }

                if (a.gender !== b.gender) {
                  return genderOrder[a.gender] - genderOrder[b.gender]
                }

                return typeOrder[a.type] - typeOrder[b.type]
              })
              .map(banner => (
                <Grid size={{ xs: 12, md: 6 }} key={banner.id}>
                  <BannerCard
                    banner={banner}
                    onVideoUpload={handleVideoUpload}
                    isUploading={uploadingBannerId === banner.id}
                    getBannerLabel={getBannerLabel}
                  />
                </Grid>
              ))}
          </Grid>
        </CardContent>
      </Card>

      <Snackbar
        open={open}
        autoHideDuration={3000}
        onClose={handleSnackbarClose}
        TransitionProps={{ onExited: handleExited }}
        key={messageInfo ? messageInfo.key : undefined}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          variant='filled'
          onClose={handleSnackbarClose}
          severity={messageInfo?.severity || 'info'}
          sx={{ width: '100%' }}
        >
          {messageInfo?.message}
        </Alert>
      </Snackbar>
    </>
  )
}

interface BannerCardProps {
  banner: Banner
  onVideoUpload: (bannerId: number, file: File, currentVideo: string) => Promise<void>
  isUploading: boolean
  getBannerLabel: (banner: Banner) => string
}

const BannerCard = ({ banner, onVideoUpload, isUploading, getBannerLabel }: BannerCardProps) => {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return

      const file = acceptedFiles[0]

      // Validar tamaño (5MB máximo)
      if (file.size > 5 * 1024 * 1024) {
        alert('El archivo es demasiado grande. Máximo 5MB.')

        return
      }

      // Validar tipo
      if (file.type !== 'video/mp4') {
        alert('Solo se permiten archivos MP4.')

        return
      }

      onVideoUpload(banner.id, file, banner.video)
    },
    [banner, onVideoUpload]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'video/mp4': ['.mp4']
    },
    maxFiles: 1,
    multiple: false,
    disabled: isUploading
  })

  return (
    <Card variant='outlined' sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant='h6' sx={{ fontWeight: 600 }}>
            {getBannerLabel(banner)}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Chip label={banner.type} color='primary' size='small' />
            <Chip
              label={banner.gender === 'male' ? 'Masculino' : 'Femenino'}
              color={banner.gender === 'male' ? 'info' : 'secondary'}
              size='small'
            />
          </Box>
        </Box>

        {/* Video status indicator */}
        <Box
          sx={{
            mb: 2,
            p: 2,
            bgcolor: banner.video ? 'success.lighter' : 'action.hover',
            borderRadius: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 2
          }}
        >
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              bgcolor: banner.video ? 'success.main' : 'action.disabled',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <i
              className={banner.video ? 'tabler-video-filled' : 'tabler-video-off'}
              style={{ fontSize: '20px', color: 'white' }}
            />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant='body2' sx={{ fontWeight: 600 }}>
              {banner.video ? 'Video cargado' : 'Sin video'}
            </Typography>
            {banner.video && (
              <Typography variant='caption' color='text.secondary' sx={{ display: 'block' }}>
                {banner.video.split('/').pop()}
              </Typography>
            )}
          </Box>
        </Box>

        {/* Drag and drop zone */}
        <Box
          {...getRootProps()}
          sx={{
            border: '2px dashed',
            borderColor: isDragActive ? 'primary.main' : 'divider',
            borderRadius: 2,
            p: 3,
            textAlign: 'center',
            cursor: isUploading ? 'not-allowed' : 'pointer',
            bgcolor: isDragActive ? 'action.hover' : 'transparent',
            transition: 'all 0.2s',
            '&:hover': {
              borderColor: isUploading ? 'divider' : 'primary.main',
              bgcolor: isUploading ? 'transparent' : 'action.hover'
            }
          }}
        >
          <input {...getInputProps()} />
          {isUploading ? (
            <Box>
              <CircularProgress size={32} sx={{ mb: 2 }} />
              <Typography variant='body2' color='text.secondary'>
                Subiendo video...
              </Typography>
            </Box>
          ) : (
            <Box>
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  bgcolor: 'primary.main',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mx: 'auto',
                  mb: 2
                }}
              >
                <i className='tabler-upload' style={{ fontSize: '24px', color: 'white' }} />
              </Box>
              <Typography variant='body2' sx={{ mb: 1 }}>
                {isDragActive ? 'Suelta el archivo aquí' : 'Arrastra un video MP4 aquí o haz clic'}
              </Typography>
              <Typography variant='caption' color='text.secondary'>
                Máximo 5MB
              </Typography>
            </Box>
          )}
        </Box>
      </CardContent>
    </Card>
  )
}

export default BannerManager
