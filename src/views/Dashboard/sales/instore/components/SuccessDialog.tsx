import React, { useState } from 'react'

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Button,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  IconButton,
  Alert,
  Paper,
  Divider
} from '@mui/material'

import type { Order, BillingInfo, Branch, Factura } from '@/types/api/sales'
import { useBranches, useFacturar } from '@/hooks/useSales'
import { printInvoice } from '@/utils/invoicePrinter'

interface SuccessDialogProps {
  open: boolean
  orderData: Order | null
  onAccept: () => void
  onViewSales: () => void
  isEditingOrder?: boolean
  editingOrderId?: number | null
  billing?: BillingInfo
}

const SuccessDialog: React.FC<SuccessDialogProps> = ({
  open,
  orderData,
  onAccept,
  onViewSales,
  isEditingOrder = false,
  editingOrderId = null,
  billing
}) => {
  const [selectedBranchId, setSelectedBranchId] = useState<number | ''>('')
  const [facturaError, setFacturaError] = useState<string>('')
  const [facturaSuccess, setFacturaSuccess] = useState<boolean>(false)
  const [facturaData, setFacturaData] = useState<Factura | null>(null)

  // Hooks para facturación
  const { data: branchesData, isLoading: isLoadingBranches } = useBranches()
  const facturarMutation = useFacturar()

  const orderId = isEditingOrder ? editingOrderId : orderData?.id

  // Obtener billing info del orden si no viene como prop
  const billingInfo = billing || orderData?.billing

  // Handler para cerrar sin emitir factura
  const handleCloseWithoutInvoice = () => {
    setSelectedBranchId('')
    setFacturaError('')
    setFacturaSuccess(false)
    setFacturaData(null)
    onAccept()
  }

  // Handler para emitir factura
  const handleEmitirFactura = async () => {
    if (!orderId || !selectedBranchId || !billingInfo) {
      setFacturaError('Faltan datos para emitir la factura')

      return
    }

    setFacturaError('')

    const facturaRequestData = {
      branchId: selectedBranchId as number,
      tipoFacturaDocumento: 1,
      codigoDocumentoSector: 1,
      codigoMoneda: 1,
      tipoCambio: 1,
      nombreRazonSocial: billingInfo.name || '',
      numeroDocumento: billingInfo.ci,
      complemento: billingInfo.complemento || '',
      codigoTipoDocumentoIdentidad: billingInfo.codigoTipoDocumentoIdentidad,
      usuario: 'MoneroAdmin',
      emails: billingInfo.email ? [billingInfo.email] : [],
      descuentoAdicional: 0
    }

    facturarMutation.mutate(
      { orderId: orderId as number, data: facturaRequestData },
      {
        onSuccess: response => {
          setFacturaSuccess(true)
          setFacturaData(response.factura)

          // Abrir ventana de impresión automáticamente
          printInvoice(response.factura)
        },
        onError: (error: any) => {
          setFacturaError(error?.response?.data?.message || 'Error al emitir la factura')
        }
      }
    )
  }

  // Handler para imprimir factura nuevamente
  const handlePrintAgain = () => {
    if (facturaData) {
      printInvoice(facturaData)
    }
  }

  // Handler para cerrar después de facturar
  const handleCloseAfterInvoice = () => {
    setSelectedBranchId('')
    setFacturaError('')
    setFacturaSuccess(false)
    setFacturaData(null)
    onAccept()
  }

  // Si es modo edición, mostrar el dialog simple original
  if (isEditingOrder) {
    return (
      <Dialog open={open} maxWidth='xs' fullWidth disableEscapeKeyDown>
        <DialogTitle>
          <Box sx={{ textAlign: 'center' }}>
            <Typography sx={{ fontSize: '3.5rem', mb: 1 }}>✅</Typography>
            <Typography variant='h5' fontWeight='bold' color='warning.main'>
              ¡Orden Actualizada!
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ textAlign: 'center', py: 2 }}>
            <Typography variant='body1' color='text.secondary' gutterBottom>
              La orden se actualizó exitosamente
            </Typography>
            {editingOrderId && (
              <Typography variant='h6' fontWeight='bold' color='primary' sx={{ mt: 2 }}>
                Orden #{editingOrderId}
              </Typography>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3, gap: 2, flexDirection: 'column' }}>
          <Button variant='contained' fullWidth size='large' onClick={onAccept} color='warning'>
            Ver Detalles de la Orden
          </Button>
        </DialogActions>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} maxWidth='sm' fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box sx={{ textAlign: 'center', flex: 1 }}>
          <Typography sx={{ fontSize: '3.5rem', mb: 1 }}>✅</Typography>
          <Typography variant='h5' fontWeight='bold' color='success.main'>
            ¡Venta Completada!
          </Typography>
        </Box>
        <IconButton onClick={handleCloseWithoutInvoice} size='small' sx={{ position: 'absolute', right: 8, top: 8 }}>
          <i className='tabler-x' style={{ fontSize: '20px' }} />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Typography variant='body1' color='text.secondary' gutterBottom>
            La venta se realizó exitosamente
          </Typography>
          {orderId && (
            <Typography variant='h6' fontWeight='bold' color='primary'>
              Orden #{orderId}
            </Typography>
          )}
        </Box>

        {facturaSuccess && facturaData ? (
          <Box>
            <Alert severity='success' sx={{ mb: 2 }}>
              ¡Factura emitida exitosamente!
            </Alert>

            {/* Información de la factura emitida */}
            <Paper variant='outlined' sx={{ p: 2, bgcolor: 'success.lighter' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant='caption' color='text.secondary'>
                  Nro. Factura
                </Typography>
                <Typography variant='body2' fontWeight='bold'>
                  {facturaData.numeroFactura}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant='caption' color='text.secondary'>
                  Estado
                </Typography>
                <Typography variant='body2' fontWeight='bold' color='success.main'>
                  {facturaData.estado}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant='caption' color='text.secondary'>
                  Monto Total
                </Typography>
                <Typography variant='body2' fontWeight='bold'>
                  Bs {facturaData.montoTotal.toFixed(2)}
                </Typography>
              </Box>
              <Divider sx={{ my: 1 }} />
              <Typography variant='caption' color='text.secondary' sx={{ wordBreak: 'break-all', fontSize: '9px' }}>
                CUF: {facturaData.cuf}
              </Typography>
            </Paper>
          </Box>
        ) : (
          <>
            {/* Título */}
            <Typography variant='subtitle1' fontWeight='bold' sx={{ mb: 2 }}>
              Emitir Factura
            </Typography>

            {facturaError && (
              <Alert severity='error' sx={{ mb: 2 }}>
                {facturaError}
              </Alert>
            )}

            {/* Sucursal - único campo editable */}
            <FormControl fullWidth size='small' sx={{ mb: 3 }}>
              <InputLabel>Sucursal *</InputLabel>
              <Select
                value={selectedBranchId}
                label='Sucursal *'
                onChange={e => setSelectedBranchId(e.target.value as number)}
                disabled={isLoadingBranches}
              >
                {isLoadingBranches ? (
                  <MenuItem value=''>Cargando...</MenuItem>
                ) : (
                  branchesData
                    ?.filter((b: Branch) => b.active)
                    .map((branch: Branch) => (
                      <MenuItem key={branch.id} value={branch.id}>
                        {branch.alias}
                      </MenuItem>
                    ))
                )}
              </Select>
            </FormControl>

            {/* Preview de datos de factura */}
            <Paper variant='outlined' sx={{ p: 2, bgcolor: 'action.hover' }}>
              <Typography variant='caption' color='text.secondary' sx={{ mb: 1, display: 'block' }}>
                Datos de la Factura
              </Typography>

              {/* Tipo de Factura */}
              <Box sx={{ mb: 1.5 }}>
                <Typography variant='caption' color='text.secondary'>
                  Tipo de Factura
                </Typography>
                <Typography variant='body2' fontWeight='medium'>
                  FACTURA CON DERECHO A CRÉDITO FISCAL
                </Typography>
              </Box>

              {/* Documento Sector */}
              <Box sx={{ mb: 1.5 }}>
                <Typography variant='caption' color='text.secondary'>
                  Documento Sector
                </Typography>
                <Typography variant='body2' fontWeight='medium'>
                  FACTURA COMPRA-VENTA
                </Typography>
              </Box>

              {/* Moneda */}
              <Box sx={{ mb: 1.5 }}>
                <Typography variant='caption' color='text.secondary'>
                  Moneda
                </Typography>
                <Typography variant='body2' fontWeight='medium'>
                  BOLIVIANOS (BOB)
                </Typography>
              </Box>

              <Divider sx={{ my: 1.5 }} />

              {/* Razón Social */}
              <Box sx={{ mb: 1.5 }}>
                <Typography variant='caption' color='text.secondary'>
                  Razón Social
                </Typography>
                <Typography variant='body2' fontWeight='medium'>
                  {billingInfo?.name || '-'}
                </Typography>
              </Box>

              {/* Documento */}
              <Box sx={{ display: 'flex', gap: 3, mb: 1.5 }}>
                <Box sx={{ flex: 1 }}>
                  <Typography variant='caption' color='text.secondary'>
                    Nro. Documento
                  </Typography>
                  <Typography variant='body2' fontWeight='medium'>
                    {billingInfo?.ci || '-'}
                  </Typography>
                </Box>
                {billingInfo?.complemento && (
                  <Box>
                    <Typography variant='caption' color='text.secondary'>
                      Complemento
                    </Typography>
                    <Typography variant='body2' fontWeight='medium'>
                      {billingInfo.complemento}
                    </Typography>
                  </Box>
                )}
              </Box>

              {/* Email */}
              <Box>
                <Typography variant='caption' color='text.secondary'>
                  Email
                </Typography>
                <Typography variant='body2' fontWeight='medium'>
                  {billingInfo?.email || 'Sin email registrado'}
                </Typography>
              </Box>
            </Paper>
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 3, gap: 2, flexDirection: 'column' }}>
        {facturaSuccess && facturaData ? (
          <>
            <Button
              variant='contained'
              color='primary'
              onClick={handlePrintAgain}
              startIcon={<span>🖨️</span>}
              fullWidth
              size='large'
            >
              Imprimir Nuevamente
            </Button>
            <Button variant='contained' color='success' fullWidth size='large' onClick={handleCloseAfterInvoice}>
              Finalizar
            </Button>
          </>
        ) : (
          <>
            <Button
              variant='contained'
              color='primary'
              onClick={handleEmitirFactura}
              disabled={!selectedBranchId || facturarMutation.isPending || !billingInfo?.ci}
              startIcon={facturarMutation.isPending ? <CircularProgress size={20} color='inherit' /> : <span>📄</span>}
              fullWidth
              size='large'
            >
              {facturarMutation.isPending ? 'Emitiendo...' : 'Emitir Factura'}
            </Button>
            <Button variant='outlined' fullWidth size='large' onClick={onViewSales}>
              Ver lista de ventas
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  )
}

export default SuccessDialog
