'use client'

// Factura SIAT de la orden, con las acciones de imprimir, anular y revertir.
//
// Se extrajo de SaleDetailsModal con el cuerpo intacto. Las props llevan los
// mismos nombres que tenian las variables alli, asi el JSX no se toco: las
// acciones y las reglas de quien puede hacer que siguen viviendo en el modal.

import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Grid from '@mui/material/Grid2'
import Typography from '@mui/material/Typography'

import type { Order, OrderFacturaDetalle } from '@/types/api/sales'
import { formatDate } from './orderFormatters'

type Props = {
  order: Order
  canAnular: boolean
  canRevertir: boolean
  handlePrintInvoice: () => void
  setShowAnularConfirm: (v: boolean) => void
  setShowRevertirConfirm: (v: boolean) => void
}

const OrderInvoiceCard = ({ order, canAnular, canRevertir, handlePrintInvoice, setShowAnularConfirm, setShowRevertirConfirm }: Props) => {
  // El padre ya lo envuelve en {order.factura && ...}; esto lo hace valido por
  // si solo y le da a TypeScript la certeza de que la factura existe
  if (!order.factura) return null

  return (
    <Card variant='outlined'>
      <CardContent>
        <Box className='flex justify-between items-start mb-4'>
          <Typography variant='h6' className='text-textPrimary'>
            Factura SIAT
          </Typography>
          <Chip
            label={order.factura.estado}
            color={
              order.factura.estado === 'VALIDADA' || order.factura.estado === 'REVERTIDA'
                ? 'success'
                : order.factura.estado === 'PENDIENTE'
                  ? 'warning'
                  : order.factura.estado === 'ANULADA'
                    ? 'error'
                    : 'default'
            }
            variant='tonal'
            size='small'
          />
        </Box>
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Typography variant='overline' className='text-textSecondary text-xs font-medium block'>
              Número de Factura
            </Typography>
            <Typography variant='body1' className='font-bold mt-1'>
              #{order.factura.numeroFactura}
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Typography variant='overline' className='text-textSecondary text-xs font-medium block'>
              Fecha de Emisión
            </Typography>
            <Typography variant='body1' className='font-medium mt-1'>
              {formatDate(order.factura.fechaEmision)}
            </Typography>
          </Grid>
          <Grid size={{ xs: 12 }}>
            <Typography variant='overline' className='text-textSecondary text-xs font-medium block'>
              CUF
            </Typography>
            <Typography variant='body2' className='font-mono mt-1' sx={{ wordBreak: 'break-all' }}>
              {order.factura.cuf}
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Typography variant='overline' className='text-textSecondary text-xs font-medium block'>
              Razón Social
            </Typography>
            <Typography variant='body1' className='font-semibold mt-1'>
              {order.factura.nombreRazonSocial}
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Typography variant='overline' className='text-textSecondary text-xs font-medium block'>
              Documento
            </Typography>
            <Typography variant='body1' className='font-medium mt-1'>
              {order.factura.numeroDocumento}
              {order.factura.complemento && `-${order.factura.complemento}`}
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Typography variant='overline' className='text-textSecondary text-xs font-medium block'>
              Monto Total
            </Typography>
            <Typography variant='h6' className='font-bold text-primary mt-1'>
              Bs. {parseFloat(order.factura.montoTotal).toFixed(2)}
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Typography variant='overline' className='text-textSecondary text-xs font-medium block'>
              Tipo de Emisión
            </Typography>
            <Typography variant='body1' className='font-medium mt-1'>
              {order.factura.codigoEmision === '1' ? 'En línea' : 'Contingencia (fuera de línea)'}
            </Typography>
          </Grid>
          {order.factura.codigoRecepcion && (
            <Grid size={{ xs: 12 }}>
              <Typography variant='overline' className='text-textSecondary text-xs font-medium block'>
                Código Recepción SIAT
              </Typography>
              <Typography variant='body2' className='font-mono mt-1'>
                {order.factura.codigoRecepcion}
              </Typography>
            </Grid>
          )}
          {order.factura.detalles && order.factura.detalles.length > 0 && (
            <Grid size={{ xs: 12 }}>
              <Typography variant='overline' className='text-textSecondary text-xs font-medium block mb-2'>
                Detalle de Factura
              </Typography>
              <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'rgba(0,0,0,0.04)' }}>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '12px', fontWeight: 600 }}>Producto</th>
                      <th style={{ padding: '8px 12px', textAlign: 'center', fontSize: '12px', fontWeight: 600 }}>Cant.</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: '12px', fontWeight: 600 }}>P. Unit.</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: '12px', fontWeight: 600 }}>Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.factura.detalles.map((detalle: OrderFacturaDetalle, index: number) => (
                      <tr key={detalle.id || index} style={{ borderTop: '1px solid rgba(0,0,0,0.08)' }}>
                        <td style={{ padding: '8px 12px', fontSize: '13px' }}>{detalle.descripcion}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'center', fontSize: '13px' }}>{parseFloat(detalle.cantidad).toFixed(0)}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: '13px' }}>Bs. {parseFloat(detalle.precioUnitario).toFixed(2)}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: '13px', fontWeight: 600 }}>Bs. {parseFloat(detalle.subTotal).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Box>
            </Grid>
          )}
          <Grid size={{ xs: 12 }}>
            <Box sx={{ display: 'flex', gap: 2, flexDirection: 'column' }}>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Button
                  variant='contained'
                  color='primary'
                  onClick={handlePrintInvoice}
                  startIcon={<i className='tabler-printer' />}
                  fullWidth
                >
                  Imprimir Factura
                </Button>
                {canAnular && (
                  <Button
                    variant='outlined'
                    color='error'
                    onClick={() => setShowAnularConfirm(true)}
                    startIcon={<i className='tabler-x' />}
                    fullWidth
                  >
                    Anular
                  </Button>
                )}
                {canRevertir && (
                  <Button
                    variant='outlined'
                    color='warning'
                    onClick={() => setShowRevertirConfirm(true)}
                    startIcon={<i className='tabler-restore' />}
                    fullWidth
                  >
                    Revertir Anulación
                  </Button>
                )}
              </Box>
              {order.factura.estado === 'ANULADA' && order.status === 'sent' && (
                <Alert severity='info'>
                  Esta factura fue anulada. Puede revertir la anulación para restaurarla (solo una vez).
                </Alert>
              )}
              {order.factura.estado === 'ANULADA' && order.status === 'cancelled_for_edit' && (
                <Alert severity='warning'>
                  Esta orden fue editada. La factura anulada pertenece a la orden original. La nueva orden debe
                  ser facturada por separado.
                </Alert>
              )}
            </Box>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  )
}

export default OrderInvoiceCard
