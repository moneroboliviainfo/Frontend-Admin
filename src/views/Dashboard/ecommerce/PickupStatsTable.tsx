'use client'

import { useState } from 'react'

import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import Typography from '@mui/material/Typography'
import Skeleton from '@mui/material/Skeleton'
import Alert from '@mui/material/Alert'

import CustomTextField from '@core/components/mui/TextField'
import tableStyles from '@core/styles/table.module.css'
import { usePickupStats } from '@/hooks/useBranchTransfers'
import { useBranchContext } from '@/contexts/BranchContext'

const today = new Date()
const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)

const toInput = (date: Date) => date.toISOString().split('T')[0]

const PickupStatsTable = () => {
  const [from, setFrom] = useState(toInput(firstOfMonth))
  const [to, setTo] = useState(toInput(today))

  // El informe es de ADMIN/SUPERVISOR, pero el encargado tambien ve Inicio:
  // sin la guarda le pediria al backend algo que le va a negar.
  const { isAdmin } = useBranchContext()

  const { data, isLoading, isError } = usePickupStats(from, to, isAdmin)

  const rows = data || []

  if (!isAdmin) return null

  return (
    <Card>
      <CardHeader
        title='Retiros de pedidos'
        subheader='Cuántos pedidos entre sucursales terminó retirando el cliente. Sirve para decidir dónde conviene cobrar un adelanto.'
      />

      <Box className='flex flex-wrap justify-end gap-4 px-6 pb-4'>
        <CustomTextField
          type='date'
          label='Desde'
          value={from}
          onChange={e => setFrom(e.target.value)}
          className='max-sm:is-full sm:is-[200px]'
        />
        <CustomTextField
          type='date'
          label='Hasta'
          value={to}
          onChange={e => setTo(e.target.value)}
          className='max-sm:is-full sm:is-[200px]'
        />
      </Box>

      <Divider />

      {isError ? (
        <Box sx={{ p: 4 }}>
          <Alert severity='error'>Error al cargar la estadística.</Alert>
        </Box>
      ) : isLoading ? (
        <Box sx={{ p: 6 }}>
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} height={44} sx={{ mb: 1 }} />
          ))}
        </Box>
      ) : rows.length === 0 ? (
        <Box sx={{ p: 8, textAlign: 'center' }}>
          <Typography color='text.secondary'>No hubo pedidos recibidos en ese rango</Typography>
        </Box>
      ) : (
        <div className='overflow-x-auto'>
          <table className={tableStyles.table}>
            <thead>
              <tr>
                <th>Recorrido</th>
                <th>Llegaron</th>
                <th>Los retiraron</th>
                <th>No vinieron</th>
                <th>Esperando</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => {
                // El porcentaje es lo que decide si conviene cobrar por adelantado
                const rate = row.received > 0 ? Math.round((row.pickedUp / row.received) * 100) : 0

                return (
                  <tr key={`${row.sourceBranch.id}-${row.destinationBranch.id}`}>
                    <td>
                      <Typography variant='body2' className='font-medium'>
                        {row.sourceBranch.name} → {row.destinationBranch.name}
                      </Typography>
                    </td>
                    <td>
                      <Typography variant='body2'>{row.received}</Typography>
                    </td>
                    <td>
                      <Box className='flex items-center gap-2'>
                        <Typography variant='body2'>{row.pickedUp}</Typography>
                        <Chip
                          label={`${rate}%`}
                          size='small'
                          variant='tonal'
                          color={rate >= 80 ? 'success' : rate >= 50 ? 'warning' : 'error'}
                        />
                      </Box>
                    </td>
                    <td>
                      <Typography variant='body2' color={row.notPickedUp > 0 ? 'error.main' : 'inherit'}>
                        {row.notPickedUp}
                      </Typography>
                      {row.notPickedUp > 0 && (
                        <Typography variant='caption' color='text.secondary'>
                          {row.notPickedUpMarked} avisaron · {row.notPickedUpExpired} vencieron
                        </Typography>
                      )}
                    </td>
                    <td>
                      <Typography variant='body2' color='text.secondary'>
                        {row.waiting}
                      </Typography>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

export default PickupStatsTable
