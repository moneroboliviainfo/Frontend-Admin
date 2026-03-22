import React from 'react'

import { Dialog, DialogTitle, DialogContent, DialogActions, Typography, Button, Box } from '@mui/material'

import type { Order } from '@/types/api/sales'

interface SuccessDialogProps {
  open: boolean
  orderData: Order | null
  onAccept: () => void
  onViewSales: () => void
  isEditingOrder?: boolean
  editingOrderId?: number | null
}

const SuccessDialog: React.FC<SuccessDialogProps> = ({
  open,
  orderData,
  onAccept,
  onViewSales,
  isEditingOrder = false,
  editingOrderId = null
}) => {
  return (
    <Dialog open={open} maxWidth='xs' fullWidth disableEscapeKeyDown>
      <DialogTitle>
        <Box sx={{ textAlign: 'center' }}>
          <Typography sx={{ fontSize: '3.5rem', mb: 1 }}>✅</Typography>
          <Typography variant='h5' fontWeight='bold' color={isEditingOrder ? 'warning.main' : 'success.main'}>
            {isEditingOrder ? '¡Orden Actualizada!' : '¡Venta Completada!'}
          </Typography>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ textAlign: 'center', py: 2 }}>
          <Typography variant='body1' color='text.secondary' gutterBottom>
            {isEditingOrder ? 'La orden se actualizó exitosamente' : 'La venta se realizó exitosamente'}
          </Typography>
          {(orderData || editingOrderId) && (
            <Typography variant='h6' fontWeight='bold' color='primary' sx={{ mt: 2 }}>
              Orden #{isEditingOrder ? editingOrderId : orderData?.id}
            </Typography>
          )}
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 3, gap: 2, flexDirection: 'column' }}>
        <Button variant='contained' fullWidth size='large' onClick={onAccept} color={isEditingOrder ? 'warning' : 'primary'}>
          {isEditingOrder ? 'Ver Detalles de la Orden' : 'Aceptar'}
        </Button>
        {!isEditingOrder && (
          <Button variant='outlined' fullWidth size='large' onClick={onViewSales}>
            Ver lista de ventas
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}

export default SuccessDialog
