import React, { useState, useMemo } from 'react'

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
  Divider,
  Collapse,
  Chip,
  TextField
} from '@mui/material'
import dayjs from 'dayjs'
import 'dayjs/locale/es'

import type { Order, BillingInfo, Branch, Factura, Cafc, EventoSignificativo } from '@/types/api/sales'
import {
  useBranches,
  useFacturar,
  useCafcs,
  useFacturarContingencia,
  useEventosSignificativosBySucursal
} from '@/hooks/useSales'
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
  // Estados generales
  const [selectedBranchId, setSelectedBranchId] = useState<number | ''>('')
  const [facturaError, setFacturaError] = useState<string>('')
  const [facturaSuccess, setFacturaSuccess] = useState<boolean>(false)
  const [facturaData, setFacturaData] = useState<Factura | null>(null)

  // Estados para contingencia
  const [showContingencia, setShowContingencia] = useState(false)
  const [selectedCafcId, setSelectedCafcId] = useState<number | ''>('')
  const [selectedEventoId, setSelectedEventoId] = useState<number | ''>('')
  const [fechaEmisionContingencia, setFechaEmisionContingencia] = useState<string>('')

  // Hooks
  const { data: branchesData, isLoading: isLoadingBranches } = useBranches()
  const facturarMutation = useFacturar()
  const facturarContingenciaMutation = useFacturarContingencia()
  const { data: cafcsData } = useCafcs()

  const orderId = isEditingOrder ? editingOrderId : orderData?.id
  const billingInfo = billing || orderData?.billing

  // Obtener sucursal seleccionada
  const selectedBranch = useMemo(() => {
    if (!branchesData || !selectedBranchId) return null

    return branchesData.find((b: Branch) => b.id === selectedBranchId)
  }, [branchesData, selectedBranchId])

  // Eventos significativos disponibles para la sucursal seleccionada
  const { data: eventosData, isLoading: isLoadingEventos } = useEventosSignificativosBySucursal(
    selectedBranch?.codigoSucursal ?? null,
    0, // codigoPuntoVenta
    showContingencia && !!selectedBranch
  )

  // Evento seleccionado
  const selectedEvento = useMemo(() => {
    if (!eventosData || !selectedEventoId) return null

    return eventosData.find((e: EventoSignificativo) => e.id === selectedEventoId)
  }, [eventosData, selectedEventoId])

  // CAFCs disponibles (con números restantes)
  const availableCafcs = useMemo(() => {
    if (!cafcsData) return []

    return cafcsData.filter((cafc: Cafc) => parseInt(cafc.ultimoNumero) < parseInt(cafc.numeroFinal))
  }, [cafcsData])

  // Handlers
  const handleCloseWithoutInvoice = () => {
    resetState()
    onAccept()
  }

  const resetState = () => {
    setSelectedBranchId('')
    setFacturaError('')
    setFacturaSuccess(false)
    setFacturaData(null)
    setShowContingencia(false)
    setSelectedCafcId('')
    setSelectedEventoId('')
    setFechaEmisionContingencia('')
  }

  // Datos base para facturación (usados en normal y contingencia)
  const getFacturaBaseData = () => ({
    branchId: selectedBranchId as number,
    tipoFacturaDocumento: 1,
    codigoDocumentoSector: 1,
    codigoMoneda: 1,
    tipoCambio: 1,
    nombreRazonSocial: billingInfo?.name || '',
    numeroDocumento: billingInfo?.ci || '',
    complemento: billingInfo?.complemento || '',
    codigoTipoDocumentoIdentidad: billingInfo?.codigoTipoDocumentoIdentidad || 1,
    usuario: 'MoneroAdmin',
    ...(billingInfo?.email ? { emails: [billingInfo.email] } : {}),
    descuentoAdicional: 0
  })

  // Handler factura normal
  const handleEmitirFactura = async () => {
    if (!orderId || !selectedBranchId || !billingInfo) {
      setFacturaError('Faltan datos para emitir la factura')

      return
    }

    setFacturaError('')

    facturarMutation.mutate(
      { orderId: orderId as number, data: getFacturaBaseData() },
      {
        onSuccess: response => {
          setFacturaSuccess(true)
          setFacturaData(response.factura)
        },
        onError: (error: any) => {
          setFacturaError(error?.response?.data?.message || 'Error al emitir la factura')
        }
      }
    )
  }

  // Handler factura contingencia
  const handleEmitirContingencia = async () => {
    if (
      !orderId ||
      !selectedBranchId ||
      !billingInfo ||
      !selectedEventoId ||
      !selectedCafcId ||
      !fechaEmisionContingencia
    ) {
      setFacturaError('Faltan datos para emitir la factura por contingencia')

      return
    }

    const selectedCafc = cafcsData?.find((c: Cafc) => c.id === selectedCafcId)

    if (!selectedCafc) {
      setFacturaError('CAFC no encontrado')

      return
    }

    if (!selectedEvento) {
      setFacturaError('Evento significativo no encontrado')

      return
    }

    // Validar que la fecha de emisión esté dentro del rango del evento
    const fechaEmision = dayjs(fechaEmisionContingencia)
    const fechaInicio = dayjs(selectedEvento.fechaHoraInicioEvento)
    const fechaFin = dayjs(selectedEvento.fechaHoraFinEvento)

    if (fechaEmision.isBefore(fechaInicio) || fechaEmision.isAfter(fechaFin)) {
      setFacturaError('La fecha de emisión debe estar dentro del rango del evento significativo')

      return
    }

    setFacturaError('')

    const contingenciaData = {
      ...getFacturaBaseData(),
      cafc: selectedCafc.codigo,
      eventoSignificativoId: selectedEventoId as number,
      fechaEmision: dayjs(fechaEmisionContingencia).format('YYYY-MM-DDTHH:mm:ss'),
      numeroTarjeta: null,
      montoGiftCard: 0
    }

    facturarContingenciaMutation.mutate(
      { orderId: orderId as number, data: contingenciaData },
      {
        onSuccess: factura => {
          setFacturaSuccess(true)
          setFacturaData(factura)
        },
        onError: (error: any) => {
          setFacturaError(error?.response?.data?.message || 'Error al emitir factura por contingencia')
        }
      }
    )
  }

  const handlePrintAgain = () => {
    if (facturaData) {
      printInvoice(facturaData)
    }
  }

  const handleCloseAfterInvoice = () => {
    resetState()
    onAccept()
  }

  // Dialog para modo edición
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

  const isPending = facturarMutation.isPending || facturarContingenciaMutation.isPending

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
            <Alert severity={facturaData.codigoEmision === 2 ? 'warning' : 'success'} sx={{ mb: 2 }}>
              {facturaData.codigoEmision === 2 ? (
                <>
                  Factura por contingencia generada
                  <Chip label='PENDIENTE ENVÍO' size='small' color='warning' sx={{ ml: 1 }} />
                </>
              ) : (
                '¡Factura emitida exitosamente!'
              )}
            </Alert>

            <Paper
              variant='outlined'
              sx={{ p: 2, bgcolor: facturaData.codigoEmision === 2 ? 'warning.lighter' : 'success.lighter' }}
            >
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
                <Typography
                  variant='body2'
                  fontWeight='bold'
                  color={facturaData.estado === 'PENDIENTE' ? 'warning.main' : 'success.main'}
                >
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
              {facturaData.codigoEmision === 2 && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant='caption' color='text.secondary'>
                    Tipo
                  </Typography>
                  <Typography variant='body2' fontWeight='bold' color='warning.main'>
                    CONTINGENCIA
                  </Typography>
                </Box>
              )}
              <Divider sx={{ my: 1 }} />
              <Typography variant='caption' color='text.secondary' sx={{ wordBreak: 'break-all', fontSize: '9px' }}>
                CUF: {facturaData.cuf}
              </Typography>
            </Paper>
          </Box>
        ) : (
          <>
            {/* Formulario de facturación */}
            <Typography variant='subtitle1' fontWeight='bold' sx={{ mb: 2 }}>
              Emitir Factura
            </Typography>

            {facturaError && (
              <Alert severity='error' sx={{ mb: 2 }}>
                {facturaError}
              </Alert>
            )}

            {/* Selector de sucursal */}
            <FormControl fullWidth size='small' sx={{ mb: 2 }}>
              <InputLabel>Sucursal *</InputLabel>
              <Select
                value={selectedBranchId}
                label='Sucursal *'
                onChange={e => {
                  setSelectedBranchId(e.target.value as number)
                  setSelectedEventoId('')
                  setFechaEmisionContingencia('')
                }}
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

            {/* Sección de contingencia */}
            <Collapse in={showContingencia}>
              <Paper variant='outlined' sx={{ p: 2, mb: 2, bgcolor: 'warning.lighter' }}>
                <Typography variant='subtitle2' fontWeight='bold' sx={{ mb: 2 }}>
                  Facturación por Contingencia
                </Typography>

                {/* Selector de CAFC */}
                <FormControl fullWidth size='small' sx={{ mb: 2 }}>
                  <InputLabel>CAFC *</InputLabel>
                  <Select
                    value={selectedCafcId}
                    label='CAFC *'
                    onChange={e => setSelectedCafcId(e.target.value as number)}
                  >
                    {availableCafcs.map((cafc: Cafc) => (
                      <MenuItem key={cafc.id} value={cafc.id}>
                        {cafc.codigo} ({cafc.ultimoNumero}/{cafc.numeroFinal})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {/* Selector de Evento Significativo */}
                <FormControl fullWidth size='small' sx={{ mb: 2 }} disabled={isLoadingEventos || !selectedBranchId}>
                  <InputLabel>Evento Significativo *</InputLabel>
                  <Select
                    value={selectedEventoId}
                    label='Evento Significativo *'
                    onChange={e => {
                      setSelectedEventoId(e.target.value as number)
                      setFechaEmisionContingencia('')
                    }}
                  >
                    {isLoadingEventos ? (
                      <MenuItem value=''>Cargando eventos...</MenuItem>
                    ) : !eventosData || eventosData.length === 0 ? (
                      <MenuItem value=''>No hay eventos significativos disponibles</MenuItem>
                    ) : (
                      eventosData.map((evento: EventoSignificativo) => (
                        <MenuItem key={evento.id} value={evento.id}>
                          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                            <Typography variant='body2' fontWeight='medium'>
                              {evento.descripcion}
                            </Typography>
                            <Typography variant='caption' color='text.secondary'>
                              Desde: {dayjs(evento.fechaHoraInicioEvento).format('DD/MM/YYYY HH:mm')} - Hasta:{' '}
                              {dayjs(evento.fechaHoraFinEvento).format('DD/MM/YYYY HH:mm')}
                            </Typography>
                          </Box>
                        </MenuItem>
                      ))
                    )}
                  </Select>
                </FormControl>

                {/* Fecha de Emisión */}
                {selectedEvento && (
                  <Box sx={{ mb: 1 }}>
                    <TextField
                      fullWidth
                      size='small'
                      type='datetime-local'
                      label='Fecha de Emisión *'
                      value={fechaEmisionContingencia}
                      onChange={e => {
                        const value = e.target.value
                        const fecha = dayjs(value)
                        const inicio = dayjs(selectedEvento.fechaHoraInicioEvento)
                        const fin = dayjs(selectedEvento.fechaHoraFinEvento)

                        // Solo permitir si está dentro del rango
                        if (fecha.isAfter(inicio) || fecha.isSame(inicio)) {
                          if (fecha.isBefore(fin) || fecha.isSame(fin)) {
                            setFechaEmisionContingencia(value)
                          }
                        }
                      }}
                      InputLabelProps={{ shrink: true }}
                      inputProps={{
                        min: dayjs(selectedEvento.fechaHoraInicioEvento).format('YYYY-MM-DDTHH:mm'),
                        max: dayjs(selectedEvento.fechaHoraFinEvento).format('YYYY-MM-DDTHH:mm'),
                        step: 60
                      }}
                      helperText={`Rango válido: ${dayjs(selectedEvento.fechaHoraInicioEvento).format('DD/MM/YYYY HH:mm')} - ${dayjs(selectedEvento.fechaHoraFinEvento).format('DD/MM/YYYY HH:mm')}`}
                    />
                  </Box>
                )}
              </Paper>
            </Collapse>

            {/* Preview datos factura */}
            <Paper variant='outlined' sx={{ p: 2, bgcolor: 'action.hover' }}>
              <Typography variant='caption' color='text.secondary' sx={{ mb: 1, display: 'block' }}>
                Datos de la Factura
              </Typography>

              <Box sx={{ mb: 1.5 }}>
                <Typography variant='caption' color='text.secondary'>
                  Tipo de Factura
                </Typography>
                <Typography variant='body2' fontWeight='medium'>
                  FACTURA CON DERECHO A CRÉDITO FISCAL
                </Typography>
              </Box>

              <Box sx={{ mb: 1.5 }}>
                <Typography variant='caption' color='text.secondary'>
                  Documento Sector
                </Typography>
                <Typography variant='body2' fontWeight='medium'>
                  FACTURA COMPRA-VENTA
                </Typography>
              </Box>

              <Box sx={{ mb: 1.5 }}>
                <Typography variant='caption' color='text.secondary'>
                  Moneda
                </Typography>
                <Typography variant='body2' fontWeight='medium'>
                  BOLIVIANOS (BOB)
                </Typography>
              </Box>

              <Divider sx={{ my: 1.5 }} />

              <Box sx={{ mb: 1.5 }}>
                <Typography variant='caption' color='text.secondary'>
                  Razón Social
                </Typography>
                <Typography variant='body2' fontWeight='medium'>
                  {billingInfo?.name || '-'}
                </Typography>
              </Box>

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
              Imprimir Factura
            </Button>
            <Button variant='contained' color='success' fullWidth size='large' onClick={handleCloseAfterInvoice}>
              Finalizar
            </Button>
          </>
        ) : (
          <>
            {/* Botones de facturación */}
            <Box sx={{ display: 'flex', gap: 2, width: '100%' }}>
              <Button
                variant='contained'
                color='primary'
                onClick={showContingencia ? handleEmitirContingencia : handleEmitirFactura}
                disabled={
                  !selectedBranchId ||
                  isPending ||
                  !billingInfo?.ci ||
                  (showContingencia && (!selectedEventoId || !selectedCafcId || !fechaEmisionContingencia))
                }
                startIcon={isPending ? <CircularProgress size={20} color='inherit' /> : <span>📄</span>}
                fullWidth
                size='large'
              >
                {isPending ? 'Emitiendo...' : showContingencia ? 'Emitir Contingencia' : 'Emitir Factura'}
              </Button>
            </Box>

            {/* Toggle contingencia */}
            <Button
              variant='text'
              color='warning'
              onClick={() => setShowContingencia(!showContingencia)}
              fullWidth
              size='small'
            >
              {showContingencia ? 'Cancelar contingencia' : '⚠️ Facturar por Contingencia'}
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
