'use client'

// Gastos y retiros de una caja: lo que sale del cajon y no es una venta.
//
// Se usa en los tres momentos en que el cajero puede registrarlos: durante el
// turno desde el POS, en la pantalla de cierre antes de contar, y en el conteo
// de una caja que se cerro sola a la medianoche.
//
// Dos tipos, con reglas distintas del back:
//   gasto   -> lleva categoria (taxi, limpieza, insumos, comida, otro)
//   retiro  -> NO lleva categoria (deposito al banco, entrega al encargado)

import { useState } from 'react'

import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import MenuItem from '@mui/material/MenuItem'
import CircularProgress from '@mui/material/CircularProgress'

import CustomTextField from '@core/components/mui/TextField'
import { useCreateDailyCashExpense, useVoidDailyCashExpense } from '@/hooks/useDailyCash'
import type { DailyCashExpense, DailyCashExpenseCategory, DailyCashExpenseType } from '@/types/api/dailyCash'

const CATEGORIAS: { value: DailyCashExpenseCategory; label: string }[] = [
  { value: 'transport', label: 'Transporte' },
  { value: 'cleaning', label: 'Limpieza' },
  { value: 'supplies', label: 'Insumos' },
  { value: 'food', label: 'Comida' },
  { value: 'other', label: 'Otro' }
]

const etiquetaCategoria = (value: DailyCashExpenseCategory | null) =>
  CATEGORIAS.find(c => c.value === value)?.label || 'Otro'

const money = (value: string | null | undefined) => `Bs ${Number(value ?? 0).toFixed(2)}`

type Props = {
  dailyCashId: number
  expenses?: DailyCashExpense[]

  // Con la caja ya contada o cerrada a mano el back responde 409: ahi se ve la
  // lista pero no se puede registrar ni anular
  editable?: boolean
}

const CashExpensesPanel = ({ dailyCashId, expenses = [], editable = true }: Props) => {
  const [abierto, setAbierto] = useState(false)
  const [tipo, setTipo] = useState<DailyCashExpenseType>('expense')
  const [categoria, setCategoria] = useState<DailyCashExpenseCategory>('transport')
  const [monto, setMonto] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [error, setError] = useState('')

  // Anular no se deshace: queda registrado con su fecha. Se confirma antes
  const [aAnular, setAAnular] = useState<DailyCashExpense | null>(null)

  const crear = useCreateDailyCashExpense()
  const anular = useVoidDailyCashExpense()

  // Los anulados siguen viniendo del back: se muestran tachados para que quede
  // el rastro, pero no suman
  const vigentes = expenses.filter(e => !e.voidedAt)
  const totalGastos = vigentes.filter(e => e.type === 'expense').reduce((acc, e) => acc + Number(e.amount), 0)
  const totalRetiros = vigentes.filter(e => e.type === 'withdrawal').reduce((acc, e) => acc + Number(e.amount), 0)

  const limpiar = () => {
    setMonto('')
    setDescripcion('')
    setError('')
    setTipo('expense')
    setCategoria('transport')
  }

  const guardar = async () => {
    setError('')

    const importe = Number(monto)

    if (!importe || importe <= 0) {
      setError('Ingresá un monto mayor a 0')

      return
    }

    if (!descripcion.trim()) {
      setError('Escribí para qué fue')

      return
    }

    try {
      await crear.mutateAsync({
        dailyCashId,
        data: {
          type: tipo,

          // El retiro NO lleva categoria: mandarla da 400
          ...(tipo === 'expense' ? { category: categoria } : {}),
          amount: importe.toFixed(2),
          description: descripcion.trim()
        }
      })

      setAbierto(false)
      limpiar()
    } catch (e: any) {
      // El 409 mas comun: el monto supera el efectivo que deberia haber
      setError(e?.response?.data?.message || 'No se pudo registrar')
    }
  }

  const quitar = async () => {
    if (!aAnular) return

    try {
      await anular.mutateAsync({ dailyCashId, expenseId: aAnular.id })
      setAAnular(null)
    } catch {
      // El error queda en la lista: no hay donde mostrarlo sin tapar el panel
    }
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant='caption' color='text.secondary'>
          GASTOS Y RETIROS DEL CAJÓN
        </Typography>

        {editable && (
          <Button size='small' startIcon={<i className='tabler-plus' />} onClick={() => setAbierto(true)}>
            Registrar
          </Button>
        )}
      </Box>

      {vigentes.length === 0 ? (
        <Typography variant='body2' color='text.secondary'>
          Sin movimientos
        </Typography>
      ) : (
        <>
          {expenses.map(item => (
            <Box
              key={item.id}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                py: 0.5,
                opacity: item.voidedAt ? 0.5 : 1
              }}
            >
              <Chip
                label={item.type === 'withdrawal' ? 'Retiro' : etiquetaCategoria(item.category)}
                size='small'
                variant='tonal'
                color={item.type === 'withdrawal' ? 'info' : 'warning'}
                sx={{ height: 20, fontSize: '0.7rem' }}
              />

              <Typography
                variant='body2'
                sx={{ flex: 1, minWidth: 0, textDecoration: item.voidedAt ? 'line-through' : undefined }}
                noWrap
              >
                {item.description}
              </Typography>

              <Typography
                variant='body2'
                sx={{ textDecoration: item.voidedAt ? 'line-through' : undefined }}
              >
                - {money(item.amount)}
              </Typography>

              {editable && !item.voidedAt && (
                <Tooltip title='Anular'>
                  <span>
                    <IconButton size='small' disabled={anular.isPending} onClick={() => setAAnular(item)}>
                      <i className='tabler-x' />
                    </IconButton>
                  </span>
                </Tooltip>
              )}
            </Box>
          ))}

          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
            <Typography variant='caption' color='text.secondary'>
              {totalGastos > 0 && `Gastos ${money(String(totalGastos))}`}
              {totalGastos > 0 && totalRetiros > 0 && ' · '}
              {totalRetiros > 0 && `Retiros ${money(String(totalRetiros))}`}
            </Typography>
          </Box>
        </>
      )}

      {/* Confirmacion de anulacion: el movimiento no se borra, queda con su
          fecha, y vuelve a sumar al efectivo esperado */}
      <Dialog open={!!aAnular} onClose={() => setAAnular(null)} maxWidth='xs' fullWidth>
        <DialogTitle>
          <Typography fontWeight='bold'>¿Anular este movimiento?</Typography>
        </DialogTitle>
        <DialogContent>
          <Typography>
            {aAnular?.type === 'withdrawal' ? 'Retiro' : 'Gasto'} de{' '}
            <strong>{money(aAnular?.amount)}</strong>
            {aAnular?.description ? ` — ${aAnular.description}` : ''}.
          </Typography>

          <Alert severity='info' sx={{ mt: 3 }}>
            Queda registrado como anulado y el efectivo esperado del cajón vuelve a subir por ese monto.
          </Alert>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={() => setAAnular(null)} disabled={anular.isPending} variant='outlined' fullWidth>
            No, volver
          </Button>
          <Button
            onClick={quitar}
            color='error'
            variant='contained'
            disabled={anular.isPending}
            startIcon={anular.isPending ? <CircularProgress size={16} color='inherit' /> : null}
            fullWidth
          >
            {anular.isPending ? 'Anulando...' : 'Sí, anular'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={abierto} onClose={() => setAbierto(false)} maxWidth='xs' fullWidth>
        <DialogTitle>Registrar gasto o retiro</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 2 }}>
            <CustomTextField
              select
              fullWidth
              label='Tipo'
              value={tipo}
              onChange={e => setTipo(e.target.value as DailyCashExpenseType)}
            >
              <MenuItem value='expense'>Gasto (taxi, limpieza, insumos…)</MenuItem>
              <MenuItem value='withdrawal'>Retiro (depósito, entrega al encargado)</MenuItem>
            </CustomTextField>

            {/* Solo el gasto lleva categoria */}
            {tipo === 'expense' && (
              <CustomTextField
                select
                fullWidth
                label='Categoría'
                value={categoria}
                onChange={e => setCategoria(e.target.value as DailyCashExpenseCategory)}
              >
                {CATEGORIAS.map(c => (
                  <MenuItem key={c.value} value={c.value}>
                    {c.label}
                  </MenuItem>
                ))}
              </CustomTextField>
            )}

            <CustomTextField
              fullWidth
              label='Monto (Bs)'
              inputMode='decimal'
              value={monto}
              onChange={e => setMonto(e.target.value.replace(/[^0-9.]/g, ''))}
            />

            <CustomTextField
              fullWidth
              multiline
              rows={2}
              label='Para qué fue'
              placeholder='Ej: Taxi para llevar mercadería'
              value={descripcion}
              onChange={e => setDescripcion(e.target.value.slice(0, 500))}
            />

            {error && <Alert severity='error'>{error}</Alert>}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setAbierto(false)
              limpiar()
            }}
            disabled={crear.isPending}
          >
            Cancelar
          </Button>
          <Button
            variant='contained'
            onClick={guardar}
            disabled={crear.isPending}
            startIcon={crear.isPending ? <CircularProgress size={16} color='inherit' /> : null}
          >
            {crear.isPending ? 'Guardando...' : 'Registrar'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default CashExpensesPanel
