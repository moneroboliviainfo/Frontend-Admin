'use client'

import { useState } from 'react'

import Box from '@mui/material/Box'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Typography from '@mui/material/Typography'

import tableStyles from '@core/styles/table.module.css'
import { useLowStock } from '@/hooks/useDashboard'

type Props = {
  warehouseId?: number
  onPick: (productName: string) => void
}

const LowStockPanel = ({ warehouseId, onPick }: Props) => {
  const [open, setOpen] = useState(false)

  // En la bodega el total de lowStock es su deposito: no hay piso de venta que lo mezcle.
  // El endpoint no pagina: devuelve la lista entera, por eso va en un modal con scroll.
  const { data } = useLowStock(warehouseId, !!warehouseId)

  const items = data || []

  if (items.length === 0) return null

  const pick = (productName: string) => {
    onPick(productName)
    setOpen(false)
  }

  return (
    <>
      <Box sx={{ px: 6, pb: 4 }}>
        <Alert
          severity='error'
          action={
            <Button color='inherit' size='small' onClick={() => setOpen(true)}>
              Ver listado
            </Button>
          }
        >
          {items.length === 1 ? '1 talla con stock crítico' : `${items.length} tallas con stock crítico`}
        </Alert>
      </Box>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth='sm' fullWidth>
        <DialogTitle>
          Stock crítico en la bodega
          <Typography variant='body2' color='text.secondary' sx={{ mt: 1 }}>
            Tocá una prenda para buscarla en la tabla y reponerla
          </Typography>
        </DialogTitle>

        <DialogContent>
          <div className='overflow-x-auto'>
            <table className={tableStyles.table}>
              <thead>
                <tr>
                  <th>Prenda</th>
                  <th>En bodega</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => {
                  const productName = item.productColor?.product?.name || 'Producto'

                  return (
                    <tr
                      key={item.id}
                      onClick={() => pick(productName)}
                      style={{ cursor: 'pointer' }}
                      className='hover:bg-[var(--mui-palette-action-hover)]'
                    >
                      <td>
                        <Box className='flex items-center gap-2'>
                          <Box
                            sx={{
                              width: 14,
                              height: 14,
                              borderRadius: '50%',
                              bgcolor: item.productColor?.color?.code || '#000',
                              border: '1px solid',
                              borderColor: 'divider',
                              flexShrink: 0
                            }}
                          />
                          <Box>
                            <Typography variant='body2' className='font-medium'>
                              {productName}
                            </Typography>
                            <Typography variant='caption' color='text.secondary'>
                              {item.productColor?.color?.name} · Talla {item.size?.name}
                            </Typography>
                          </Box>
                        </Box>
                      </td>
                      <td>
                        <Chip
                          label={item.stock}
                          size='small'
                          variant='tonal'
                          color={item.stock === 0 ? 'error' : 'warning'}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </DialogContent>

        <DialogActions>
          <Button variant='contained' onClick={() => setOpen(false)}>
            Cerrar
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

export default LowStockPanel
