'use client'

// Productos de la orden, con el desglose de donde sacar cada prenda.
//
// Solo lectura: recibe la orden y la dibuja. Se extrajo de SaleDetailsModal tal
// cual estaba, sin tocar condiciones ni formato.

import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Paper from '@mui/material/Paper'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'

import type { Order } from '@/types/api/sales'

const OrderItemsTable = ({ order }: { order: Order }) => {
  return (
    <Card variant='outlined'>
      <CardContent>
        <Typography variant='h6' className='mb-4 text-textPrimary'>
          Productos de la Orden
        </Typography>

        <TableContainer component={Paper} variant='outlined'>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell width='220px'>Imagen</TableCell>
                <TableCell>Producto</TableCell>
                <TableCell align='center'>Cantidad</TableCell>
                <TableCell align='right'>Precio Unit.</TableCell>
                <TableCell align='right'>Descuento</TableCell>
                <TableCell align='right'>Total</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {order.items.map(item => (
                <TableRow key={item.id} hover>
                  <TableCell>
                    <Box className='w-48 h-48 bg-gray-100 rounded-xl flex items-center justify-center overflow-hidden border-2 border-gray-300 shadow-lg'>
                      {item.variant?.productColor?.multimedia?.[0] ? (
                        <img
                          src={item.variant.productColor.multimedia[0]}
                          alt={item.variant.productColor.product?.name || 'Producto'}
                          className='w-full h-full object-cover'
                        />
                      ) : (
                        <Box className='w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center'>
                          <Typography variant='h2' className='text-gray-400'>
                            📦
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  </TableCell>

                  <TableCell>
                    <Typography variant='body1' className='font-bold text-textPrimary'>
                      {item.variant?.productColor?.product?.name || 'Producto sin nombre'}
                    </Typography>
                    {item.variant?.productColor?.product?.description && (
                      <Typography variant='body2' color='text.secondary' className='block mt-1'>
                        {item.variant.productColor.product.description}
                      </Typography>
                    )}
                    <Box className='flex gap-3 mt-2'>
                      {item.variant?.productColor?.color && (
                        <Box className='flex items-center gap-1'>
                          <Typography variant='caption' className='text-textSecondary font-medium'>
                            Color:
                          </Typography>
                          <Chip
                            label={item.variant.productColor.color.name}
                            size='small'
                            variant='tonal'
                            sx={{
                              height: 20,
                              fontSize: '0.75rem',
                              fontWeight: 600
                            }}
                          />
                        </Box>
                      )}
                      {item.variant?.size && (
                        <Box className='flex items-center gap-1'>
                          <Typography variant='caption' className='text-textSecondary font-medium'>
                            Talla:
                          </Typography>
                          <Chip
                            label={item.variant.size.name}
                            size='small'
                            variant='tonal'
                            sx={{
                              height: 20,
                              fontSize: '0.75rem',
                              fontWeight: 600
                            }}
                          />
                        </Box>
                      )}
                    </Box>
                  </TableCell>

                  <TableCell align='center'>
                    <Chip
                      label={`x${item.quantity}`}
                      color='primary'
                      variant='tonal'
                      sx={{
                        fontWeight: 700,
                        fontSize: '0.875rem'
                      }}
                    />

                    {/* De donde sacar la prenda al despachar. Lo reparte el
                        back (primero deposito, lo que falte del piso) y se
                        muestra tal cual: es lo que tiene que hacer quien
                        arma el paquete */}
                    {(!!item.fromWarehouse || !!item.fromSalesFloor) && (
                      <Box className='flex flex-col items-center gap-1 mt-2'>
                        {!!item.fromWarehouse && (
                          <Chip
                            label={`Bodega: ${item.fromWarehouse}`}
                            size='small'
                            variant='tonal'
                            color='info'
                            sx={{ height: 20, fontSize: '0.7rem', fontWeight: 600 }}
                          />
                        )}
                        {!!item.fromSalesFloor && (
                          <Chip
                            label={`Tienda: ${item.fromSalesFloor}`}
                            size='small'
                            variant='tonal'
                            color='warning'
                            sx={{ height: 20, fontSize: '0.7rem', fontWeight: 600 }}
                          />
                        )}
                      </Box>
                    )}

                    {/* Si falta stock, el paquete no se puede completar */}
                    {!!item.missingQuantity && (
                      <Chip
                        label={`Faltan ${item.missingQuantity}`}
                        size='small'
                        color='error'
                        sx={{ height: 20, fontSize: '0.7rem', fontWeight: 700, mt: 1 }}
                      />
                    )}
                  </TableCell>

                  <TableCell align='right'>
                    <Typography variant='body1' className='font-semibold'>
                      Bs. {parseFloat(item.unit_price).toFixed(2)}
                    </Typography>
                  </TableCell>

                  <TableCell align='right'>
                    {item.discountValue > 0 ? (
                      <Chip
                        label={`-${item.discountValue}%`}
                        color='error'
                        variant='tonal'
                        size='small'
                        sx={{ fontWeight: 600 }}
                      />
                    ) : (
                      <Typography variant='body2' color='text.secondary'>
                        —
                      </Typography>
                    )}
                  </TableCell>

                  <TableCell align='right'>
                    <Typography variant='h6' className='font-bold text-primary'>
                      Bs. {parseFloat(item.totalPrice).toFixed(2)}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}

              <TableRow sx={{ bgcolor: 'action.hover' }}>
                <TableCell colSpan={5} align='right' sx={{ borderBottom: 'none', py: 3 }}>
                  <Typography variant='h6' className='font-bold text-textPrimary'>
                    Total de la Orden:
                  </Typography>
                </TableCell>
                <TableCell align='right' sx={{ borderBottom: 'none', py: 3 }}>
                  <Typography variant='h5' className='font-bold text-primary'>
                    Bs. {parseFloat(order.totalPrice).toFixed(2)}
                  </Typography>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  )
}

export default OrderItemsTable
