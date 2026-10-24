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
import Alert from '@mui/material/Alert'
import Snackbar from '@mui/material/Snackbar'

import CustomTextField from '@core/components/mui/TextField'
import { useCreateAdmin, useCreateStaff } from '@/hooks/useUsers'
import { fetchBillingOnlyBranches, useBranchContext } from '@/contexts/BranchContext'
import { createUserFormSchema } from '@/schemas/staffUser.schema'
import type { CreateUserFormData } from '@/schemas/staffUser.schema'

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

const initialForm: CreateUserFormData = {
  name: '',
  email: '',
  password: '',
  rol: 'cashier',
  branchId: undefined
}

const UserFormDialog = ({ open, onClose, onSuccess }: Props) => {
  const [form, setForm] = useState<CreateUserFormData>(initialForm)
  const [errors, setErrors] = useState<Partial<Record<keyof CreateUserFormData, string>>>({})
  const [snackbarOpen, setSnackbarOpen] = useState(false)
  const [snackPack, setSnackPack] = useState<SnackbarMessage[]>([])
  const [messageInfo, setMessageInfo] = useState<SnackbarMessage | undefined>(undefined)

  const { branches, isLoading: isLoadingBranches } = useBranchContext()

  // Las sucursales de solo facturacion no vienen en GET /branches: sin esta
  // consulta no se les puede asignar un cajero (doc 07).
  const { data: billingOnly = [] } = useQuery({
    queryKey: ['branches-billing-only'],
    queryFn: fetchBillingOnlyBranches,
    staleTime: 1000 * 60 * 30
  })

  const createAdmin = useCreateAdmin()
  const createStaff = useCreateStaff()

  const isPending = createAdmin.isPending || createStaff.isPending

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

  const handleChange = (field: keyof CreateUserFormData, value: string | number) => {
    setForm(prev => ({ ...prev, [field]: value }))
    setErrors(prev => ({ ...prev, [field]: undefined }))
  }

  const handleSubmit = async () => {
    const result = createUserFormSchema.safeParse(form)

    if (!result.success) {
      const fieldErrors: Partial<Record<keyof CreateUserFormData, string>> = {}

      result.error.errors.forEach(err => {
        const key = err.path[0] as keyof CreateUserFormData

        fieldErrors[key] = err.message
      })
      setErrors(fieldErrors)

      return
    }

    try {
      if (form.rol === 'admin' || form.rol === 'supervisor') {
        await createAdmin.mutateAsync({
          name: form.name,
          email: form.email,
          password: form.password,
          rol: form.rol
        })
      } else {
        await createStaff.mutateAsync({
          name: form.name,
          email: form.email,
          password: form.password,
          rol: form.rol,
          branchId: form.branchId!
        })
      }

      showMessage('Usuario creado exitosamente', 'success')
      onSuccess()
      setTimeout(handleClose, 1200)
    } catch (error: any) {
      showMessage(error?.response?.data?.message || 'Error al crear el usuario', 'error')
    }
  }

  // BranchContext ya devuelve solo sucursales activas
  const activeBranches = [...branches, ...billingOnly]

  const roleHasNoBranch = form.rol === 'admin' || form.rol === 'supervisor'

  return (
    <Dialog open={open} onClose={handleClose} maxWidth='sm' fullWidth>
      <DialogTitle>Nuevo Usuario</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4, mt: 2 }}>
          <CustomTextField
            fullWidth
            label='Nombre'
            value={form.name}
            onChange={e => handleChange('name', e.target.value)}
            error={!!errors.name}
            helperText={errors.name}
          />
          <CustomTextField
            fullWidth
            label='Email'
            type='email'
            value={form.email}
            onChange={e => handleChange('email', e.target.value)}
            error={!!errors.email}
            helperText={errors.email}
          />
          <CustomTextField
            fullWidth
            label='Contraseña'
            type='password'
            value={form.password}
            onChange={e => handleChange('password', e.target.value)}
            error={!!errors.password}
            helperText={errors.password}
          />
          <CustomTextField
            select
            fullWidth
            label='Rol'
            value={form.rol}
            onChange={e => {
              const rol = e.target.value as CreateUserFormData['rol']

              const noBranch = rol === 'admin' || rol === 'supervisor'

              setForm(prev => ({ ...prev, rol, branchId: noBranch ? undefined : prev.branchId }))
              setErrors(prev => ({ ...prev, rol: undefined, branchId: undefined }))
            }}
          >
            <MenuItem value='admin'>Administrador</MenuItem>
            <MenuItem value='supervisor'>Supervisor</MenuItem>
            <MenuItem value='manager'>Encargado</MenuItem>
            <MenuItem value='cashier'>Cajero</MenuItem>
          </CustomTextField>

          {!roleHasNoBranch && (
            <CustomTextField
              select
              fullWidth
              label='Sucursal'
              value={form.branchId ?? ''}
              onChange={e => handleChange('branchId', Number(e.target.value))}
              error={!!errors.branchId}
              helperText={errors.branchId}
              disabled={isLoadingBranches}
            >
              {activeBranches.map(branch => (
                <MenuItem key={branch.id} value={branch.id}>
                  {branch.name}
                </MenuItem>
              ))}
            </CustomTextField>
          )}

          {!roleHasNoBranch && activeBranches.length === 0 && !isLoadingBranches && (
            <Alert severity='warning'>No hay sucursales activas disponibles. Creá una sucursal primero.</Alert>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} color='secondary' disabled={isPending}>
          Cancelar
        </Button>
        <Button
          onClick={handleSubmit}
          variant='contained'
          disabled={isPending}
          startIcon={isPending ? <CircularProgress size={16} /> : <i className='tabler-check' />}
        >
          {isPending ? 'Creando...' : 'Crear Usuario'}
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

export default UserFormDialog
