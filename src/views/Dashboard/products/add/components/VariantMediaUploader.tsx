import { useRef, useState } from 'react'

import Grid from '@mui/material/Grid2'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import { toast } from 'react-toastify'

import type { MediaFile } from '@/schemas/variant.schema'

type Props = {
  mediaFiles: MediaFile[]
  onFilesChange: (files: MediaFile[]) => void
  error?: string | null
  onErrorChange: (error: string | null) => void
  onDeleteExisting?: (url: string) => void
}

const VariantMediaUploader = ({ mediaFiles, onFilesChange, error, onErrorChange, onDeleteExisting }: Props) => {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  const MAX_FILE_SIZE_MB = 3
  const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024

  const isValidFileType = (file: File): boolean => {
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'video/mp4', 'application/pdf']

    return validTypes.includes(file.type)
  }

  const isValidFileSize = (file: File): boolean => {
    return file.size <= MAX_FILE_SIZE_BYTES
  }

  const processFiles = (files: FileList) => {
    const newFiles: MediaFile[] = []
    const invalidFiles: string[] = []
    const oversizedFiles: string[] = []

    Array.from(files).forEach(file => {
      if (!isValidFileType(file)) {
        invalidFiles.push(file.name)
      } else if (!isValidFileSize(file)) {
        const sizeMB = (file.size / (1024 * 1024)).toFixed(2)

        oversizedFiles.push(`${file.name} (${sizeMB}MB)`)
      } else {
        const mediaFile: MediaFile = {
          id: Date.now() + Math.random().toString(),
          file,
          url: URL.createObjectURL(file),
          type: file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'document',
          name: file.name,
          source: 'new' as const
        }

        newFiles.push(mediaFile)
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

    if (newFiles.length > 0) {
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
          borderColor: error ? 'error.main' : isDragging ? 'primary.main' : 'divider',
          borderRadius: 1,
          p: 3,
          textAlign: 'center',
          backgroundColor: error ? 'rgba(211, 47, 47, 0.04)' : isDragging ? 'action.hover' : 'background.paper',
          cursor: 'pointer',
          minHeight: '120px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center'
        }}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={handleFileInputClick}
      >
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
                        <video src={file.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
