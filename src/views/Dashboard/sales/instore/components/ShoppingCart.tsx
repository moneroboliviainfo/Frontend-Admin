import React from 'react'

import {
  Card,
  CardContent,
  Typography,
  Button,
  IconButton,
  Box,
  Paper,
  Alert,
  CircularProgress
} from '@mui/material'

import type { CartItem, RepriceResponse, Order } from '@/types/api/sales'

interface CartItemLocal extends CartItem {
  variantInfo?: any
}

interface ShoppingCartProps {
  cartItems: CartItemLocal[]
  orderData: Order | null
  repriceData: RepriceResponse | null
  currentStep: string
  isLoading: boolean
  onClearCart: () => void
  onRemoveItem: (variantId: number) => void
  onUpdateQuantity: (variantId: number, quantity: number) => void
  onProceedToPayment: () => void
  isEditingOrder?: boolean
  editingOrderId?: number | null

  // variantId -> unidades ya pagadas al encargar el pedido. La venta de retiro
  // tiene que llevarlas todas: no se pueden sacar ni reducir.
  paidQuantities?: Record<number, number>
}

const ShoppingCart: React.FC<ShoppingCartProps> = ({
  cartItems,
  orderData,
  repriceData,
  currentStep,
  isLoading,
  onClearCart,
  onRemoveItem,
  onUpdateQuantity,
  paidQuantities = {},
  onProceedToPayment,
  isEditingOrder = false,
  editingOrderId = null
}) => {
  const formatCurrency = (amount: number | string) => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount

    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(numAmount)
  }

  const calculateTotal = () => {
    if (repriceData) {
      return parseFloat(repriceData.total)
    }

    return cartItems.reduce((sum, item) => {
      const variantInfo = item.variantInfo
      const price = variantInfo?.price || 0

      return sum + price * item.quantity
    }, 0)
  }

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', maxHeight: '100%' }}>
      <Box sx={{ p: 3, borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant='h6' color={isEditingOrder ? 'warning' : 'primary'} fontWeight='bold'>
              {isEditingOrder ? 'EDITANDO ORDEN' : 'CARRITO'}
            </Typography>
            {isEditingOrder && editingOrderId && (
              <Typography variant='caption' color='warning.main' fontWeight='medium'>
                Orden #{editingOrderId}
              </Typography>
            )}
            {orderData && !isEditingOrder && (
              <Typography variant='caption' color='text.secondary'>
                Orden #{orderData.id}
              </Typography>
            )}
          </Box>
          <IconButton onClick={onClearCart} color='error' disabled={isLoading}>
            <span>🗑️</span>
          </IconButton>
        </Box>
      </Box>

      <CardContent sx={{ flex: 1, overflow: 'auto', p: 2, minHeight: 0 }}>
        {cartItems.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
            <Typography sx={{ fontSize: '3rem', mb: 2, opacity: 0.5 }}>🛒</Typography>
            <Typography variant='h6'>Carrito vacío</Typography>
            <Typography variant='body2' sx={{ mt: 1 }}>
              Agrega productos del catálogo
            </Typography>
          </Box>
        ) : (
          <Box>
            {cartItems.map(item => {
              const variantInfo = item.variantInfo
              const repriceItem = repriceData?.items.find(ri => ri.variantId === item.variantId)

              return (
                <Card key={item.variantId} sx={{ mb: 1.5 }}>
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant='body2' fontWeight='bold'>
                          {variantInfo?.displayName || 'Producto'}
                        </Typography>
                        <Typography variant='caption' color='text.secondary' fontSize='0.7rem'>
                          {variantInfo?.size} | {variantInfo?.color?.name}
                        </Typography>
                        {!!paidQuantities[item.variantId] && (
                          <Typography variant='caption' color='success.main' fontSize='0.7rem' display='block'>
                            {paidQuantities[item.variantId]} ya pagada(s) en el pedido
                          </Typography>
                        )}
                      </Box>
                      {currentStep === 'BUILDING_CART' && !paidQuantities[item.variantId] && (
                        <IconButton
                          size='small'
                          color='error'
                          onClick={() => onRemoveItem(item.variantId)}
                          disabled={isLoading}
                          sx={{ p: 0.5 }}
                        >
                          <span style={{ fontSize: '0.9rem' }}>🗑️</span>
                        </IconButton>
                      )}
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
                      {currentStep === 'BUILDING_CART' ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <IconButton
                            size='small'
                            onClick={() => onUpdateQuantity(item.variantId, item.quantity - 1)}
                            disabled={isLoading || item.quantity <= (paidQuantities[item.variantId] || 0)}
                            sx={{ p: 0.5 }}
                          >
                            <span style={{ fontSize: '0.8rem' }}>➖</span>
                          </IconButton>
                          <Typography variant='body2' fontWeight='bold' sx={{ minWidth: 24, textAlign: 'center' }}>
                            {item.quantity}
                          </Typography>
                          <IconButton
                            size='small'
                            onClick={() => onUpdateQuantity(item.variantId, item.quantity + 1)}
                            disabled={isLoading}
                            sx={{ p: 0.5 }}
                          >
                            <span style={{ fontSize: '0.8rem' }}>➕</span>
                          </IconButton>
                        </Box>
                      ) : (
                        <Typography variant='body2' fontWeight='bold'>
                          Cant: {item.quantity}
                        </Typography>
                      )}
                      <Box sx={{ textAlign: 'right' }}>
                        <Typography variant='caption' color='text.secondary' display='block' fontSize='0.65rem'>
                          {repriceItem
                            ? formatCurrency(repriceItem.unit_price)
                            : variantInfo?.price
                              ? formatCurrency(variantInfo.price)
                              : '-'}{' '}
                          c/u
                        </Typography>
                        <Typography variant='body1' color='primary' fontWeight='bold'>
                          {repriceItem
                            ? formatCurrency(repriceItem.totalPrice)
                            : variantInfo?.price
                              ? formatCurrency(variantInfo.price * item.quantity)
                              : '-'}
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              )
            })}
          </Box>
        )}
      </CardContent>

      {cartItems.length > 0 && (
        <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
          <Paper sx={{ p: 1.5, mb: 1.5, bgcolor: 'action.hover' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant='body1' fontWeight='bold'>
                Total:
              </Typography>
              <Typography variant='h6' fontWeight='bold' color='primary'>
                {repriceData ? `Bs ${calculateTotal().toFixed(2)}` : `Bs ${calculateTotal().toFixed(2)}`}
              </Typography>
            </Box>
            {!repriceData && (
              <Typography
                variant='caption'
                color='text.secondary'
                sx={{ display: 'block', mt: 0.5, textAlign: 'right', fontSize: '0.65rem' }}
              >
                *Estimado (sujeto a verificación)
              </Typography>
            )}
          </Paper>
          {currentStep === 'BUILDING_CART' ? (
            <Button
              variant='contained'
              fullWidth
              size='medium'
              onClick={onProceedToPayment}
              disabled={cartItems.length === 0 || isLoading}
              startIcon={isLoading ? <CircularProgress size={18} color='inherit' /> : <span>✓</span>}
              sx={{ py: 1 }}
              color={isEditingOrder ? 'warning' : 'primary'}
            >
              {isLoading ? 'Procesando...' : isEditingOrder ? 'Confirmar Cambios' : 'Proceder al pago'}
            </Button>
          ) : (
            <Alert severity='info' sx={{ py: 0.5 }}>
              <Typography variant='caption'>
                {currentStep === 'VERIFYING_STOCK' && 'Verificando disponibilidad...'}
                {currentStep === 'ORDER_CREATED' &&
                  (isEditingOrder ? 'Listo para confirmar cambios' : 'Orden creada, seleccione método de pago')}
                {currentStep === 'PAYMENT' && (isEditingOrder ? 'Actualizando orden...' : 'Procesando pago...')}
              </Typography>
            </Alert>
          )}
        </Box>
      )}
    </Card>
  )
}

export default ShoppingCart
