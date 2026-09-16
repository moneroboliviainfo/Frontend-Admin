'use client'

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

import CustomTextField from '@core/components/mui/TextField'
import { useChangeMyPassword } from '@/hooks/useUsers'
import { changeMyPasswordFormSchema } from '@/schemas/staffUser.schema'
import type { ChangeMyPasswordFormData } from '@/schemas/staffUser.schema'

type SnackbarMessage = {
  key: number
  message: string
  severity: 'success' | 'error' | 'info' | 'warning'
}

type Props = {
  open: boolean
  onClose: () => void
}

const initialForm: ChangeMyPasswordFormData = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: ''
}

const ChangePasswordDialog = ({ open, onClose }: Props) => {
  const [form, setForm] = useState<ChangeMyPasswordFormData>(initialForm)
  const [errors, setErrors] = useState<Partial<Record<keyof ChangeMyPasswordFormData, string>>>({})
  const [snackbarOpen, setSnackbarOpen] = useState(false)
  const [snackPack, setSnackPack] = useState<SnackbarMessage[]>([])
  const [messageInfo, setMessageInfo] = useState<SnackbarMessage | undefined>(undefined)

  const changeMyPassword = useChangeMyPassword()

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
    setForm(initialForm)
    setErrors({})
    onClose()
  }

  const handleChange = (field: keyof ChangeMyPasswordFormData, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
    setErrors(prev => ({ ...prev, [field]: undefined }))
  }

  const handleSubmit = async () => {
    const result = changeMyPasswordFormSchema.safeParse(form)

    if (!result.success) {
      const fieldErrors: Partial<Record<keyof ChangeMyPasswordFormData, string>> = {}

      result.error.errors.forEach(err => {
        const key = err.path[0] as keyof ChangeMyPasswordFormData

        fieldErrors[key] = err.message
      })
      setErrors(fieldErrors)

      return
    }

    try {
      await changeMyPassword.mutateAsync({
        currentPassword: form.currentPassword,
        newPassword: form.newPassword
      })

      showMessage('Contraseña actualizada exitosamente', 'success')
      setTimeout(handleClose, 1200)
    } catch (error: any) {
      showMessage(error?.response?.data?.message || 'Error al cambiar la contraseña', 'error')
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth='sm' fullWidth>
      <DialogTitle>Cambiar Contraseña</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4, mt: 2 }}>
          <CustomTextField
            fullWidth
            label='Contraseña actual'
            type='password'
            value={form.currentPassword}
            onChange={e => handleChange('currentPassword', e.target.value)}
            error={!!errors.currentPassword}
            helperText={errors.currentPassword}
          />
          <CustomTextField
            fullWidth
            label='Nueva contraseña'
            type='password'
            value={form.newPassword}
            onChange={e => handleChange('newPassword', e.target.value)}
            error={!!errors.newPassword}
            helperText={errors.newPassword}
          />
          <CustomTextField
            fullWidth
            label='Repetir nueva contraseña'
            type='password'
            value={form.confirmPassword}
            onChange={e => handleChange('confirmPassword', e.target.value)}
            error={!!errors.confirmPassword}
            helperText={errors.confirmPassword}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} color='secondary' disabled={changeMyPassword.isPending}>
          Cancelar
        </Button>
        <Button
          onClick={handleSubmit}
          variant='contained'
          disabled={changeMyPassword.isPending}
          startIcon={changeMyPassword.isPending ? <CircularProgress size={16} /> : <i className='tabler-check' />}
        >
          {changeMyPassword.isPending ? 'Guardando...' : 'Cambiar Contraseña'}
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

export default ChangePasswordDialog
