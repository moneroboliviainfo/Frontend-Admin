'use client'

import { useState, useMemo } from 'react'

import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import Typography from '@mui/material/Typography'
import dayjs from 'dayjs'
import 'dayjs/locale/es'

import { useCrearPaqueteContingencia, useCafcs, useEventosByCafc } from '@/hooks/useSales'
import type { Cafc, EventoByCafc } from '@/types/api/sales'

interface PaqueteFormProps {
  onSuccess: () => void
  onCancel: () => void
}

const PaqueteForm = ({ onSuccess, onCancel }: PaqueteFormProps) => {
  const [selectedCafcId, setSelectedCafcId] = useState<number | ''>('')
  const [selectedEventoId, setSelectedEventoId] = useState<number | ''>('')
  const [error, setError] = useState<string>('')

  const crearPaqueteMutation = useCrearPaqueteContingencia()
  const { data: cafcs } = useCafcs()

  // CAFCs disponibles (con números restantes)
  const availableCafcs = useMemo(() => {
    if (!cafcs) return []

    return cafcs.filter((cafc: Cafc) => parseInt(cafc.ultimoNumero) < parseInt(cafc.numeroFinal))
  }, [cafcs])

  const selectedCafc = cafcs?.find((c: Cafc) => c.id === selectedCafcId)

  // Obtener Eventos Significativos disponibles para el CAFC seleccionado
  const { data: eventosList, isLoading: isLoadingEventos } = useEventosByCafc(
    selectedCafc?.codigo || '',
    0,
    0,
    !!selectedCafc
  )

  // Evento seleccionado
  const eventoSeleccionado = useMemo(() => {
    if (!eventosList || !selectedEventoId) return null

    return eventosList.find((e: EventoByCafc) => e.eventoSignificativoId === selectedEventoId)
  }, [eventosList, selectedEventoId])

  const handleCafcChange = (cafcId: number) => {
    setSelectedCafcId(cafcId)
    setSelectedEventoId('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!selectedCafc) {
      setError('Debe seleccionar un CAFC')

      return
    }

    if (!selectedEventoId) {
      setError('Debe seleccionar un Evento Significativo')

      return
    }

    const data = {
      eventoSignificativoId: selectedEventoId as number,
      cafc: selectedCafc.codigo
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
        El sistema agrupará automáticamente todas las facturas PENDIENTES del evento significativo seleccionado.
      </Alert>

      <FormControl fullWidth>
        <InputLabel>CAFC *</InputLabel>
        <Select value={selectedCafcId} label='CAFC *' onChange={e => handleCafcChange(e.target.value as number)}>
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

      <FormControl fullWidth disabled={!selectedCafc || isLoadingEventos}>
        <InputLabel>Evento Significativo *</InputLabel>
        <Select
          value={selectedEventoId}
          label='Evento Significativo *'
          onChange={e => setSelectedEventoId(e.target.value as number)}
        >
          {isLoadingEventos ? (
            <MenuItem value=''>Cargando Eventos...</MenuItem>
          ) : !eventosList || eventosList.length === 0 ? (
            <MenuItem value=''>No hay eventos disponibles para este CAFC</MenuItem>
          ) : (
            eventosList.map((evento: EventoByCafc) => (
              <MenuItem key={evento.eventoSignificativoId} value={evento.eventoSignificativoId}>
                <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                  <Typography variant='body2' fontWeight='medium'>
                    Evento #{evento.eventoSignificativoId} - {evento.cantidadFacturas} factura
                    {evento.cantidadFacturas !== 1 ? 's' : ''}
                  </Typography>
                  <Typography variant='caption' color='text.secondary'>
                    {dayjs(evento.fechaDesde).format('DD/MM/YYYY HH:mm')} -{' '}
                    {dayjs(evento.fechaHasta).format('DD/MM/YYYY HH:mm')}
                  </Typography>
                </Box>
              </MenuItem>
            ))
          )}
        </Select>
      </FormControl>

      {eventoSeleccionado && (
        <Alert severity='info' sx={{ py: 1 }}>
          <Typography variant='caption'>
            <strong>Evento:</strong> #{eventoSeleccionado.eventoSignificativoId}
          </Typography>
          <br />
          <Typography variant='caption'>
            <strong>Facturas:</strong> {eventoSeleccionado.cantidadFacturas}
          </Typography>
          <br />
          <Typography variant='caption'>
            <strong>Rango:</strong> {dayjs(eventoSeleccionado.fechaDesde).format('DD/MM/YYYY HH:mm')} -{' '}
            {dayjs(eventoSeleccionado.fechaHasta).format('DD/MM/YYYY HH:mm')}
          </Typography>
        </Alert>
      )}

      {selectedCafc && eventoSeleccionado && (
        <Alert severity='success'>
          <Typography variant='caption'>
            Se creará un paquete con las {eventoSeleccionado.cantidadFacturas} facturas pendientes del evento #
            {eventoSeleccionado.eventoSignificativoId}
            <br />- CAFC: {selectedCafc.codigo}
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
          disabled={crearPaqueteMutation.isPending || !selectedCafc || !selectedEventoId}
          startIcon={crearPaqueteMutation.isPending ? <CircularProgress size={20} /> : null}
        >
          {crearPaqueteMutation.isPending ? 'Creando...' : 'Crear Paquete'}
        </Button>
      </Box>
    </Box>
  )
}

export default PaqueteForm
