'use client'

// Facturas emitidas antes para esta orden (reemisiones).
//
// Se extrajo de SaleDetailsModal con el cuerpo intacto. Las props llevan los
// mismos nombres que tenian las variables alli, asi el JSX no se toco: las
// acciones y las reglas de quien puede hacer que siguen viviendo en el modal.

import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Typography from '@mui/material/Typography'

import type { Order } from '@/types/api/sales'
import { formatDate } from './orderFormatters'

type Props = {
  order: Order

}

const OrderPreviousInvoices = ({ order }: Props) => {
  // El padre ya comprueba que haya facturas anteriores; esto lo hace valido por
  // si solo y le da a TypeScript la certeza de que la lista existe
  if (!order.facturasAnteriores?.length) return null

  return (
    <Card variant='outlined'>
      <CardContent>
        <Typography variant='h6' className='mb-4 text-textPrimary'>
          Facturas Anteriores
        </Typography>
        <Box className='flex flex-col gap-3'>
          {order.facturasAnteriores.map(factura => (
            <Box
              key={factura.id}
              className='flex items-center justify-between gap-3 p-3 rounded'
              sx={{ border: '1px solid', borderColor: 'divider' }}
            >
              <Box>
                <Typography variant='body2' className='font-semibold'>
                  Factura #{factura.numeroFactura} · Bs. {parseFloat(factura.montoTotal).toFixed(2)}
                </Typography>
                <Typography variant='caption' color='text.secondary'>
                  {formatDate(factura.fechaEmision)} · {factura.nombreRazonSocial} ({factura.numeroDocumento})
                </Typography>
              </Box>
              <Chip
                label={factura.estado}
                size='small'
                variant='tonal'
                color={factura.estado === 'ANULADA' ? 'error' : 'warning'}
              />
            </Box>
          ))}
        </Box>
      </CardContent>
    </Card>
  )
}

export default OrderPreviousInvoices
