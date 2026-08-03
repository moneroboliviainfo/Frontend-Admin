'use client'

import { useState, useMemo } from 'react'

import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import Typography from '@mui/material/Typography'
import dayjs from 'dayjs'
import 'dayjs/locale/es'

import { useCrearEventoSignificativo, useCufds, useEventosSignificativosParametricas, useBranches } from '@/hooks/useSales'
import type { Cufd, EventoSignificativoParametrica, Branch } from '@/types/api/sales'

interface EventoFormProps {
  onSuccess: () => void
  onCancel: () => void
}

const EventoForm = ({ onSuccess, onCancel }: EventoFormProps) => {
  const [selectedBranchId, setSelectedBranchId] = useState<number | ''>('')
  const [codigoMotivoEvento, setCodigoMotivoEvento] = useState<number | ''>('')
  const [descripcion, setDescripcion] = useState<string>('')
  const [selectedCufdId, setSelectedCufdId] = useState<number | ''>('')
  const [fechaInicio, setFechaInicio] = useState<string>('')
  const [fechaFin, setFechaFin] = useState<string>('')
  const [error, setError] = useState<string>('')

  const crearEventoMutation = useCrearEventoSignificativo()

  // Obtener sucursales
  const { data: branches, isLoading: isLoadingBranches } = useBranches()

  // Obtener tipos de eventos del catálogo SIAT
  const { data: eventosParametricas } = useEventosSignificativosParametricas()

  // Sucursal seleccionada
  const selectedBranch = branches?.find((b: Branch) => b.id === selectedBranchId)

  // Obtener CUFDs de la sucursal seleccionada
  const { data: cufds, isLoading: isLoadingCufds } = useCufds(
    selectedBranch?.codigoSucursal ?? 0,
    0,
    !!selectedBranch
  )

  // Extraer los tipos de evento del catálogo (solo códigos 5, 6, 7 válidos para SIAT)
  const tiposEvento = useMemo(() => {
    if (!eventosParametricas?.parametrica?.[0]?.payload) return []

    const eventos = eventosParametricas.parametrica[0].payload as EventoSignificativoParametrica[]

    // Filtrar solo los códigos válidos del SIAT (5, 6, 7)
    return eventos.filter(e => [5, 6, 7].includes(e.codigoClasificador))
  }, [eventosParametricas])

  // CUFD seleccionado
  const selectedCufd = useMemo(() => {
    if (!cufds || !selectedCufdId) return null

    return cufds.find((cufd: Cufd) => cufd.id === selectedCufdId)
  }, [cufds, selectedCufdId])

  // Rango de fechas permitido según el CUFD seleccionado
  const dateRange = useMemo(() => {
    if (!selectedCufd) return { min: '', max: '' }

    return {
      min: dayjs(selectedCufd.createdAt).format('YYYY-MM-DDTHH:mm'),
      max: dayjs(selectedCufd.fechaVigencia).format('YYYY-MM-DDTHH:mm')
    }
  }, [selectedCufd])

  const handleBranchChange = (branchId: number) => {
    setSelectedBranchId(branchId)
    setSelectedCufdId('')
    setFechaInicio('')
    setFechaFin('')
  }

  const handleCufdChange = (cufdId: number) => {
    setSelectedCufdId(cufdId)
    setFechaInicio('')
    setFechaFin('')
  }

  const validateFechaInRange = (value: string): boolean => {
    if (!selectedCufd || !value) return false

    const fecha = dayjs(value)
    const min = dayjs(selectedCufd.createdAt)
    const max = dayjs(selectedCufd.fechaVigencia)

    return (fecha.isAfter(min) || fecha.isSame(min, 'minute')) &&
           (fecha.isBefore(max) || fecha.isSame(max, 'minute'))
  }

  const handleFechaInicioChange = (value: string) => {
    if (!selectedCufd) return

    setFechaInicio(value)

    if (value && !validateFechaInRange(value)) {
      setError(`La fecha de inicio debe estar entre ${dayjs(selectedCufd.createdAt).format('DD/MM/YYYY HH:mm')} y ${dayjs(selectedCufd.fechaVigencia).format('DD/MM/YYYY HH:mm')}`)
    } else {
      setError('')
    }
  }

  const handleFechaFinChange = (value: string) => {
    if (!selectedCufd) return

    setFechaFin(value)

    if (value && !validateFechaInRange(value)) {
      setError(`La fecha de fin debe estar entre ${dayjs(selectedCufd.createdAt).format('DD/MM/YYYY HH:mm')} y ${dayjs(selectedCufd.fechaVigencia).format('DD/MM/YYYY HH:mm')}`)
    } else if (fechaInicio && value && dayjs(value).isBefore(dayjs(fechaInicio))) {
      setError('La fecha de fin debe ser posterior a la fecha de inicio')
    } else {
      setError('')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!codigoMotivoEvento) {
      setError('Debe seleccionar un motivo de evento')

      return
    }

    if (!selectedBranch) {
      setError('Debe seleccionar una sucursal')

      return
    }

    if (!selectedCufdId) {
      setError('Debe seleccionar un CUFD')

      return
    }

    if (!fechaInicio || !fechaFin) {
      setError('Debe seleccionar fecha de inicio y fin')

      return
    }

    // Validar que las fechas estén dentro del rango del CUFD
    if (!validateFechaInRange(fechaInicio)) {
      setError(`La fecha de inicio debe estar entre ${dayjs(selectedCufd!.createdAt).format('DD/MM/YYYY HH:mm')} y ${dayjs(selectedCufd!.fechaVigencia).format('DD/MM/YYYY HH:mm')}`)

      return
    }

    if (!validateFechaInRange(fechaFin)) {
      setError(`La fecha de fin debe estar entre ${dayjs(selectedCufd!.createdAt).format('DD/MM/YYYY HH:mm')} y ${dayjs(selectedCufd!.fechaVigencia).format('DD/MM/YYYY HH:mm')}`)

      return
    }

    if (dayjs(fechaFin).isBefore(dayjs(fechaInicio))) {
      setError('La fecha de fin debe ser posterior a la fecha de inicio')

      return
    }

    const data = {
      codigoMotivoEvento: codigoMotivoEvento as number,
      cufdId: selectedCufdId as number,
      descripcion: descripcion,
      fechaHoraInicioEvento: dayjs(fechaInicio).format('YYYY-MM-DDTHH:mm:ss'),
      fechaHoraFinEvento: dayjs(fechaFin).format('YYYY-MM-DDTHH:mm:ss')
    }

    crearEventoMutation.mutate(
      { data, codigoSucursal: selectedBranch.codigoSucursal, codigoPuntoVenta: 0 },
      {
        onSuccess: () => {
          onSuccess()
        },
        onError: (err: any) => {
          setError(err?.response?.data?.message || 'Error al registrar evento')
        }
      }
    )
  }

  return (
    <Box component='form' onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 2 }}>
      {error && <Alert severity='error'>{error}</Alert>}

      {/* Selector de Motivo */}
      <FormControl fullWidth>
        <InputLabel>Motivo del Evento *</InputLabel>
        <Select
          value={codigoMotivoEvento}
          label='Motivo del Evento *'
          onChange={e => {
            const codigo = e.target.value as number

            setCodigoMotivoEvento(codigo)

            const motivo = tiposEvento.find(ev => ev.codigoClasificador === codigo)

            setDescripcion(motivo?.descripcion || '')
          }}
        >
          {tiposEvento.length === 0 ? (
            <MenuItem value=''>Cargando catálogo...</MenuItem>
          ) : (
            tiposEvento.map((evento: EventoSignificativoParametrica) => (
              <MenuItem key={evento.codigoClasificador} value={evento.codigoClasificador}>
                {evento.descripcion}
              </MenuItem>
            ))
          )}
        </Select>
      </FormControl>

      {/* Descripción */}
      <TextField
        label='Descripción'
        value={descripcion}
        onChange={e => setDescripcion(e.target.value)}
        multiline
        rows={2}
        fullWidth
      />

      {/* Selector de Sucursal */}
      <FormControl fullWidth>
        <InputLabel>Sucursal *</InputLabel>
        <Select
          value={selectedBranchId}
          label='Sucursal *'
          onChange={e => handleBranchChange(e.target.value as number)}
          disabled={isLoadingBranches}
        >
          {isLoadingBranches ? (
            <MenuItem value=''>Cargando sucursales...</MenuItem>
          ) : !branches || branches.length === 0 ? (
            <MenuItem value=''>No hay sucursales disponibles</MenuItem>
          ) : (
            branches
              .filter((b: Branch) => b.active)
              .map((branch: Branch) => (
                <MenuItem key={branch.id} value={branch.id}>
                  {branch.alias} (Sucursal {branch.codigoSucursal})
                </MenuItem>
              ))
          )}
        </Select>
      </FormControl>

      {/* Selector de CUFD */}
      <FormControl fullWidth disabled={!selectedBranch}>
        <InputLabel>CUFD *</InputLabel>
        <Select
          value={selectedCufdId}
          label='CUFD *'
          onChange={e => handleCufdChange(e.target.value as number)}
          disabled={!selectedBranch || isLoadingCufds}
        >
          {!selectedBranch ? (
            <MenuItem value=''>Seleccione una sucursal primero</MenuItem>
          ) : isLoadingCufds ? (
            <MenuItem value=''>Cargando CUFDs...</MenuItem>
          ) : !cufds || cufds.length === 0 ? (
            <MenuItem value=''>No hay CUFDs disponibles</MenuItem>
          ) : (
            cufds.map((cufd: Cufd) => (
              <MenuItem key={cufd.id} value={cufd.id}>
                <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                  <Typography variant='body2' fontWeight='medium'>
                    {cufd.codigo.substring(0, 30)}...
                  </Typography>
                  <Typography variant='caption' color='text.secondary'>
                    Desde: {dayjs(cufd.createdAt).format('DD/MM/YYYY HH:mm')} - Hasta:{' '}
                    {dayjs(cufd.fechaVigencia).format('DD/MM/YYYY HH:mm')}
                  </Typography>
                </Box>
              </MenuItem>
            ))
          )}
        </Select>
      </FormControl>

      {/* Mostrar rango permitido */}
      {selectedCufd && (
        <Alert severity='info'>
          <Typography variant='body2'>
            <strong>Rango permitido para las fechas:</strong>
          </Typography>
          <Typography variant='caption'>
            Desde: {dayjs(selectedCufd.createdAt).format('DD/MM/YYYY HH:mm')} - Hasta:{' '}
            {dayjs(selectedCufd.fechaVigencia).format('DD/MM/YYYY HH:mm')}
          </Typography>
        </Alert>
      )}

      {/* Fecha Inicio */}
      <TextField
        fullWidth
        type='datetime-local'
        label='Fecha y Hora de Inicio *'
        value={fechaInicio}
        onChange={e => handleFechaInicioChange(e.target.value)}
        disabled={!selectedCufd}
        InputLabelProps={{ shrink: true }}
        inputProps={{
          min: dateRange.min,
          max: dateRange.max,
          step: 60
        }}
      />

      {/* Fecha Fin */}
      <TextField
        fullWidth
        type='datetime-local'
        label='Fecha y Hora de Fin *'
        value={fechaFin}
        onChange={e => handleFechaFinChange(e.target.value)}
        disabled={!selectedCufd}
        InputLabelProps={{ shrink: true }}
        inputProps={{
          min: dateRange.min,
          max: dateRange.max,
          step: 60
        }}
      />

      {/* Botones */}
      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
        <Button onClick={onCancel} variant='outlined' disabled={crearEventoMutation.isPending}>
          Cancelar
        </Button>
        <Button
          type='submit'
          variant='contained'
          disabled={crearEventoMutation.isPending || !selectedBranchId || !selectedCufdId || !codigoMotivoEvento || !fechaInicio || !fechaFin}
          startIcon={crearEventoMutation.isPending ? <CircularProgress size={20} /> : null}
        >
          {crearEventoMutation.isPending ? 'Registrando...' : 'Registrar Evento'}
        </Button>
      </Box>
    </Box>
  )
}

export default EventoForm
