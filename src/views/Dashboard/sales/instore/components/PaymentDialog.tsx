import React, { useState, useMemo, useEffect } from 'react'

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Button,
  Box,
  Paper,
  Card,
  CardContent,
  CircularProgress,
  LinearProgress,
  TextField,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  InputAdornment
} from '@mui/material'
import Grid from '@mui/material/Grid2'

import type { Order, RepriceResponse, GenerateQRResponse, BillingInfo, TipoDocumentoIdentidad } from '@/types/api/sales'
import { useSearchBilling, useTiposDocumentoIdentidad, useVerificarNit } from '@/hooks/useSales'

interface PaymentMethod {
  id: string
  name: string
  icon: string
  color: string
}

interface PaymentDialogProps {
  open: boolean
  orderData: Order | null
  repriceData: RepriceResponse | null
  selectedPayment: string
  timeRemaining: number
  timerProgress: number
  currentStep: string
  isLoading: boolean
  paymentMethods: PaymentMethod[]
  qrData: GenerateQRResponse | null // Datos del QR generado
  onClose: () => void
  onPaymentSelect: (paymentType: 'cash' | 'card' | 'qr') => void
  onConfirmPayment: () => void
  onCancelOrder: () => void
  isEditingOrder?: boolean
  editingOrderId?: number | null
  billing: BillingInfo
  onBillingChange: (billing: BillingInfo) => void
}

const PaymentDialog: React.FC<PaymentDialogProps> = ({
  open,
  orderData,
  repriceData,
  selectedPayment,
  timeRemaining,
  timerProgress,
  currentStep,
  isLoading,
  paymentMethods,
  qrData,
  onClose,
  onPaymentSelect,
  onConfirmPayment,
  onCancelOrder,
  isEditingOrder = false,
  editingOrderId = null,
  billing,
  onBillingChange
}) => {
  const [cashReceived, setCashReceived] = useState<string>('')
  const [searchCi, setSearchCi] = useState<string>('')
  const [showBillingResults, setShowBillingResults] = useState<boolean>(false)
  const [nitValidationStatus, setNitValidationStatus] = useState<'idle' | 'valid' | 'invalid'>('idle')
  const [nitValidationMessage, setNitValidationMessage] = useState<string>('')

  // Limpiar estados locales cuando se cierra el modal (excepto billing que se limpia en clearCart)
  useEffect(() => {
    if (!open) {
      setCashReceived('')
      setSearchCi('')
      setShowBillingResults(false)
      setNitValidationStatus('idle')
      setNitValidationMessage('')
    }
  }, [open])

  // Obtener tipos de documento del SIAT
  const { data: tiposDocumentoData, isLoading: isLoadingTiposDocumento } = useTiposDocumentoIdentidad()

  // Mutation para verificar NIT
  const verificarNitMutation = useVerificarNit()

  // Extraer lista de tipos de documento
  const tiposDocumento: TipoDocumentoIdentidad[] = useMemo(() => {
    if (tiposDocumentoData?.parametrica?.[0]?.payload) {
      return tiposDocumentoData.parametrica[0].payload
    }

    return []
  }, [tiposDocumentoData])

  // Obtener nombre corto del tipo de documento seleccionado
  const tipoDocumentoNombre = useMemo(() => {
    const tipo = tiposDocumento.find(t => t.codigoClasificador === billing.codigoTipoDocumentoIdentidad)

    if (tipo) {
      // Extraer solo la sigla (antes del guión)
      const match = tipo.descripcion.match(/^(\w+)/)

      return match ? match[1] : 'documento'
    }

    return 'documento'
  }, [tiposDocumento, billing.codigoTipoDocumentoIdentidad])

  // Validar si el tipo seleccionado requiere solo números (CI=1, NIT=5)
  const requiresOnlyNumbers = billing.codigoTipoDocumentoIdentidad === 1 || billing.codigoTipoDocumentoIdentidad === 5
  const isNitSelected = billing.codigoTipoDocumentoIdentidad === 5

  // Validar formato del CI/NIT
  const isCiFormatValid = useMemo(() => {
    if (!billing.ci.trim()) return true // Vacío es válido (se valida por separado)
    if (requiresOnlyNumbers) {
      return /^\d+$/.test(billing.ci)
    }

    return true // Otros documentos pueden tener letras
  }, [billing.ci, requiresOnlyNumbers])

  // Función para ejecutar búsqueda manual
  const handleSearchBilling = () => {
    if (billing.ci.length >= 5 && isCiFormatValid) {
      setSearchCi(billing.ci)
      setShowBillingResults(true)
    }
  }

  // Limpiar formulario cuando se borra el CI
  const handleCiChange = (value: string) => {
    // Si requiere solo números, filtrar letras
    const newValue = requiresOnlyNumbers ? value.replace(/\D/g, '') : value

    // Si se está borrando (el nuevo valor es más corto o vacío)
    if (newValue.length < billing.ci.length || newValue === '') {
      // Limpiar los otros campos del formulario
      onBillingChange({
        ci: newValue,
        name: '',
        phone: '',
        email: '',
        complemento: '',
        codigoTipoDocumentoIdentidad: billing.codigoTipoDocumentoIdentidad
      })
      setShowBillingResults(false)
      setSearchCi('')
    } else {
      onBillingChange({
        ...billing,
        ci: newValue
      })
    }
  }

  // Verificar NIT cuando cambia y es válido
  useEffect(() => {
    if (isNitSelected && billing.ci.length >= 5 && /^\d+$/.test(billing.ci)) {
      setNitValidationStatus('idle')
      const timer = setTimeout(() => {
        verificarNitMutation.mutate(parseInt(billing.ci), {
          onSuccess: data => {
            if (data.success && data.data.RespuestaVerificarNit.transaccion) {
              setNitValidationStatus('valid')
              setNitValidationMessage(data.data.RespuestaVerificarNit.mensajesList[0]?.descripcion || 'NIT válido')
            } else {
              setNitValidationStatus('invalid')
              setNitValidationMessage(
                data.data.RespuestaVerificarNit.mensajesList[0]?.descripcion || 'NIT no válido'
              )
            }
          },
          onError: () => {
            setNitValidationStatus('invalid')
            setNitValidationMessage('Error al verificar NIT')
          }
        })
      }, 500)

      return () => clearTimeout(timer)
    } else {
      setNitValidationStatus('idle')
      setNitValidationMessage('')
    }
  }, [billing.ci, isNitSelected])

  // Búsqueda de datos de facturación (solo cuando searchCi cambia - búsqueda manual)
  const { data: billingData, isFetching: isSearchingBilling } = useSearchBilling(searchCi)

  // Handler para seleccionar un resultado de billing
  const handleSelectBilling = (data: typeof billingData) => {
    if (data) {
      onBillingChange({
        ...billing,
        ci: data.ci,
        name: data.name || '',
        phone: data.phone || '',
        email: data.email || '',
        complemento: data.complemento || '',
        codigoTipoDocumentoIdentidad: data.codigoTipoDocumentoIdentidad || billing.codigoTipoDocumentoIdentidad
      })
      setShowBillingResults(false)
      setSearchCi('')
    }
  }

  const handleBillingFieldChange = (field: keyof BillingInfo, value: string) => {
    onBillingChange({
      ...billing,
      [field]: value
    })
  }

  const handleTipoDocumentoChange = (codigo: number) => {
    onBillingChange({
      ci: '',
      name: '',
      phone: '',
      email: '',
      complemento: '',
      codigoTipoDocumentoIdentidad: codigo
    })
    setNitValidationStatus('idle')
    setNitValidationMessage('')
    setShowBillingResults(false)
    setSearchCi('')
  }

  // Validación completa del billing
  const isBillingValid =
    billing.ci.trim().length > 0 && isCiFormatValid && (isNitSelected ? nitValidationStatus === 'valid' : true)

  const totalToPay = useMemo(() => {
    if (orderData) {
      return typeof orderData.totalPrice === 'string'
        ? parseFloat(orderData.totalPrice)
        : orderData.totalPrice
    }

    if (repriceData) {
      return parseFloat(repriceData.total)
    }

    return 0
  }, [orderData, repriceData])

  const cashChange = useMemo(() => {
    const received = parseFloat(cashReceived)

    if (isNaN(received) || received <= 0) return null

    return received - totalToPay
  }, [cashReceived, totalToPay])

  useEffect(() => {
    if (!open || selectedPayment !== 'cash') {
      setCashReceived('')
    }
  }, [open, selectedPayment])

  const formatCurrency = (amount: number | string) => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount

    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(numAmount)
  }

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60

    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth='sm'
      fullWidth
      disableEscapeKeyDown={currentStep === 'ORDER_CREATED'}
    >
      <DialogTitle>
        <Typography variant='h5' fontWeight='bold'>
          {isEditingOrder
            ? `Confirmar Edición - Orden #${orderData?.inherited_id || editingOrderId}`
            : orderData
              ? `Método de Pago - Orden #${orderData.inherited_id || orderData.id}`
              : 'Seleccione Método de Pago'}
          {timeRemaining > 0 && orderData && !isEditingOrder && (
            <Paper sx={{ p: 2, mb: 3, bgcolor: 'warning.lighter', border: 1, borderColor: 'warning.main' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant='body1' fontWeight='bold' color='warning.dark'>
                  ⏱️ Tiempo restante: {formatTime(timeRemaining)}
                </Typography>
                <Typography variant='caption' color='text.secondary'>
                  {timeRemaining < 60 ? '¡Cancela antes del tiempo limite!' : 'Stock reservado'}
                </Typography>
              </Box>
              <LinearProgress
                variant='determinate'
                value={timerProgress}
                sx={{
                  height: 8,
                  borderRadius: 4,
                  '& .MuiLinearProgress-bar': {
                    bgcolor: timeRemaining < 60 ? 'error.main' : 'warning.main'
                  }
                }}
              />
            </Paper>
          )}
        </Typography>
      </DialogTitle>
      <DialogContent>
        <Paper
          sx={{ p: 3, mb: 3, textAlign: 'center', bgcolor: isEditingOrder ? 'warning.lighter' : 'primary.lighter' }}
        >
          <Typography variant='h4' color={isEditingOrder ? 'warning' : 'primary'} fontWeight='bold'>
            {isEditingOrder ? 'Nuevo Total: ' : 'Total a pagar: '}
            {orderData
              ? formatCurrency(orderData.totalPrice)
              : repriceData
                ? `Bs ${parseFloat(repriceData.total).toFixed(2)}`
                : 'Bs 0.00'}
          </Typography>
        </Paper>

        {!orderData && !isEditingOrder && (
          <Paper sx={{ p: 2, mb: 3, bgcolor: 'action.hover' }}>
            <Typography variant='subtitle2' fontWeight='bold' sx={{ mb: 2 }}>
              Datos de Facturación
            </Typography>

            {/* Select Tipo de Documento */}
            <FormControl fullWidth size='small' sx={{ mb: 1.5 }}>
              <InputLabel>Tipo de Documento *</InputLabel>
              <Select
                value={billing.codigoTipoDocumentoIdentidad}
                label='Tipo de Documento *'
                onChange={e => handleTipoDocumentoChange(e.target.value as number)}
                disabled={isLoadingTiposDocumento}
              >
                {isLoadingTiposDocumento ? (
                  <MenuItem value={1}>Cargando...</MenuItem>
                ) : (
                  tiposDocumento.map(tipo => (
                    <MenuItem key={tipo.codigoClasificador} value={tipo.codigoClasificador}>
                      {tipo.descripcion}
                    </MenuItem>
                  ))
                )}
              </Select>
            </FormControl>

            <Box sx={{ position: 'relative', mb: 1.5 }}>
              <TextField
                fullWidth
                size='small'
                label={isNitSelected ? 'NIT *' : 'Número de Documento *'}
                value={billing.ci}
                onChange={e => handleCiChange(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleSearchBilling()
                  }
                }}
                required
                error={(billing.ci.length > 0 && !isCiFormatValid) || nitValidationStatus === 'invalid'}
                helperText={
                  !isCiFormatValid
                    ? 'Solo se permiten números'
                    : nitValidationStatus === 'invalid'
                      ? `✗ ${nitValidationMessage}`
                      : nitValidationStatus === 'valid'
                        ? `✓ ${nitValidationMessage}`
                        : billing.ci.length >= 5
                          ? `Presione Enter o click en buscar`
                          : undefined
                }
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position='end'>
                        {isSearchingBilling || verificarNitMutation.isPending ? (
                          <CircularProgress size={18} />
                        ) : (
                          <IconButton
                            size='small'
                            onClick={handleSearchBilling}
                            disabled={billing.ci.length < 5 || !isCiFormatValid}
                            sx={{ p: 0.5 }}
                          >
                            <i className='tabler-search' style={{ fontSize: '18px' }} />
                          </IconButton>
                        )}
                      </InputAdornment>
                    )
                  },
                  formHelperText: {
                    sx: {
                      color:
                        nitValidationStatus === 'valid'
                          ? 'success.main'
                          : nitValidationStatus === 'invalid'
                            ? 'error.main'
                            : undefined
                    }
                  }
                }}
                placeholder={requiresOnlyNumbers ? 'Solo números' : 'Número de documento'}
              />
              {/* Lista de resultados de búsqueda */}
              {showBillingResults && billingData && !isSearchingBilling && (
                <Paper
                  elevation={3}
                  sx={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    zIndex: 10,
                    mt: 0.5,
                    maxHeight: 200,
                    overflow: 'auto'
                  }}
                >
                  <Box
                    sx={{
                      p: 1.5,
                      cursor: 'pointer',
                      '&:hover': { bgcolor: 'action.hover' },
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <Box onClick={() => handleSelectBilling(billingData)} sx={{ flex: 1 }}>
                      <Typography variant='body2' fontWeight='bold'>
                        {billingData.name || 'Sin nombre'}
                      </Typography>
                      <Typography variant='caption' color='text.secondary'>
                        {tipoDocumentoNombre}: {billingData.ci}
                        {billingData.complemento && ` - ${billingData.complemento}`}
                        {billingData.phone && ` • Tel: ${billingData.phone}`}
                      </Typography>
                    </Box>
                    <IconButton
                      size='small'
                      onClick={e => {
                        e.stopPropagation()
                        setShowBillingResults(false)
                        setSearchCi('')
                      }}
                      sx={{ p: 0.25 }}
                    >
                      <i className='tabler-x' style={{ fontSize: '14px' }} />
                    </IconButton>
                  </Box>
                </Paper>
              )}
              {/* Mensaje cuando no hay resultados */}
              {showBillingResults && !billingData && !isSearchingBilling && searchCi.length >= 5 && (
                <Paper
                  elevation={3}
                  sx={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    zIndex: 10,
                    mt: 0.5,
                    p: 1.5,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <Typography variant='body2' color='text.secondary'>
                    No se encontró registro para este {tipoDocumentoNombre}
                  </Typography>
                  <IconButton
                    size='small'
                    onClick={() => {
                      setShowBillingResults(false)
                      setSearchCi('')
                    }}
                    sx={{ p: 0.25 }}
                  >
                    <i className='tabler-x' style={{ fontSize: '14px' }} />
                  </IconButton>
                </Paper>
              )}
            </Box>
            <TextField
              fullWidth
              size='small'
              label='Nombre'
              value={billing.name || ''}
              onChange={e => handleBillingFieldChange('name', e.target.value)}
              sx={{ mb: 1.5 }}
            />
            <Box sx={{ display: 'flex', gap: 1, mb: 1.5 }}>
              <TextField
                size='small'
                label='Teléfono'
                value={billing.phone || ''}
                onChange={e => handleBillingFieldChange('phone', e.target.value)}
                sx={{ flex: 1 }}
              />
              <TextField
                size='small'
                label='Complemento'
                value={billing.complemento || ''}
                onChange={e => handleBillingFieldChange('complemento', e.target.value)}
                sx={{ width: 120 }}
                placeholder='Ej: LP'
              />
            </Box>
            <TextField
              fullWidth
              size='small'
              label='Email'
              type='email'
              value={billing.email || ''}
              onChange={e => handleBillingFieldChange('email', e.target.value)}
            />
          </Paper>
        )}

        {!orderData && !isEditingOrder && (
          <>
            <Typography variant='subtitle2' fontWeight='bold' sx={{ mb: 2 }}>
              Seleccione Método de Pago
            </Typography>
            <Grid container spacing={2}>
              {paymentMethods.map(method => (
                <Grid size={{ xs: 6 }} key={method.id}>
                  <Card
                    sx={{
                      cursor: isBillingValid && !isLoading ? 'pointer' : 'not-allowed',
                      border: 2,
                      borderColor: selectedPayment === method.id ? method.color : 'divider',
                      textAlign: 'center',
                      transition: 'all 0.2s',
                      opacity: isBillingValid ? 1 : 0.5,
                      '&:hover': {
                        borderColor: isBillingValid ? method.color : 'divider',
                        boxShadow: isBillingValid ? 2 : 0
                      }
                    }}
                    onClick={() => isBillingValid && !isLoading && onPaymentSelect(method.id as 'cash' | 'card' | 'qr')}
                  >
                    <CardContent>
                      <Box sx={{ fontSize: '3rem', mb: 1 }}>{method.icon}</Box>
                      <Typography variant='h6' fontWeight='medium'>
                        {method.name}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
            {!isBillingValid && (
              <Typography variant='caption' color='error' sx={{ mt: 2, display: 'block', textAlign: 'center' }}>
                {!billing.ci.trim()
                  ? 'Ingrese el número de documento para seleccionar método de pago'
                  : !isCiFormatValid
                    ? 'El formato del documento no es válido'
                    : isNitSelected && nitValidationStatus !== 'valid'
                      ? 'El NIT debe ser verificado y válido'
                      : 'Complete los datos de facturación'}
              </Typography>
            )}
          </>
        )}

        {orderData && selectedPayment && (
          <Paper sx={{ p: 3, mb: 2, bgcolor: 'action.hover' }}>
            <Typography variant='caption' color='text.secondary' display='block' gutterBottom>
              Método de pago seleccionado:
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ fontSize: '2rem' }}>{paymentMethods.find(m => m.id === selectedPayment)?.icon}</Box>
              <Typography variant='h6' fontWeight='bold'>
                {paymentMethods.find(m => m.id === selectedPayment)?.name}
              </Typography>
            </Box>
          </Paper>
        )}

        {/* Sección de pago con QR */}
        {selectedPayment === 'qr' && (
          <Paper sx={{ p: 4, mt: 3, textAlign: 'center', bgcolor: 'action.hover' }}>
            {qrData && qrData.qr ? (
              <>
                {/* Mostrar QR generado desde el backend (base64) */}
                <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                  <img
                    src={qrData.qr.startsWith('data:') ? qrData.qr : `data:image/png;base64,${qrData.qr}`}
                    alt='Código QR para pago'
                    style={{
                      width: '300px',
                      height: '300px',
                      objectFit: 'contain',
                      border: '2px solid #ddd',
                      borderRadius: '8px',
                      backgroundColor: 'white'
                    }}
                  />
                </Box>
                <Typography variant='h6' sx={{ mt: 2, mb: 1, fontWeight: 'bold' }}>
                  Escanea para pagar
                </Typography>
                <Typography variant='h5' color='primary' fontWeight='bold'>
                  {orderData && formatCurrency(orderData.totalPrice)}
                </Typography>

                <Box sx={{ mt: 2 }}>
                  <CircularProgress size={24} />
                  <Typography variant='body2' color='text.secondary' sx={{ mt: 1 }}>
                    Esperando confirmación de pago...
                  </Typography>
                </Box>
              </>
            ) : (
              <>
                {/* Mostrar mientras se genera el QR */}
                <CircularProgress size={60} />
                <Typography variant='h6' sx={{ mt: 2, fontWeight: 'bold' }}>
                  Generando código QR...
                </Typography>
              </>
            )}
          </Paper>
        )}

        {selectedPayment === 'cash' && (
          <Paper sx={{ p: 4, mt: 3, bgcolor: 'success.lighter' }}>
            <Box sx={{ textAlign: 'center', mb: 3 }}>
              <Typography sx={{ fontSize: '3rem', mb: 1 }}>💵</Typography>
              <Typography variant='h6' fontWeight='bold'>
                Pago en Efectivo
              </Typography>
            </Box>

            <TextField
              fullWidth
              label='Monto recibido (Bs)'
              type='number'
              value={cashReceived}
              onChange={e => setCashReceived(e.target.value)}
              placeholder='0.00'
              slotProps={{
                htmlInput: { min: 0, step: 0.01 }
              }}
              sx={{
                mb: 2,
                '& .MuiOutlinedInput-root': {
                  backgroundColor: 'white'
                }
              }}
            />

            {cashChange !== null && (
              <Alert
                severity={cashChange >= 0 ? 'success' : 'error'}
                sx={{ mt: 2 }}
                icon={cashChange >= 0 ? <span>💰</span> : <span>⚠️</span>}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                  <Typography variant='body1' fontWeight='bold'>
                    {cashChange >= 0 ? 'Cambio a devolver:' : 'Falta:'}
                  </Typography>
                  <Typography variant='h5' fontWeight='bold'>
                    Bs {Math.abs(cashChange).toFixed(2)}
                  </Typography>
                </Box>
              </Alert>
            )}
          </Paper>
        )}

        {selectedPayment === 'card' && (
          <Paper sx={{ p: 4, mt: 3, textAlign: 'center', bgcolor: 'info.lighter' }}>
            <Typography sx={{ fontSize: '4rem', mb: 2 }}>💳</Typography>
            <Typography variant='h6' fontWeight='bold'>
              Pago con Tarjeta
            </Typography>
          </Paper>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 3, gap: 2 }}>
        {isEditingOrder ? (
          <>
            {/* Modo edición*/}
            <Button onClick={onClose} variant='outlined' fullWidth disabled={isLoading}>
              Cancelar
            </Button>
            <Button
              variant='contained'
              color='warning'
              onClick={onConfirmPayment}
              disabled={isLoading}
              startIcon={isLoading ? <CircularProgress size={20} color='inherit' /> : <span>✓</span>}
              fullWidth
            >
              {isLoading ? 'Actualizando...' : 'Confirmar Cambios'}
            </Button>
          </>
        ) : !orderData ? (
          <Button onClick={onClose} variant='outlined' fullWidth>
            Cerrar
          </Button>
        ) : (
          <>
            {/* Botón Cancelar Orden */}
            <Button
              onClick={onCancelOrder}
              color='error'
              variant='outlined'
              disabled={isLoading || (currentStep === 'PAYMENT' && selectedPayment !== 'qr')}
              fullWidth
            >
              Cancelar Orden
            </Button>

            {/* Botón Confirmar Pago - Solo para efectivo y tarjeta */}
            {selectedPayment !== 'qr' && (
              <Button
                variant='contained'
                onClick={onConfirmPayment}
                disabled={!orderData || isLoading || (!!orderData && timeRemaining === 0)}
                startIcon={isLoading ? <CircularProgress size={20} color='inherit' /> : <span>💳</span>}
                fullWidth
              >
                {isLoading ? 'Procesando...' : 'Confirmar Pago'}
              </Button>
            )}
          </>
        )}
      </DialogActions>
    </Dialog>
  )
}

export default PaymentDialog
