import { useRef, useState, useEffect } from 'react'

import Grid from '@mui/material/Grid2'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import CircularProgress from '@mui/material/CircularProgress'
import LinearProgress from '@mui/material/LinearProgress'
import { toast } from 'react-toastify'

import type { MediaFile } from '@/schemas/variant.schema'

type Props = {
  mediaFiles: MediaFile[]
  onFilesChange: (files: MediaFile[]) => void
  error?: string | null
  onErrorChange: (error: string | null) => void
  onDeleteExisting?: (url: string) => void
  onUploadingChange?: (isUploading: boolean) => void
}

const VariantMediaUploader = ({
  mediaFiles,
  onFilesChange,
  error,
  onErrorChange,
  onDeleteExisting,
  onUploadingChange
}: Props) => {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [uploadingFiles, setUploadingFiles] = useState<Map<string, number>>(new Map())

  const isUploading = uploadingFiles.size > 0

  useEffect(() => {
    onUploadingChange?.(isUploading)
  }, [isUploading, onUploadingChange])

  const MAX_FILE_SIZE_MB = 3
  const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024

  const isValidFileType = (file: File): boolean => {
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'video/mp4', 'application/pdf']

    return validTypes.includes(file.type)
  }

  const isValidFileSize = (file: File): boolean => {
    return file.size <= MAX_FILE_SIZE_BYTES
  }

  const processFiles = async (files: FileList) => {
    const validFiles: File[] = []
    const invalidFiles: string[] = []
    const oversizedFiles: string[] = []

    Array.from(files).forEach(file => {
      if (!isValidFileType(file)) {
        invalidFiles.push(file.name)
      } else if (!isValidFileSize(file)) {
        const sizeMB = (file.size / (1024 * 1024)).toFixed(2)

        oversizedFiles.push(`${file.name} (${sizeMB}MB)`)
      } else {
        validFiles.push(file)
      }
    })

    if (invalidFiles.length > 0) {
      onErrorChange(`Formato no válido: ${invalidFiles.join(', ')}. Solo se permiten JPG, JPEG, PNG, WEBP, MP4, PDF`)
      toast.error(`${invalidFiles.length} archivo(s) con formato no válido`)
    }

    if (oversizedFiles.length > 0) {
      onErrorChange(`Archivo(s) muy grande(s): ${oversizedFiles.join(', ')}. Máximo ${MAX_FILE_SIZE_MB}MB`)
      toast.error(`${oversizedFiles.length} archivo(s) exceden el límite de ${MAX_FILE_SIZE_MB}MB`)
    }

    if (validFiles.length > 0) {
      const tempIds = validFiles.map(() => Date.now() + Math.random().toString())

      setUploadingFiles(prev => {
        const newMap = new Map(prev)

        tempIds.forEach(id => newMap.set(id, 0))

        return newMap
      })

      const newFiles: MediaFile[] = []

      for (let i = 0; i < validFiles.length; i++) {
        const file = validFiles[i]
        const tempId = tempIds[i]

        for (let progress = 0; progress <= 100; progress += 20) {
          setUploadingFiles(prev => {
            const newMap = new Map(prev)

            newMap.set(tempId, progress)

            return newMap
          })
          await new Promise(resolve => setTimeout(resolve, 50))
        }

        const mediaFile: MediaFile = {
          id: tempId,
          file,
          url: URL.createObjectURL(file),
          type: file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'document',
          name: file.name,
          source: 'new' as const
        }

        newFiles.push(mediaFile)

        setUploadingFiles(prev => {
          const newMap = new Map(prev)

          newMap.delete(tempId)

          return newMap
        })
      }

      onFilesChange([...mediaFiles, ...newFiles])
      onErrorChange(null)
      toast.success(`${newFiles.length} archivo(s) agregado(s)`)
    }
  }

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    const files = e.dataTransfer.files

    if (files.length > 0) {
      processFiles(files)
    }
  }

  const handleFileInputClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files

    if (files && files.length > 0) {
      processFiles(files)
    }

    e.target.value = ''
  }

  const handleRemoveFile = (id: string) => {
    const fileToRemove = mediaFiles.find(f => f.id === id)

    if (fileToRemove) {
      if (fileToRemove.source === 'existing' && onDeleteExisting) {
        onDeleteExisting(fileToRemove.url)
      }

      if (fileToRemove.source === 'new' && fileToRemove.file) {
        URL.revokeObjectURL(fileToRemove.url)
      }
    }

    onFilesChange(mediaFiles.filter(f => f.id !== id))
    onErrorChange(null)
    toast.success('Archivo eliminado')
  }

  const imageAndVideoFiles = mediaFiles.filter(f => f.type !== 'document')
  const documentFiles = mediaFiles.filter(f => f.type === 'document')

  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant='subtitle2' gutterBottom sx={{ color: error ? 'error.main' : 'text.primary' }}>
        Archivos Multimedia
      </Typography>

      <Box
        sx={{
          border: '2px dashed',
          borderColor: error ? 'error.main' : isUploading ? 'primary.main' : isDragging ? 'primary.main' : 'divider',
          borderRadius: 1,
          p: 3,
          textAlign: 'center',
          backgroundColor: error
            ? 'rgba(211, 47, 47, 0.04)'
            : isUploading
              ? 'rgba(25, 118, 210, 0.08)'
              : isDragging
                ? 'action.hover'
                : 'background.paper',
          cursor: isUploading ? 'not-allowed' : 'pointer',
          minHeight: '120px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          position: 'relative',
          pointerEvents: isUploading ? 'none' : 'auto'
        }}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={handleFileInputClick}
      >
        {isUploading ? (
          <>
            <CircularProgress size={32} sx={{ mb: 1 }} />
            <Typography variant='body2' color='primary' sx={{ mt: 1, fontWeight: 600 }}>
              Procesando {uploadingFiles.size} archivo(s)...
            </Typography>
            <Typography variant='caption' color='text.secondary'>
              Por favor espera, no cierres esta ventana
            </Typography>
            <LinearProgress
              sx={{ mt: 2, width: '80%', mx: 'auto', borderRadius: 1 }}
              variant='indeterminate'
            />
          </>
        ) : (
          <>
            <i
              className='tabler-cloud-upload'
              style={{
                fontSize: '2rem',
                color: error ? 'var(--mui-palette-error-main)' : 'var(--mui-palette-primary-main)'
              }}
            />
            <Typography variant='body2' color={error ? 'error' : 'text.secondary'} sx={{ mt: 1 }}>
              {isDragging ? 'Suelta aquí los archivos' : 'Arrastra imágenes/videos o haz clic para seleccionar'}
            </Typography>
            <Typography variant='caption' color={error ? 'error' : 'text.secondary'}>
              Formatos: JPG, JPEG, PNG, WEBP, MP4, PDF (máx. 3MB por archivo)
            </Typography>
          </>
        )}
      </Box>

      <input
        ref={fileInputRef}
        type='file'
        multiple
        accept='image/*,video/*,.pdf'
        style={{ display: 'none' }}
        onChange={handleFileInputChange}
      />

      {error && <Typography sx={{ display: 'block', mt: 1, color: 'error.main' }}>{error}</Typography>}

      {mediaFiles.length > 0 && (
        <Box sx={{ mt: 2 }}>
          {imageAndVideoFiles.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography variant='caption' color='primary' sx={{ mb: 1, display: 'block', fontWeight: 600 }}>
                🖼️ IMÁGENES Y VIDEOS ({imageAndVideoFiles.length})
              </Typography>
              <Grid container spacing={2}>
                {imageAndVideoFiles.map(file => (
                  <Grid size={{ xs: 6, sm: 4, md: 3 }} key={file.id}>
                    <Box
                      sx={{
                        position: 'relative',
                        width: '100%',
                        height: '120px',
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 1,
                        overflow: 'hidden'
                      }}
                    >
                      {file.type === 'image' ? (
                        <img
                          src={file.url}
                          alt={file.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <>
                          <video src={file.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          <Box
                            sx={{
                              position: 'absolute',
                              top: '50%',
                              left: '50%',
                              transform: 'translate(-50%, -50%)',
                              width: 40,
                              height: 40,
                              borderRadius: '50%',
                              backgroundColor: 'rgba(0,0,0,0.6)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              pointerEvents: 'none'
                            }}
                          >
                            <i className='tabler-player-play-filled' style={{ fontSize: '20px', color: 'white' }} />
                          </Box>
                          <Box
                            sx={{
                              position: 'absolute',
                              bottom: 4,
                              left: 4,
                              backgroundColor: 'rgba(0,0,0,0.7)',
                              borderRadius: '4px',
                              px: 0.75,
                              py: 0.25,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 0.5
                            }}
                          >
                            <i className='tabler-video' style={{ fontSize: '12px', color: 'white' }} />
                            <Typography variant='caption' sx={{ color: 'white', fontSize: '10px', fontWeight: 600 }}>
                              VIDEO
                            </Typography>
                          </Box>
                        </>
                      )}
                      <IconButton
                        size='small'
                        color='error'
                        onClick={() => handleRemoveFile(file.id)}
                        sx={{
                          position: 'absolute',
                          top: 4,
                          right: 4,
                          backgroundColor: 'rgba(0,0,0,0.7)',
                          color: 'white',
                          '&:hover': { backgroundColor: 'rgba(0,0,0,0.9)' }
                        }}
                      >
                        <i className='tabler-x' style={{ fontSize: '16px' }} />
                      </IconButton>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}

          {documentFiles.length > 0 && (
            <Box>
              <Typography variant='caption' color='secondary' sx={{ mb: 1, display: 'block', fontWeight: 600 }}>
                📄 DOCUMENTOS PDF ({documentFiles.length})
              </Typography>
              <Grid container spacing={2}>
                {documentFiles.map(file => (
                  <Grid size={{ xs: 6, sm: 4, md: 3 }} key={file.id}>
                    <Box
                      sx={{
                        position: 'relative',
                        width: '100%',
                        height: '100px',
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 1,
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: 'rgba(255,0,0,0.05)'
                      }}
                    >
                      <i className='tabler-file-type-pdf' style={{ fontSize: '2.5rem', color: '#d32f2f' }} />
                      <Typography variant='caption' sx={{ mt: 1, textAlign: 'center', px: 1 }}>
                        {file.name.length > 20 ? file.name.substring(0, 20) + '...' : file.name}
                      </Typography>
                      <IconButton
                        size='small'
                        color='error'
                        onClick={() => handleRemoveFile(file.id)}
                        sx={{
                          position: 'absolute',
                          top: 4,
                          right: 4,
                          backgroundColor: 'rgba(0,0,0,0.7)',
                          color: 'white',
                          '&:hover': { backgroundColor: 'rgba(0,0,0,0.9)' }
                        }}
                      >
                        <i className='tabler-x' style={{ fontSize: '16px' }} />
                      </IconButton>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}
        </Box>
      )}
    </Box>
  )
}

export default VariantMediaUploader
