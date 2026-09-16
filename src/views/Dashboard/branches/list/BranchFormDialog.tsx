import { useCallback, useEffect, useState } from 'react'
import type { SyntheticEvent } from 'react'

import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import Snackbar from '@mui/material/Snackbar'

import { z } from 'zod'

import CustomTextField from '@core/components/mui/TextField'
import { useCreateBranch } from '@/hooks/useBranchAdmin'

type SnackbarMessage = {
  key: number
  message: string
  severity: 'success' | 'error' | 'info' | 'warning'
}

type Props = {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

const createBranchSchema = z.object({
  name: z.string().min(3, 'El nombre debe tener al menos 3 caracteres')
})

const BranchFormDialog = ({ open, onClose, onSuccess }: Props) => {
  const [name, setName] = useState('')
  const [error, setError] = useState<string | undefined>(undefined)
  const [snackbarOpen, setSnackbarOpen] = useState(false)
  const [snackPack, setSnackPack] = useState<SnackbarMessage[]>([])
  const [messageInfo, setMessageInfo] = useState<SnackbarMessage | undefined>(undefined)

  const createBranch = useCreateBranch()

  useEffect(() => {
    if (snackPack.length && !messageInfo) {
      setSnackbarOpen(true)
      setSnackPack(prev => prev.slice(1))
      setMessageInfo({ ...snackPack[0] })
    } else if (snackPack.length && messageInfo && snackbarOpen) {
      setSnackbarOpen(false)
    }
  }, [snackPack, messageInfo, snackbarOpen])

  const showMessage = useCallback((message: string, severity: SnackbarMessage['severity']) => {
    setSnackPack(prev => [...prev, { message, severity, key: new Date().getTime() }])
  }, [])

  const handleSnackbarClose = (_?: SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') return
    setSnackbarOpen(false)
  }

  const handleClose = () => {
    setName('')
    setError(undefined)
    onClose()
  }

  const handleSubmit = async () => {
    const result = createBranchSchema.safeParse({ name })

    if (!result.success) {
      setError(result.error.errors[0]?.message)

      return
    }

    try {
      await createBranch.mutateAsync({ name })

      showMessage('Sucursal creada exitosamente', 'success')
      onSuccess()
      setTimeout(handleClose, 1200)
    } catch (err: any) {
      showMessage(err?.response?.data?.message || 'Error al crear la sucursal', 'error')
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth='sm' fullWidth>
      <DialogTitle>Nueva Sucursal</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4, mt: 2 }}>
          <CustomTextField
            fullWidth
            label='Nombre de la sucursal'
            value={name}
            onChange={e => {
              setName(e.target.value)
              setError(undefined)
            }}
            error={!!error}
            helperText={error}
          />
          <Alert severity='info'>
            Los datos de facturación SIAT se configuran después, editando la sucursal una vez creada.
          </Alert>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} color='secondary' disabled={createBranch.isPending}>
          Cancelar
        </Button>
        <Button
          onClick={handleSubmit}
          variant='contained'
          disabled={createBranch.isPending}
          startIcon={createBranch.isPending ? <CircularProgress size={16} /> : <i className='tabler-check' />}
        >
          {createBranch.isPending ? 'Creando...' : 'Crear Sucursal'}
        </Button>
      </DialogActions>

      <Snackbar
        open={snackbarOpen}
        onClose={handleSnackbarClose}
        autoHideDuration={3000}
        TransitionProps={{ onExited: () => setMessageInfo(undefined) }}
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
    </Dialog>
  )
}

export default BranchFormDialog
