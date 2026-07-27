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
import Paper from '@mui/material/Paper'
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker'
import { DateCalendar } from '@mui/x-date-pickers/DateCalendar'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import { PickersDay } from '@mui/x-date-pickers/PickersDay'
import type { PickersDayProps } from '@mui/x-date-pickers/PickersDay'
import dayjs, { Dayjs } from 'dayjs'
import minMax from 'dayjs/plugin/minMax'
import 'dayjs/locale/es'

dayjs.extend(minMax)

import { useCrearEventoSignificativo, useCufds, useEventosSignificativosParametricas } from '@/hooks/useSales'
import type { Cufd, EventoSignificativoParametrica } from '@/types/api/sales'

interface EventoFormProps {
  onSuccess: () => void
  onCancel: () => void
}

// Componente para renderizar días con CUFD disponible
const CufdDay = (props: PickersDayProps & { cufdDates?: Set<string>; selectedDateStr?: string }) => {
  const { cufdDates, selectedDateStr, day, outsideCurrentMonth, selected, ...other } = props
  const dateStr = (day as Dayjs).format('YYYY-MM-DD')
  const hasCufd = cufdDates?.has(dateStr)
  const isSelected = dateStr === selectedDateStr

  return (
    <PickersDay
      {...other}
      day={day}
      outsideCurrentMonth={outsideCurrentMonth}
      selected={false}
      disabled={!hasCufd || outsideCurrentMonth}
      sx={{
        ...(hasCufd &&
          !isSelected && {
            backgroundColor: 'primary.light',
            color: 'primary.contrastText',
            '&:hover': { backgroundColor: 'primary.main' }
          }),
        ...(isSelected && {
          backgroundColor: '#ff9800 !important',
          color: '#fff !important',
          '&:hover': { backgroundColor: '#f57c00 !important' }
        })
      }}
    />
  )
}

const EventoForm = ({ onSuccess, onCancel }: EventoFormProps) => {
  const [codigoMotivoEvento, setCodigoMotivoEvento] = useState<number | ''>('')
  const [descripcion, setDescripcion] = useState<string>('')
  const [fechaInicio, setFechaInicio] = useState<Dayjs | null>(dayjs())
  const [fechaFin, setFechaFin] = useState<Dayjs | null>(dayjs())
  const [selectedCufdDate, setSelectedCufdDate] = useState<Dayjs | null>(null)
  const [error, setError] = useState<string>('')

  const crearEventoMutation = useCrearEventoSignificativo()

  // Obtener tipos de eventos del catálogo SIAT
  const { data: eventosParametricas } = useEventosSignificativosParametricas()

  // Obtener todos los CUFDs
  const { data: cufds } = useCufds(0, 0, true)

  // Extraer los tipos de evento del catálogo
  const tiposEvento = useMemo(() => {
    if (!eventosParametricas?.parametrica?.[0]?.payload) return []

    return eventosParametricas.parametrica[0].payload as EventoSignificativoParametrica[]
  }, [eventosParametricas])

  // Obtener descripción del motivo seleccionado
  const motivoSeleccionado = useMemo(() => {
    return tiposEvento.find(e => e.codigoClasificador === codigoMotivoEvento)
  }, [tiposEvento, codigoMotivoEvento])

  // Obtener fechas con CUFD disponible para el calendario
  const cufdDates = useMemo(() => {
    if (!cufds) return new Set<string>()

    const dates = new Set<string>()

    cufds.forEach((cufd: Cufd) => {
      const date = dayjs(cufd.createdAt).format('YYYY-MM-DD')

      dates.add(date)
    })

    return dates
  }, [cufds])

  // Obtener CUFD del día seleccionado
  const cufdForSelectedDate = useMemo(() => {
    if (!cufds || !selectedCufdDate) return null

    return cufds.find((cufd: Cufd) => dayjs(cufd.createdAt).format('YYYY-MM-DD') === selectedCufdDate.format('YYYY-MM-DD'))
  }, [cufds, selectedCufdDate])

  // Fecha seleccionada como string para el calendario
  const selectedDateStr = selectedCufdDate?.format('YYYY-MM-DD') || ''

  // Obtener rango de meses con CUFDs
  const { minDate, maxDate } = useMemo(() => {
    if (!cufds || cufds.length === 0) {
      return { minDate: dayjs().subtract(1, 'year'), maxDate: dayjs() }
    }

    const dates = cufds.map((c: Cufd) => dayjs(c.createdAt))

    return {
      minDate: dayjs.min(dates)?.startOf('month') || dayjs().subtract(1, 'year'),
      maxDate: dayjs.max(dates)?.endOf('month') || dayjs()
    }
  }, [cufds])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!codigoMotivoEvento) {
      setError('Debe seleccionar un motivo de evento')

      return
    }

    if (!fechaInicio || !fechaFin) {
      setError('Debe seleccionar fecha de inicio y fin')

      return
    }

    if (fechaFin.isBefore(fechaInicio)) {
      setError('La fecha de fin debe ser posterior a la fecha de inicio')

      return
    }

    if (!cufdForSelectedDate) {
      setError('Debe seleccionar un CUFD del calendario')

      return
    }

    const data = {
      codigoMotivoEvento: codigoMotivoEvento as number,
      cufdEvento: cufdForSelectedDate.codigo,
      descripcion: descripcion || motivoSeleccionado?.descripcion || '',
      fechaHoraInicioEvento: fechaInicio.format('YYYY-MM-DDTHH:mm:ss'),
      fechaHoraFinEvento: fechaFin.format('YYYY-MM-DDTHH:mm:ss')
    }

    crearEventoMutation.mutate(
      { data, codigoSucursal: 0, codigoPuntoVenta: 0 },
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
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale='es'>
      <Box component='form' onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 2 }}>
        {error && <Alert severity='error'>{error}</Alert>}

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

        <TextField
          label='Descripción (opcional)'
          value={descripcion}
          onChange={e => setDescripcion(e.target.value)}
          multiline
          rows={2}
          fullWidth
        />

        <DateTimePicker
          label='Fecha y Hora de Inicio'
          value={fechaInicio}
          onChange={newValue => setFechaInicio(newValue)}
          format='DD/MM/YYYY HH:mm'
        />

        <DateTimePicker
          label='Fecha y Hora de Fin'
          value={fechaFin}
          onChange={newValue => setFechaFin(newValue)}
          format='DD/MM/YYYY HH:mm'
        />

        {/* Calendario CUFD */}
        <Paper variant='outlined' sx={{ p: 2 }}>
          <Typography variant='subtitle2' fontWeight='bold' sx={{ mb: 1 }}>
            Seleccionar CUFD del día del evento
          </Typography>
          <Typography variant='caption' color='text.secondary' sx={{ mb: 1, display: 'block' }}>
            Los días resaltados tienen CUFD disponible:
          </Typography>
          <DateCalendar
            value={selectedCufdDate}
            onChange={(newDate) => setSelectedCufdDate(newDate)}
            minDate={minDate}
            maxDate={maxDate}
            slots={{ day: CufdDay }}
            slotProps={{ day: { cufdDates, selectedDateStr } as any }}
            sx={{ width: '100%', '& .MuiPickersCalendarHeader-root': { pl: 0 } }}
          />

          {cufdForSelectedDate && (
            <Alert severity='info' sx={{ mt: 1 }}>
              <Typography variant='caption'>
                <strong>CUFD:</strong> {cufdForSelectedDate.codigoControl.substring(0, 25)}...
              </Typography>
              <br />
              <Typography variant='caption'>
                <strong>Fecha:</strong> {dayjs(cufdForSelectedDate.createdAt).format('DD/MM/YYYY HH:mm')}
              </Typography>
            </Alert>
          )}
        </Paper>

        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
          <Button onClick={onCancel} variant='outlined' disabled={crearEventoMutation.isPending}>
            Cancelar
          </Button>
          <Button
            type='submit'
            variant='contained'
            disabled={crearEventoMutation.isPending || !cufdForSelectedDate || !codigoMotivoEvento}
            startIcon={crearEventoMutation.isPending ? <CircularProgress size={20} /> : null}
          >
            {crearEventoMutation.isPending ? 'Registrando...' : 'Registrar Evento'}
          </Button>
        </Box>
      </Box>
    </LocalizationProvider>
  )
}

export default EventoForm
