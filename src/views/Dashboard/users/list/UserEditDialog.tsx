import { useCallback, useEffect, useState } from 'react'

import type { SyntheticEvent } from 'react'

import { useQuery } from '@tanstack/react-query'

import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import MenuItem from '@mui/material/MenuItem'
import CircularProgress from '@mui/material/CircularProgress'
import FormControlLabel from '@mui/material/FormControlLabel'
import Switch from '@mui/material/Switch'
import Divider from '@mui/material/Divider'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import Snackbar from '@mui/material/Snackbar'

import CustomTextField from '@core/components/mui/TextField'
import { useUpdateUser, useUser } from '@/hooks/useUsers'
import { fetchBillingOnlyBranches, useBranchContext } from '@/contexts/BranchContext'

type SnackbarMessage = {
  key: number
  message: string
  severity: 'success' | 'error' | 'info' | 'warning'
}

type Props = {
  userId: number | null
  onClose: () => void
  onSuccess: () => void
}

const UserEditDialog = ({ userId, onClose, onSuccess }: Props) => {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [enabled, setEnabled] = useState(true)
  const [branchId, setBranchId] = useState<number | ''>('')
  const [newPassword, setNewPassword] = useState('')
  const [snackbarOpen, setSnackbarOpen] = useState(false)
  const [snackPack, setSnackPack] = useState<SnackbarMessage[]>([])
  const [messageInfo, setMessageInfo] = useState<SnackbarMessage | undefined>(undefined)

  const { data: user, isLoading: isLoadingUser } = useUser(userId)
  const { branches } = useBranchContext()

  // Las sucursales de solo facturacion no vienen en GET /branches: sin esta
  // consulta no se les puede asignar un cajero (doc 07).
  const { data: billingOnly = [] } = useQuery({
    queryKey: ['branches-billing-only'],
    queryFn: fetchBillingOnlyBranches,
    staleTime: 1000 * 60 * 30
  })

  const updateUser = useUpdateUser()

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

  useEffect(() => {
    if (user) {
      setName(user.name)
      setEmail(user.email)
      setEnabled(user.enabled)
      setBranchId(user.branch?.id ?? '')
      setNewPassword('')
    }
  }, [user])

  const isStaff = user?.rol === 'manager' || user?.rol === 'cashier'

  // BranchContext ya devuelve solo sucursales activas
  const activeBranches = [...branches, ...billingOnly]

  const handleSubmit = async () => {
    if (!user) return

    if (newPassword && newPassword.length < 6) {
      showMessage('La nueva contraseña debe tener al menos 6 caracteres', 'error')

      return
    }

    try {
      await updateUser.mutateAsync({
        id: user.id,
        data: {
          name: name !== user.name ? name : undefined,
          email: email !== user.email ? email : undefined,
          enabled: enabled !== user.enabled ? enabled : undefined,
          branchId: isStaff && branchId !== '' && branchId !== user.branch?.id ? Number(branchId) : undefined,
          password: newPassword || undefined
        }
      })

      showMessage('Usuario actualizado exitosamente', 'success')
      onSuccess()
      setTimeout(onClose, 1200)
    } catch (error: any) {
      showMessage(error?.response?.data?.message || 'Error al actualizar el usuario', 'error')
    }
  }

  return (
    <Dialog open={userId !== null} onClose={onClose} maxWidth='sm' fullWidth>
      <DialogTitle>Editar Usuario</DialogTitle>
      <DialogContent>
        {isLoadingUser ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4, mt: 2 }}>
          <CustomTextField fullWidth label='Nombre' value={name} onChange={e => setName(e.target.value)} />
          <CustomTextField
            fullWidth
            label='Email'
            type='email'
            value={email}
            onChange={e => setEmail(e.target.value)}
          />

          {isStaff && (
            <CustomTextField
              select
              fullWidth
              label='Sucursal'
              value={branchId}
              onChange={e => setBranchId(Number(e.target.value))}
            >
              {activeBranches.map(branch => (
                <MenuItem key={branch.id} value={branch.id}>
                  {branch.name}
                </MenuItem>
              ))}
            </CustomTextField>
          )}

          <FormControlLabel
            control={<Switch checked={enabled} onChange={e => setEnabled(e.target.checked)} />}
            label={enabled ? 'Usuario habilitado' : 'Usuario deshabilitado'}
          />

          <Divider />

          <Typography variant='body2' color='text.secondary'>
            Resetear contraseña (opcional). Dejar en blanco para no cambiarla — invalida la sesión activa del usuario.
          </Typography>
          <CustomTextField
            fullWidth
            label='Nueva contraseña'
            type='password'
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            placeholder='Sin cambios'
          />
        </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color='secondary' disabled={updateUser.isPending}>
          Cancelar
        </Button>
        <Button
          onClick={handleSubmit}
          variant='contained'
          disabled={updateUser.isPending || isLoadingUser}
          startIcon={updateUser.isPending ? <CircularProgress size={16} /> : <i className='tabler-check' />}
        >
          {updateUser.isPending ? 'Guardando...' : 'Guardar Cambios'}
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

export default UserEditDialog
