'use client'

import { useEffect, useState } from 'react'

import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Box from '@mui/material/Box'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Divider from '@mui/material/Divider'
import Skeleton from '@mui/material/Skeleton'
import Snackbar from '@mui/material/Snackbar'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'

import CustomTextField from '@core/components/mui/TextField'
import { useAppSettings, useUpdateAppSettings } from '@/hooks/useAppSettings'

const formatDate = (value: string | null) => (value ? new Date(value).toLocaleString('es-BO') : '—')

const BranchRequestSettings = () => {
  const [pickupDays, setPickupDays] = useState('')
  const [holdDays, setHoldDays] = useState('')
  const [snackbar, setSnackbar] = useState<{ message: string; severity: 'success' | 'error' } | null>(null)

  const { data, isLoading, isError } = useAppSettings()
  const updateSettings = useUpdateAppSettings()

  useEffect(() => {
    if (data) {
      setPickupDays(String(data.branchRequestPickupDays))
      setHoldDays(String(data.branchRequestHoldDays))
    }
  }, [data])

  const pickup = parseInt(pickupDays, 10)
  const hold = parseInt(holdDays, 10)

  const pickupError = !pickupDays.trim() || isNaN(pickup) || pickup < 1 || pickup > 365
  const holdRangeError = !holdDays.trim() || isNaN(hold) || hold < 0 || hold > 365

  // El back rechaza un apartado mayor al plazo de retiro
  const holdOverPickup = !holdRangeError && !pickupError && hold > pickup

  const hasChanges =
    !!data && (pickup !== data.branchRequestPickupDays || hold !== data.branchRequestHoldDays)

  const canSave = hasChanges && !pickupError && !holdRangeError && !holdOverPickup

  const handleSave = async () => {
    try {
      await updateSettings.mutateAsync({ branchRequestPickupDays: pickup, branchRequestHoldDays: hold })
      setSnackbar({ message: 'Plazos actualizados', severity: 'success' })
    } catch (error: any) {
      setSnackbar({
        message: error?.response?.data?.message || 'No se pudieron guardar los plazos',
        severity: 'error'
      })
    }
  }

  if (isError) {
    return (
      <Card>
        <CardContent>
          <Alert severity='error'>No se pudo cargar la configuración.</Alert>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader
          title='Pedidos entre sucursales'
          subheader='Cuánto tiempo se le guarda la prenda al cliente que encargó algo a otra sucursal.'
        />

        <Divider />

        <CardContent>
          {isLoading ? (
            <Box>
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} height={56} sx={{ mb: 2 }} />
              ))}
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 5, maxWidth: 520 }}>
              <Box>
                <CustomTextField
                  fullWidth
                  type='number'
                  label='Días para retirar'
                  value={pickupDays}
                  onChange={e => setPickupDays(e.target.value)}
                  error={pickupError}
                  inputProps={{ min: 1, max: 365 }}
                />
                <Typography variant='caption' color='text.secondary'>
                  Desde que el pedido llega a la sucursal, cuántos días tiene el cliente para pasar a buscarlo.
                  Pasado ese plazo cuenta como no retirado. Entre 1 y 365.
                </Typography>
              </Box>

              <Box>
                <CustomTextField
                  fullWidth
                  type='number'
                  label='Días apartado'
                  value={holdDays}
                  onChange={e => setHoldDays(e.target.value)}
                  error={holdRangeError || holdOverPickup}
                  helperText={
                    holdOverPickup ? 'No puede ser mayor que los días para retirar' : ''
                  }
                  inputProps={{ min: 0, max: 365 }}
                />
                {/* Todo pedido para un cliente se cobra al pedir y el back lo aparta todo el plazo
                    de retiro sin mirar este valor. Solo queda afectando a los pedidos "Para sucursal",
                    que no esperan a nadie: con mas de 0 dias esa mercaderia queda trabada sin venderse */}
                <Typography variant='caption' color='text.secondary'>
                  Solo afecta a los pedidos <strong>para sucursal</strong> (reponer stock, sin cliente): cuántos días
                  queda trabada la mercadería antes de poder venderse. Se recomienda <strong>0</strong>, para que se
                  pueda vender apenas llega. Los pedidos de clientes ya están pagados y quedan apartados todo el
                  plazo de retiro, sin importar este valor.
                </Typography>
                {hold > 0 && !holdRangeError && (
                  <Alert severity='warning' sx={{ mt: 2 }}>
                    Con {hold} {hold === 1 ? 'día' : 'días'}, lo que una sucursal pida para reponer stock no se podrá
                    vender hasta que pase ese plazo.
                  </Alert>
                )}
              </Box>

              <Alert severity='info'>
                Los plazos se aplican a los pedidos que <strong>se reciban desde ahora</strong>. Los que ya
                llegaron conservan las fechas que tenían.
              </Alert>

              <Box className='flex flex-wrap items-center justify-between gap-3'>
                <Typography variant='caption' color='text.secondary'>
                  {data?.updatedBy
                    ? `Última modificación: ${data.updatedBy.name} · ${formatDate(data.updatedAt)}`
                    : 'Sin modificaciones registradas'}
                </Typography>

                <Button
                  variant='contained'
                  onClick={handleSave}
                  disabled={!canSave || updateSettings.isPending}
                  startIcon={
                    updateSettings.isPending ? <CircularProgress size={16} /> : <i className='tabler-device-floppy' />
                  }
                >
                  {updateSettings.isPending ? 'Guardando...' : 'Guardar cambios'}
                </Button>
              </Box>
            </Box>
          )}
        </CardContent>
      </Card>

      <Snackbar
        open={!!snackbar}
        autoHideDuration={4000}
        onClose={() => setSnackbar(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={snackbar?.severity} onClose={() => setSnackbar(null)} variant='filled'>
          {snackbar?.message}
        </Alert>
      </Snackbar>
    </>
  )
}

export default BranchRequestSettings
