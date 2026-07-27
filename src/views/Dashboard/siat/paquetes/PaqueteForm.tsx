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

import { useCrearPaqueteContingencia, useCafcs, useCufdsByCafc, useEventosSignificativosParametricas } from '@/hooks/useSales'
import type { Cafc, CufdByCafc, EventoSignificativoParametrica } from '@/types/api/sales'

interface PaqueteFormProps {
  onSuccess: () => void
  onCancel: () => void
}

const PaqueteForm = ({ onSuccess, onCancel }: PaqueteFormProps) => {
  const [selectedCafcId, setSelectedCafcId] = useState<number | ''>('')
  const [selectedCufd, setSelectedCufd] = useState<string>('')
  const [codigoMotivoEvento, setCodigoMotivoEvento] = useState<number | ''>('')
  const [descripcionEvento, setDescripcionEvento] = useState<string>('')
  const [error, setError] = useState<string>('')

  const crearPaqueteMutation = useCrearPaqueteContingencia()
  const { data: cafcs } = useCafcs()
  const { data: eventosParametricas } = useEventosSignificativosParametricas()

  // CAFCs disponibles (con números restantes)
  const availableCafcs = useMemo(() => {
    if (!cafcs) return []
    return cafcs.filter((cafc: Cafc) => parseInt(cafc.ultimoNumero) < parseInt(cafc.numeroFinal))
  }, [cafcs])

  const selectedCafc = cafcs?.find((c: Cafc) => c.id === selectedCafcId)

  // Obtener CUFDs disponibles para el CAFC seleccionado
  const { data: cufdsList, isLoading: isLoadingCufds } = useCufdsByCafc(
    selectedCafc?.codigo || '',
    !!selectedCafc
  )

  // Extraer los tipos de evento del catálogo SIAT (excluir eventos 1-4 que se manejan en otro flujo)
  const tiposEvento = useMemo(() => {
    if (!eventosParametricas?.parametrica?.[0]?.payload) return []
    const eventos = eventosParametricas.parametrica[0].payload as EventoSignificativoParametrica[]
    // Excluir eventos 1, 2, 3, 4 que se manejan en eventos significativos
    return eventos.filter(e => ![1, 2, 3, 4].includes(e.codigoClasificador))
  }, [eventosParametricas])

  // Obtener descripción del motivo seleccionado
  const motivoSeleccionado = useMemo(() => {
    return tiposEvento.find(e => e.codigoClasificador === codigoMotivoEvento)
  }, [tiposEvento, codigoMotivoEvento])

  // CUFD seleccionado
  const cufdSeleccionado = useMemo(() => {
    if (!cufdsList || !selectedCufd) return null
    return cufdsList.find((c: CufdByCafc) => c.cufd === selectedCufd)
  }, [cufdsList, selectedCufd])

  const handleCafcChange = (cafcId: number) => {
    setSelectedCafcId(cafcId)
    setSelectedCufd('') // Reset CUFD selection when CAFC changes
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!selectedCafc) {
      setError('Debe seleccionar un CAFC')
      return
    }

    if (!selectedCufd) {
      setError('Debe seleccionar un CUFD')
      return
    }

    if (!codigoMotivoEvento) {
      setError('Debe seleccionar un motivo de evento')
      return
    }

    const data = {
      descripcionEvento: descripcionEvento || motivoSeleccionado?.descripcion || '',
      codigoEvento: codigoMotivoEvento as number,
      cafc: selectedCafc.codigo,
      cufd: selectedCufd
    }

    crearPaqueteMutation.mutate(data, {
      onSuccess: () => {
        onSuccess()
      },
      onError: (err: any) => {
        setError(err?.response?.data?.message || 'Error al crear paquete')
      }
    })
  }

  return (
    <Box component='form' onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 2 }}>
      {error && <Alert severity='error'>{error}</Alert>}

      <Alert severity='info' sx={{ fontSize: '0.875rem' }}>
        El sistema agrupará automáticamente todas las facturas PENDIENTES con el CAFC y CUFD seleccionados.
      </Alert>

      <FormControl fullWidth>
        <InputLabel>CAFC *</InputLabel>
        <Select
          value={selectedCafcId}
          label='CAFC *'
          onChange={e => handleCafcChange(e.target.value as number)}
        >
          {availableCafcs.length === 0 ? (
            <MenuItem value=''>No hay CAFCs disponibles</MenuItem>
          ) : (
            availableCafcs.map((cafc: Cafc) => (
              <MenuItem key={cafc.id} value={cafc.id}>
                {cafc.codigo} ({cafc.ultimoNumero}/{cafc.numeroFinal} usados)
              </MenuItem>
            ))
          )}
        </Select>
      </FormControl>

      <FormControl fullWidth disabled={!selectedCafc || isLoadingCufds}>
        <InputLabel>CUFD *</InputLabel>
        <Select
          value={selectedCufd}
          label='CUFD *'
          onChange={e => setSelectedCufd(e.target.value as string)}
        >
          {isLoadingCufds ? (
            <MenuItem value=''>Cargando CUFDs...</MenuItem>
          ) : !cufdsList || cufdsList.length === 0 ? (
            <MenuItem value=''>No hay CUFDs disponibles para este CAFC</MenuItem>
          ) : (
            cufdsList.map((cufd: CufdByCafc) => (
              <MenuItem key={cufd.cufd} value={cufd.cufd}>
                <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                  <Typography variant='body2' fontWeight='medium'>
                    {cufd.cantidadFacturas} factura{cufd.cantidadFacturas !== 1 ? 's' : ''}
                  </Typography>
                  <Typography variant='caption' color='text.secondary'>
                    {dayjs(cufd.fechaDesde).format('DD/MM/YYYY HH:mm')} - {dayjs(cufd.fechaHasta).format('DD/MM/YYYY HH:mm')}
                  </Typography>
                </Box>
              </MenuItem>
            ))
          )}
        </Select>
      </FormControl>

      {cufdSeleccionado && (
        <Alert severity='info' sx={{ py: 1 }}>
          <Typography variant='caption'>
            <strong>CUFD:</strong> {cufdSeleccionado.cufd.substring(0, 30)}...
          </Typography>
          <br />
          <Typography variant='caption'>
            <strong>Facturas:</strong> {cufdSeleccionado.cantidadFacturas}
          </Typography>
          <br />
          <Typography variant='caption'>
            <strong>Rango:</strong> {dayjs(cufdSeleccionado.fechaDesde).format('DD/MM/YYYY HH:mm')} - {dayjs(cufdSeleccionado.fechaHasta).format('DD/MM/YYYY HH:mm')}
          </Typography>
        </Alert>
      )}

      <FormControl fullWidth>
        <InputLabel>Motivo del Evento *</InputLabel>
        <Select
          value={codigoMotivoEvento}
          label='Motivo del Evento *'
          onChange={e => {
            const codigo = e.target.value as number
            setCodigoMotivoEvento(codigo)
            const motivo = tiposEvento.find(ev => ev.codigoClasificador === codigo)
            setDescripcionEvento(motivo?.descripcion || '')
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
        value={descripcionEvento}
        onChange={e => setDescripcionEvento(e.target.value)}
        multiline
        rows={2}
        fullWidth
      />

      {selectedCafc && selectedCufd && motivoSeleccionado && (
        <Alert severity='success'>
          <Typography variant='caption'>
            Se creará un paquete con todas las facturas pendientes que usen:
            <br />- CAFC: {selectedCafc.codigo}
            <br />- CUFD: {selectedCufd.substring(0, 25)}...
            <br />- Evento: {motivoSeleccionado.descripcion}
          </Typography>
        </Alert>
      )}

      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
        <Button onClick={onCancel} variant='outlined' disabled={crearPaqueteMutation.isPending}>
          Cancelar
        </Button>
        <Button
          type='submit'
          variant='contained'
          disabled={crearPaqueteMutation.isPending || !selectedCafc || !selectedCufd || !codigoMotivoEvento}
          startIcon={crearPaqueteMutation.isPending ? <CircularProgress size={20} /> : null}
        >
          {crearPaqueteMutation.isPending ? 'Creando...' : 'Crear Paquete'}
        </Button>
      </Box>
    </Box>
  )
}

export default PaqueteForm
