'use client'

import { useState } from 'react'

import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'

import { useCreateCafc } from '@/hooks/useSales'

interface CafcFormProps {
  onSuccess: () => void
  onCancel: () => void
}

const CafcForm = ({ onSuccess, onCancel }: CafcFormProps) => {
  const [codigo, setCodigo] = useState<string>('')
  const [numeroInicial, setNumeroInicial] = useState<number>(1)
  const [numeroFinal, setNumeroFinal] = useState<number>(1000)
  const [error, setError] = useState<string>('')

  const createCafcMutation = useCreateCafc()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!codigo.trim()) {
      setError('El código CAFC es requerido')

      return
    }

    if (numeroInicial < 1) {
      setError('El número inicial debe ser mayor a 0')

      return
    }

    if (numeroFinal <= numeroInicial) {
      setError('El número final debe ser mayor al número inicial')

      return
    }

    createCafcMutation.mutate(
      { codigo: codigo.trim(), numeroInicial, numeroFinal },
      {
        onSuccess: () => {
          onSuccess()
        },
        onError: (err: any) => {
          setError(err?.response?.data?.message || 'Error al registrar CAFC')
        }
      }
    )
  }

  return (
    <Box component='form' onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 2 }}>
      {error && <Alert severity='error'>{error}</Alert>}

      <TextField
        label='Código CAFC'
        value={codigo}
        onChange={e => setCodigo(e.target.value.toUpperCase())}
        placeholder='Ej: 101A194B4341C'
        fullWidth
        required
        helperText='Código de autorización proporcionado por el SIAT'
      />

      <Box sx={{ display: 'flex', gap: 2 }}>
        <TextField
          label='Número Inicial'
          type='number'
          value={numeroInicial}
          onChange={e => setNumeroInicial(parseInt(e.target.value) || 1)}
          inputProps={{ min: 1 }}
          fullWidth
          required
        />
        <TextField
          label='Número Final'
          type='number'
          value={numeroFinal}
          onChange={e => setNumeroFinal(parseInt(e.target.value) || 1000)}
          inputProps={{ min: 2 }}
          fullWidth
          required
        />
      </Box>

      <Alert severity='info'>
        Los números definen el rango de facturas que se pueden emitir con este CAFC.
        Por ejemplo, de 1 a 1000 permite emitir hasta 1000 facturas por contingencia.
      </Alert>

      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
        <Button onClick={onCancel} variant='outlined' disabled={createCafcMutation.isPending}>
          Cancelar
        </Button>
        <Button
          type='submit'
          variant='contained'
          disabled={createCafcMutation.isPending}
          startIcon={createCafcMutation.isPending ? <CircularProgress size={20} /> : null}
        >
          {createCafcMutation.isPending ? 'Registrando...' : 'Registrar CAFC'}
        </Button>
      </Box>
    </Box>
  )
}

export default CafcForm
