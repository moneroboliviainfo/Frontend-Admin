import { useCallback, useEffect, useState } from 'react'
import type { SyntheticEvent } from 'react'

import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Grid from '@mui/material/Grid2'
import CircularProgress from '@mui/material/CircularProgress'
import FormControlLabel from '@mui/material/FormControlLabel'
import Switch from '@mui/material/Switch'
import Checkbox from '@mui/material/Checkbox'
import Divider from '@mui/material/Divider'
import Alert from '@mui/material/Alert'
import Snackbar from '@mui/material/Snackbar'

import CustomTextField from '@core/components/mui/TextField'
import { useBranchAdmin, useUpdateBranch } from '@/hooks/useBranchAdmin'
import { siatBranchFormSchema, initialSiatBranchForm } from '@/schemas/branch.schema'
import type { SiatBranchFormData } from '@/schemas/branch.schema'

type SnackbarMessage = {
  key: number
  message: string
  severity: 'success' | 'error' | 'info' | 'warning'
}

type Props = {
  branchId: number | null
  onClose: () => void
  onSuccess: () => void
}

const BranchEditDialog = ({ branchId, onClose, onSuccess }: Props) => {
  const [name, setName] = useState('')
  const [active, setActive] = useState(true)
  const [siatEnabled, setSiatEnabled] = useState(false)
  const [siatForm, setSiatForm] = useState<SiatBranchFormData>(initialSiatBranchForm)
  const [siatErrors, setSiatErrors] = useState<Partial<Record<keyof SiatBranchFormData, string>>>({})
  const [snackbarOpen, setSnackbarOpen] = useState(false)
  const [snackPack, setSnackPack] = useState<SnackbarMessage[]>([])
  const [messageInfo, setMessageInfo] = useState<SnackbarMessage | undefined>(undefined)

  const { data: branch, isLoading: isLoadingBranch } = useBranchAdmin(branchId)
  const updateBranch = useUpdateBranch()

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
    if (branch) {
      setName(branch.name)
      setActive(branch.active)
      setSiatEnabled(!!branch.siatBranch)
      setSiatForm(branch.siatBranch ? { ...initialSiatBranchForm, ...branch.siatBranch } : initialSiatBranchForm)
      setSiatErrors({})
    }
  }, [branch])

  const handleSiatChange = (field: keyof SiatBranchFormData, value: string | number | boolean) => {
    setSiatForm(prev => ({ ...prev, [field]: value }))
    setSiatErrors(prev => ({ ...prev, [field]: undefined }))
  }

  const handleSubmit = async () => {
    if (!branchId) return

    // El back rechaza `id`/`createdAt` en el body (doc 07): se manda lo que
    // valida el schema (sin esos campos), no el `siatForm` crudo que trae
    // tambien lo que vino en el GET.
    let siatPayload: SiatBranchFormData | undefined

    if (siatEnabled) {
      const result = siatBranchFormSchema.safeParse(siatForm)

      if (!result.success) {
        const fieldErrors: Partial<Record<keyof SiatBranchFormData, string>> = {}

        result.error.errors.forEach(err => {
          const key = err.path[0] as keyof SiatBranchFormData

          fieldErrors[key] = err.message
        })
        setSiatErrors(fieldErrors)

        return
      }

      siatPayload = result.data
    }

    try {
      await updateBranch.mutateAsync({
        id: branchId,
        data: {
          name,
          active,
          ...(siatEnabled && { siatBranch: siatPayload })
        }
      })

      showMessage('Sucursal actualizada exitosamente', 'success')
      onSuccess()
      setTimeout(onClose, 1200)
    } catch (error: any) {
      showMessage(error?.response?.data?.message || 'Error al actualizar la sucursal', 'error')
    }
  }

  return (
    <Dialog open={branchId !== null} onClose={onClose} maxWidth='sm' fullWidth>
      <DialogTitle>Editar Sucursal</DialogTitle>
      <DialogContent>
        {isLoadingBranch ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4, mt: 2 }}>
            <CustomTextField fullWidth label='Nombre' value={name} onChange={e => setName(e.target.value)} />

            <FormControlLabel
              control={<Switch checked={active} onChange={e => setActive(e.target.checked)} />}
              label={active ? 'Sucursal activa' : 'Sucursal inactiva'}
            />

            <Divider />

            <FormControlLabel
              control={<Checkbox checked={siatEnabled} onChange={e => setSiatEnabled(e.target.checked)} />}
              label='Configurar datos de facturación SIAT'
            />

            {siatEnabled && (
              <Grid container spacing={3}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <CustomTextField
                    fullWidth
                    label='Código Sucursal SIN'
                    type='number'
                    value={siatForm.codigoSucursal}
                    onChange={e => handleSiatChange('codigoSucursal', Number(e.target.value))}
                    error={!!siatErrors.codigoSucursal}
                    helperText={siatErrors.codigoSucursal}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <CustomTextField
                    fullWidth
                    label='Nombre (SIAT)'
                    value={siatForm.name}
                    onChange={e => handleSiatChange('name', e.target.value)}
                    error={!!siatErrors.name}
                    helperText={siatErrors.name}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <CustomTextField
                    fullWidth
                    label='Alias'
                    value={siatForm.alias}
                    onChange={e => handleSiatChange('alias', e.target.value)}
                    error={!!siatErrors.alias}
                    helperText={siatErrors.alias}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <CustomTextField
                    fullWidth
                    label='Razón Social'
                    value={siatForm.razonSocial}
                    onChange={e => handleSiatChange('razonSocial', e.target.value)}
                    error={!!siatErrors.razonSocial}
                    helperText={siatErrors.razonSocial}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <CustomTextField
                    fullWidth
                    label='Actividad Económica'
                    value={siatForm.actividadEconomica}
                    onChange={e => handleSiatChange('actividadEconomica', e.target.value)}
                    error={!!siatErrors.actividadEconomica}
                    helperText={siatErrors.actividadEconomica}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <CustomTextField
                    fullWidth
                    label='Teléfono'
                    value={siatForm.telefono}
                    onChange={e => handleSiatChange('telefono', e.target.value)}
                    error={!!siatErrors.telefono}
                    helperText={siatErrors.telefono}
                  />
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <CustomTextField
                    fullWidth
                    label='Dirección'
                    value={siatForm.address}
                    onChange={e => handleSiatChange('address', e.target.value)}
                    error={!!siatErrors.address}
                    helperText={siatErrors.address}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <CustomTextField
                    fullWidth
                    label='Departamento'
                    value={siatForm.departamento}
                    onChange={e => handleSiatChange('departamento', e.target.value)}
                    error={!!siatErrors.departamento}
                    helperText={siatErrors.departamento}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <CustomTextField
                    fullWidth
                    label='Municipio'
                    value={siatForm.municipio}
                    onChange={e => handleSiatChange('municipio', e.target.value)}
                    error={!!siatErrors.municipio}
                    helperText={siatErrors.municipio}
                  />
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={siatForm.active}
                        onChange={e => handleSiatChange('active', e.target.checked)}
                      />
                    }
                    label='Facturación SIAT activa'
                  />
                </Grid>
              </Grid>
            )}

            {!siatEnabled && (
              <Alert severity='info'>
                Sin datos SIAT, esta sucursal no puede vender online ni facturar. En tienda física sí puede vender,
                pero no podrá emitir factura hasta que se configure.
              </Alert>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color='secondary' disabled={updateBranch.isPending}>
          Cancelar
        </Button>
        <Button
          onClick={handleSubmit}
          variant='contained'
          disabled={updateBranch.isPending || isLoadingBranch}
          startIcon={updateBranch.isPending ? <CircularProgress size={16} /> : <i className='tabler-check' />}
        >
          {updateBranch.isPending ? 'Guardando...' : 'Guardar Cambios'}
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

export default BranchEditDialog
