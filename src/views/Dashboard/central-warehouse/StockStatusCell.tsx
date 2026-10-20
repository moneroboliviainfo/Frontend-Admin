'use client'

import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'

// Debajo de este numero la talla se marca como stock bajo
const LOW_STOCK_LIMIT = 5

// Tres estados: sin stock (rojo), stock bajo (naranja) y normal (verde, solo el numero)
const StockStatusCell = ({ stock }: { stock: number }) => {
  const status =
    stock === 0
      ? { color: 'error' as const, text: 'Sin stock' }
      : stock < LOW_STOCK_LIMIT
        ? { color: 'warning' as const, text: 'Stock bajo' }
        : { color: 'success' as const, text: null }

  return (
    <Box className='flex items-center gap-2'>
      <Chip label={stock} size='small' variant='tonal' color={status.color} />
      {/* span y no Typography: el tema pinta de gris todo Typography dentro de AccordionDetails */}
      {status.text && (
        <Box component='span' className='font-bold whitespace-nowrap' sx={{ color: `${status.color}.main` }}>
          {status.text}
        </Box>
      )}
    </Box>
  )
}

export default StockStatusCell
