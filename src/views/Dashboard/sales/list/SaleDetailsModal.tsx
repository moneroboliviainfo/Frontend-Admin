'use client'

import { useState, useMemo, useEffect } from 'react'

import { useRouter } from 'next/navigation'

import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Grid from '@mui/material/Grid2'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Paper from '@mui/material/Paper'
import TextField from '@mui/material/TextField'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import Snackbar from '@mui/material/Snackbar'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Collapse from '@mui/material/Collapse'
import Divider from '@mui/material/Divider'
import dayjs from 'dayjs'
import 'dayjs/locale/es'

import { useQueryClient } from '@tanstack/react-query'

import {
  useCancelOrder,
  useSendOrder,
  useCancelOrderForEdit,
  useBranches,
  useFacturar,
  useCafcs,
  useFacturarContingencia,
  useAnularFactura,
  useRevertirAnulacion,
  useTiposDocumentoIdentidad,
  useSearchBilling,
  useVerificarNit,
  useGetOrder,
  useEventosSignificativosBySucursal
} from '@/hooks/useSales'
import { printInvoice } from '@/utils/invoicePrinter'
import type { Order, Branch, Cafc, Factura, BillingInfo, TipoDocumentoIdentidad, OrderFacturaDetalle, EventoSignificativo } from '@/types/api/sales'

interface SnackbarMessage {
  message: string
  severity: 'success' | 'error' | 'info' | 'warning'
  key: number
}

type OrderDetailsModalProps = {
  open: boolean
  onClose: () => void
  order: Order | null
}

const getEstadoColor = (estado: string): 'primary' | 'error' | 'success' | 'warning' => {
  switch (estado) {
    case 'pending':
      return 'warning'
    case 'cancelled':
      return 'error'
    case 'paid':
    case 'completed':
      return 'success'
    case 'confirmed':
      return 'primary'
    case 'sent':
      return 'primary'
    case 'expired':
      return 'error'
    case 'cancelled_for_edit':
      return 'warning'
    default:
      return 'primary'
  }
}

const getEstadoLabel = (estado: string): string => {
  const labels: Record<string, string> = {
    pending: 'Pendiente',
    cancelled: 'Cancelado',
    paid: 'Pagado',
    completed: 'Completado',
    confirmed: 'Confirmado',
    sent: 'Enviado',
    expired: 'Expirado',
    cancelled_for_edit: 'En Edición'
  }

  return labels[estado] || estado
}

const getPaymentLabel = (paymentType: string): string => {
  const labels: Record<string, string> = {
    cash: 'Efectivo',
    card: 'Tarjeta',
    qr: 'QR'
  }

  return labels[paymentType] || paymentType
}

const getTipoLabel = (tipo: string): string => {
  return tipo === 'in_store' ? 'En Tienda' : 'En Línea'
}

const formatDate = (dateString: string): string => {
  const date = new Date(dateString)

  return date.toLocaleDateString('es-BO', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const OrderDetailsModal = ({ open, onClose, order: orderProp }: OrderDetailsModalProps) => {
  const router = useRouter()
  const queryClient = useQueryClient()

  // Usar useGetOrder para poder refrescar los datos después de anular/revertir/facturar
  const { data: orderData, refetch: refetchOrder } = useGetOrder(orderProp?.id ?? null, open && !!orderProp?.id)

  // Usar los datos refrescados si existen, sino usar el prop original
  const order = orderData ?? orderProp

  const [dhlCode, setDhlCode] = useState('')
  const [showDhlInput, setShowDhlInput] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [showEditConfirm, setShowEditConfirm] = useState(false)
  const [snackPack, setSnackPack] = useState<SnackbarMessage[]>([])
  const [messageInfo, setMessageInfo] = useState<SnackbarMessage | undefined>(undefined)
  const [snackbarOpen, setSnackbarOpen] = useState(false)

  // Estados para facturación
  const [showFacturacion, setShowFacturacion] = useState(false)
  const [selectedBranchId, setSelectedBranchId] = useState<number | ''>('')
  const [facturaError, setFacturaError] = useState<string>('')
  const [facturaSuccess, setFacturaSuccess] = useState(false)
  const [facturaData, setFacturaData] = useState<Factura | null>(null)
  const [showContingencia, setShowContingencia] = useState(false)
  const [selectedCafcId, setSelectedCafcId] = useState<number | ''>('')
  const [selectedEventoId, setSelectedEventoId] = useState<number | ''>('')
  const [fechaEmisionContingencia, setFechaEmisionContingencia] = useState<string>('')

  // Estados para anular factura
  const [showAnularConfirm, setShowAnularConfirm] = useState(false)
  const [motivoAnulacion, setMotivoAnulacion] = useState<number>(1)

  // Estados para revertir anulación
  const [showRevertirConfirm, setShowRevertirConfirm] = useState(false)

  // Estado para confirmar emisión de factura
  const [showEmitirConfirm, setShowEmitirConfirm] = useState(false)

  // Estados para edición de datos de facturación
  const [editableBilling, setEditableBilling] = useState<BillingInfo>({
    ci: '',
    name: '',
    phone: '',
    email: '',
    complemento: '',
    codigoTipoDocumentoIdentidad: 1
  })

  const [nitValidationStatus, setNitValidationStatus] = useState<'idle' | 'valid' | 'invalid'>('idle')
  const [nitValidationMessage, setNitValidationMessage] = useState('')
  const [searchCi, setSearchCi] = useState('')
  const [showBillingResults, setShowBillingResults] = useState(false)

  const cancelOrderMutation = useCancelOrder()
  const sendOrderMutation = useSendOrder()
  const cancelForEditMutation = useCancelOrderForEdit()

  // Hooks de facturación
  const { data: branchesData, isLoading: isLoadingBranches } = useBranches()
  const facturarMutation = useFacturar()
  const facturarContingenciaMutation = useFacturarContingencia()
  const anularFacturaMutation = useAnularFactura()
  const revertirAnulacionMutation = useRevertirAnulacion()

  // Hooks para contingencia
  const { data: cafcsData } = useCafcs()

  // Hooks para edición de datos de facturación
  const { data: tiposDocumentoData } = useTiposDocumentoIdentidad()
  const { data: billingSearchData, isFetching: isSearchingBilling } = useSearchBilling(searchCi)
  const verificarNitMutation = useVerificarNit()

  // Extraer tipos de documento
  const tiposDocumento: TipoDocumentoIdentidad[] = useMemo(() => {
    if (tiposDocumentoData?.parametrica?.[0]?.payload) {
      return tiposDocumentoData.parametrica[0].payload
    }

    return []
  }, [tiposDocumentoData])

  // Verificar si el tipo de documento requiere solo números
  const requiresOnlyNumbers =
    editableBilling.codigoTipoDocumentoIdentidad === 1 || editableBilling.codigoTipoDocumentoIdentidad === 5

  const isNitSelected = editableBilling.codigoTipoDocumentoIdentidad === 5

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

  // CAFCs disponibles
  const availableCafcs = useMemo(() => {
    if (!cafcsData) return []

    return cafcsData.filter((cafc: Cafc) => parseInt(cafc.ultimoNumero) < parseInt(cafc.numeroFinal))
  }, [cafcsData])

  // Inicializar datos de facturación editables cuando se abre el modal
  useEffect(() => {
    if (open && order?.billing) {
      setEditableBilling({
        ci: order.billing.ci || '',
        name: order.billing.name || '',
        phone: order.billing.phone || '',
        email: order.billing.email || '',
        complemento: order.billing.complemento || '',
        codigoTipoDocumentoIdentidad: order.billing.codigoTipoDocumentoIdentidad || 1
      })
      setNitValidationStatus('idle')
      setNitValidationMessage('')
    }
  }, [open, order?.billing])

  // Verificar NIT automáticamente cuando se ingresa
  useEffect(() => {
    if (isNitSelected && editableBilling.ci.length >= 5 && /^\d+$/.test(editableBilling.ci)) {
      setNitValidationStatus('idle')

      const timer = setTimeout(() => {
        verificarNitMutation.mutate(parseInt(editableBilling.ci), {
          onSuccess: data => {
            if (data.success && data.data.RespuestaVerificarNit.transaccion) {
              setNitValidationStatus('valid')
              setNitValidationMessage(data.data.RespuestaVerificarNit.mensajesList[0]?.descripcion || 'NIT válido')
            } else {
              setNitValidationStatus('invalid')
              setNitValidationMessage(data.data.RespuestaVerificarNit.mensajesList[0]?.descripcion || 'NIT no válido')
            }
          },
          onError: () => {
            setNitValidationStatus('invalid')
            setNitValidationMessage('Error al verificar NIT')
          }
        })
      }, 500)

      return () => clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editableBilling.ci, isNitSelected])

  if (!open || !order) {
    return null
  }

  // Handlers para edición de datos de facturación
  const handleTipoDocumentoChange = (codigo: number) => {
    setEditableBilling({
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

  const handleCiChange = (value: string) => {
    const newValue = requiresOnlyNumbers ? value.replace(/\D/g, '') : value

    if (newValue.length < editableBilling.ci.length || newValue === '') {
      setEditableBilling({
        ci: newValue,
        name: '',
        phone: '',
        email: '',
        complemento: '',
        codigoTipoDocumentoIdentidad: editableBilling.codigoTipoDocumentoIdentidad
      })
      setShowBillingResults(false)
      setSearchCi('')
    } else {
      setEditableBilling(prev => ({ ...prev, ci: newValue }))
    }

    setNitValidationStatus('idle')
    setNitValidationMessage('')
  }

  const handleSearchBilling = () => {
    if (editableBilling.ci.length >= 5) {
      setSearchCi(editableBilling.ci)
      setShowBillingResults(true)
    }
  }

  const handleSelectBilling = () => {
    if (billingSearchData) {
      setEditableBilling({
        ci: billingSearchData.ci,
        name: billingSearchData.name || '',
        phone: billingSearchData.phone || '',
        email: billingSearchData.email || '',
        complemento: billingSearchData.complemento || '',
        codigoTipoDocumentoIdentidad:
          billingSearchData.codigoTipoDocumentoIdentidad || editableBilling.codigoTipoDocumentoIdentidad
      })
      setShowBillingResults(false)
      setSearchCi('')
    }
  }

  const billingInfo = order.billing

  const showMessage = (message: string, severity: 'success' | 'error' | 'info' | 'warning') => {
    setSnackPack(prev => [...prev, { message, severity, key: new Date().getTime() }])
  }

  const handleSnackbarClose = (_?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') {
      return
    }

    setSnackbarOpen(false)
  }

  const handleExited = () => {
    setMessageInfo(undefined)
  }

  const handleCancelar = async () => {
    setShowCancelConfirm(false)

    try {
      await cancelOrderMutation.mutateAsync(order.id)
      showMessage('Orden cancelada exitosamente', 'success')
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      setTimeout(() => {
        onClose()
      }, 1500)
    } catch (error: any) {
      showMessage(error?.response?.data?.message || 'Error al cancelar la orden', 'error')
    }
  }

  const handleSendOrder = async () => {
    try {
      await sendOrderMutation.mutateAsync({
        orderId: order.id,
        dhlCode: dhlCode.trim() || undefined
      })
      showMessage('Orden enviada exitosamente', 'success')
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      setShowDhlInput(false)
      setDhlCode('')
      setTimeout(() => {
        onClose()
      }, 1500)
    } catch (error: any) {
      showMessage(error?.response?.data?.message || 'Error al enviar la orden', 'error')
    }
  }

  const handleEditOrder = () => {
    setShowEditConfirm(true)
  }

  const handleEditOrderConfirm = async () => {
    setShowEditConfirm(false)

    if (order.status === 'cancelled_for_edit') {
      showMessage('Cargando orden para editar...', 'info')
      setTimeout(() => {
        onClose()
        router.push(`/sales/instore?editOrderId=${order.id}`)
      }, 500)

      return
    }

    try {
      await cancelForEditMutation.mutateAsync(order.id)
      showMessage('Preparando orden para edición...', 'info')
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      setTimeout(() => {
        onClose()
        router.push(`/sales/instore?editOrderId=${order.id}`)
      }, 1000)
    } catch (error: any) {
      showMessage(error?.response?.data?.message || 'Error al preparar orden para edición', 'error')
    }
  }

  const canEditOrder = () => {
    if (order.status === 'cancelled_for_edit') return true
    if (!['paid', 'sent'].includes(order.status)) return false

    // Se puede editar aunque tenga factura activa
    return true
  }

  // Verificar si se puede cancelar la orden (bloquear si tiene factura activa)
  const canCancelOrder = () => {
    if (order.factura && ['VALIDADA', 'PENDIENTE', 'REVERTIDA'].includes(order.factura.estado)) {
      return false
    }

    return true
  }

  // Verificar si la factura está bloqueando acciones
  const hasBlockingFactura = order.factura && ['VALIDADA', 'PENDIENTE', 'REVERTIDA'].includes(order.factura.estado)

  // Handlers de facturación
  const getFacturaBaseData = () => ({
    branchId: selectedBranchId as number,
    tipoFacturaDocumento: 1,
    codigoDocumentoSector: 1,
    codigoMoneda: 1,
    tipoCambio: 1,
    nombreRazonSocial: editableBilling.name || '',
    numeroDocumento: editableBilling.ci || '',
    complemento: editableBilling.complemento || '',
    codigoTipoDocumentoIdentidad: editableBilling.codigoTipoDocumentoIdentidad || 1,
    usuario: 'MoneroAdmin',
    ...(editableBilling.email ? { emails: [editableBilling.email] } : {}),
    descuentoAdicional: 0
  })

  const handleEmitirFactura = async () => {
    if (!order.id || !selectedBranchId || !billingInfo) {
      setFacturaError('Faltan datos para emitir la factura')

      return
    }

    setFacturaError('')

    facturarMutation.mutate(
      { orderId: order.id, data: getFacturaBaseData() },
      {
        onSuccess: response => {
          setFacturaSuccess(true)
          setFacturaData(response.factura)
          queryClient.invalidateQueries({ queryKey: ['orders'] })
          refetchOrder()
          showMessage('¡Factura emitida exitosamente!', 'success')
        },
        onError: (error: any) => {
          setFacturaError(error?.response?.data?.message || 'Error al emitir la factura')
        }
      }
    )
  }

  const handleEmitirContingencia = async () => {
    if (!order.id || !selectedBranchId || !billingInfo || !selectedEventoId || !selectedCafcId || !fechaEmisionContingencia) {
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
      { orderId: order.id, data: contingenciaData },
      {
        onSuccess: factura => {
          setFacturaSuccess(true)
          setFacturaData(factura)
          queryClient.invalidateQueries({ queryKey: ['orders'] })
          refetchOrder()
          showMessage('¡Factura por contingencia emitida!', 'success')
        },
        onError: (error: any) => {
          setFacturaError(error?.response?.data?.message || 'Error al emitir factura por contingencia')
        }
      }
    )
  }

  const handlePrintInvoice = () => {
    if (facturaData) {
      printInvoice(facturaData)
    } else if (order.factura) {
      // Convertir OrderFactura a Factura (convertir tipos y manejar nulls)
      const facturaForPrint: Factura = {
        ...order.factura,
        nitEmisor: parseInt(order.factura.nitEmisor),
        montoTotal: parseFloat(order.factura.montoTotal),
        montoTotalSujetoIva: parseFloat(order.factura.montoTotalSujetoIva),
        tipoCambio: parseFloat(order.factura.tipoCambio),
        montoTotalMoneda: parseFloat(order.factura.montoTotalMoneda),
        montoGiftCard: order.factura.montoGiftCard ? parseFloat(order.factura.montoGiftCard) : null,
        descuentoAdicional: parseFloat(order.factura.descuentoAdicional),
        codigoEmision: parseInt(order.factura.codigoEmision),
        codigoDescripcion: order.factura.codigoDescripcion || '',
        codigoEstado: order.factura.codigoEstado || 0,
        codigoRecepcion: order.factura.codigoRecepcion || '',
        transaccion: order.factura.transaccion || false,
        fechaRespuesta: order.factura.fechaRespuesta || '',
        detalles: (order.factura.detalles || []).map((d: OrderFacturaDetalle) => ({
          ...d,
          cantidad: parseFloat(d.cantidad),
          precioUnitario: parseFloat(d.precioUnitario),
          subTotal: parseFloat(d.subTotal),
          montoDescuento: d.montoDescuento ? parseFloat(d.montoDescuento) : null
        }))
      }

      printInvoice(facturaForPrint)
    }
  }

  const resetFacturaState = () => {
    setShowFacturacion(false)
    setSelectedBranchId('')
    setFacturaError('')
    setFacturaSuccess(false)
    setFacturaData(null)
    setShowContingencia(false)
    setSelectedCafcId('')
    setSelectedEventoId('')
    setFechaEmisionContingencia('')
    refetchOrder()
  }

  const handleAnularFactura = async () => {
    if (!order.factura) return

    anularFacturaMutation.mutate(
      { facturaId: order.factura.id, codigoMotivo: motivoAnulacion },
      {
        onSuccess: () => {
          setShowAnularConfirm(false)
          queryClient.invalidateQueries({ queryKey: ['orders'] })
          refetchOrder()
          showMessage('Factura anulada exitosamente', 'success')
        },
        onError: (error: any) => {
          showMessage(error?.response?.data?.message || 'Error al anular la factura', 'error')
        }
      }
    )
  }

  const handleRevertirAnulacion = async () => {
    if (!order.factura) return

    revertirAnulacionMutation.mutate(order.factura.id, {
      onSuccess: () => {
        setShowRevertirConfirm(false)
        queryClient.invalidateQueries({ queryKey: ['orders'] })
        refetchOrder()
        showMessage('Anulación revertida exitosamente. La factura ahora está REVERTIDA.', 'success')
      },
      onError: (error: any) => {
        showMessage(
          error?.response?.data?.message ||
            'Error al revertir la anulación. Esta acción solo puede realizarse una vez.',
          'error'
        )
      }
    })
  }

  const handleConfirmarEmision = () => {
    setShowEmitirConfirm(false)

    if (showContingencia) {
      handleEmitirContingencia()
    } else {
      handleEmitirFactura()
    }
  }

  const isPendingFactura = facturarMutation.isPending || facturarContingenciaMutation.isPending

  // Permitir facturar si:
  // - Status es 'sent' (no cancelled_for_edit ni otros)
  // - NO hay factura (si existe factura, aunque esté anulada, no se puede emitir nueva)
  // - Tiene datos de facturación
  // NOTA: Cuando se edita una orden, se crea una NUEVA orden. La original queda cancelled_for_edit.
  // NOTA: Después de anular, solo se puede REVERTIR, no emitir nueva factura en la misma orden.
  const canInvoice = order.status === 'sent' && !order.factura && billingInfo

  // Se puede anular solo si la factura está VALIDADA (no REVERTIDA, ya que la reversión es única)
  const canAnular = order.factura && order.factura.estado === 'VALIDADA'

  // Solo se puede revertir si la factura está ANULADA y la orden no fue editada (cancelled_for_edit)
  const canRevertir = order.factura && order.factura.estado === 'ANULADA' && order.status !== 'cancelled_for_edit'

  if (snackPack.length && !messageInfo) {
    setMessageInfo({ ...snackPack[0] })
    setSnackPack(prev => prev.slice(1))
    setSnackbarOpen(true)
  } else if (snackPack.length && messageInfo && snackbarOpen) {
    setSnackbarOpen(false)
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth='lg' fullWidth scroll='paper'>
      <DialogTitle className='flex justify-between items-center pb-4'>
        <Typography variant='h4' component='span' className='font-semibold'>
          Detalles de la Orden #{order.inherited_id || order.id}
        </Typography>
        <IconButton onClick={onClose} size='small'>
          <i className='tabler-x text-xl' />
        </IconButton>
      </DialogTitle>

      <DialogContent className='p-0'>
        <Box className='p-6 space-y-6'>
          <Card variant='outlined'>
            <CardContent>
              <Typography variant='h6' className='mb-4 text-textPrimary'>
                Información General
              </Typography>

              <Grid container spacing={3}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Box className='space-y-4'>
                    <Box>
                      <Typography variant='overline' className='text-textSecondary text-xs font-medium'>
                        ID de Orden
                      </Typography>
                      <Typography variant='h6' className='font-bold mt-1'>
                        #{order.inherited_id || order.id}
                      </Typography>
                    </Box>

                    <Box>
                      <Typography variant='overline' className='text-textSecondary text-xs font-medium'>
                        Tipo de Venta
                      </Typography>
                      <Typography variant='body1' className='font-semibold mt-1'>
                        {getTipoLabel(order.type)}
                      </Typography>
                    </Box>

                    <Box>
                      <Typography variant='overline' className='text-textSecondary text-xs font-medium'>
                        Método de Pago
                      </Typography>
                      <Typography variant='body1' className='font-semibold mt-1'>
                        {order.payment_type ? getPaymentLabel(order.payment_type) : 'N/A'}
                      </Typography>
                    </Box>

                    <Box>
                      <Typography variant='overline' className='text-textSecondary text-xs font-medium'>
                        Fecha de Creación
                      </Typography>
                      <Typography variant='body1' className='font-medium mt-1'>
                        {order.createdAt ? formatDate(order.createdAt) : 'N/A'}
                      </Typography>
                    </Box>

                    {order.expiresAt && (
                      <Box>
                        <Typography variant='overline' className='text-textSecondary text-xs font-medium'>
                          Expira en
                        </Typography>
                        <Typography variant='body1' className='font-medium mt-1 text-error'>
                          {formatDate(order.expiresAt)}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </Grid>

                <Grid size={{ xs: 12, sm: 6 }}>
                  <Box className='space-y-4'>
                    <Box>
                      <Typography variant='overline' className='text-textSecondary text-xs font-medium'>
                        Total
                      </Typography>
                      <Typography variant='h5' className='font-bold text-primary mt-1'>
                        Bs. {parseFloat(order.totalPrice).toFixed(2)}
                      </Typography>
                    </Box>

                    {order.shipment_price !== undefined && order.shipment_price > 0 && (
                      <Box>
                        <Typography variant='overline' className='text-textSecondary text-xs font-medium'>
                          Costo de Envío
                        </Typography>
                        <Typography variant='body1' className='font-semibold text-warning mt-1'>
                          Bs. {parseFloat(String(order.shipment_price)).toFixed(2)}
                        </Typography>
                      </Box>
                    )}

                    <Box>
                      <Typography variant='overline' className='text-textSecondary text-xs font-medium'>
                        Estado
                      </Typography>
                      <Box className='mt-1'>
                        <Chip
                          label={getEstadoLabel(order.status)}
                          variant='tonal'
                          color={getEstadoColor(order.status)}
                          size='medium'
                        />
                      </Box>
                    </Box>

                    <Box>
                      <Typography variant='overline' className='text-textSecondary text-xs font-medium'>
                        Orden Editada
                      </Typography>
                      <Box className='mt-1'>
                        {order.edited ? (
                          <Chip label='Sí' color='warning' variant='tonal' size='small' />
                        ) : (
                          <Typography variant='body1' className='font-medium'>
                            No
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {order.billing && (
            <Card variant='outlined'>
              <CardContent>
                <Typography variant='h6' className='mb-4 text-textPrimary'>
                  Datos del Cliente
                </Typography>
                <Grid container spacing={3}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Typography variant='overline' className='text-textSecondary text-xs font-medium block'>
                      CI / NIT
                    </Typography>
                    <Typography variant='body1' className='font-semibold mt-1'>
                      {order.billing.ci}
                    </Typography>
                  </Grid>
                  {order.billing.name && (
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Typography variant='overline' className='text-textSecondary text-xs font-medium block'>
                        Nombre
                      </Typography>
                      <Typography variant='body1' className='font-semibold mt-1'>
                        {order.billing.name}
                      </Typography>
                    </Grid>
                  )}
                  {order.billing.phone && (
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Typography variant='overline' className='text-textSecondary text-xs font-medium block'>
                        Teléfono
                      </Typography>
                      <Typography variant='body1' className='font-medium mt-1'>
                        {order.billing.phone}
                      </Typography>
                    </Grid>
                  )}
                  {order.billing.email && (
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Typography variant='overline' className='text-textSecondary text-xs font-medium block'>
                        Email
                      </Typography>
                      <Typography variant='body1' className='font-medium mt-1'>
                        {order.billing.email}
                      </Typography>
                    </Grid>
                  )}
                  {order.billing.complemento && (
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Typography variant='overline' className='text-textSecondary text-xs font-medium block'>
                        Complemento
                      </Typography>
                      <Typography variant='body1' className='font-medium mt-1'>
                        {order.billing.complemento}
                      </Typography>
                    </Grid>
                  )}
                </Grid>
              </CardContent>
            </Card>
          )}

          {order.factura && (
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
          )}

          {/* Alerta cuando hay factura activa que bloquea acciones */}
          {hasBlockingFactura && (
            <Alert severity='warning' sx={{ mt: 2 }}>
              <Typography variant='body2' fontWeight='medium'>
                Esta orden tiene una factura{' '}
                {order.factura?.estado === 'VALIDADA'
                  ? 'validada'
                  : order.factura?.estado === 'REVERTIDA'
                    ? 'revertida'
                    : 'pendiente'}
                .
              </Typography>
              <Typography variant='body2'>Para cancelar la orden, primero debe anular la factura.</Typography>
            </Alert>
          )}

          {/* Sección de facturación para órdenes sin factura */}
          {canInvoice && (
            <Card variant='outlined'>
              <CardContent>
                <Box className='flex justify-between items-center mb-4'>
                  <Typography variant='h6' className='text-textPrimary'>
                    Emitir Factura
                  </Typography>
                  {!showFacturacion && (
                    <Button
                      variant='contained'
                      color='primary'
                      onClick={() => setShowFacturacion(true)}
                      startIcon={<i className='tabler-file-invoice' />}
                    >
                      Facturar
                    </Button>
                  )}
                </Box>

                <Collapse in={showFacturacion}>
                  {facturaError && (
                    <Alert severity='error' sx={{ mb: 2 }}>
                      {facturaError}
                    </Alert>
                  )}

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
                        sx={{
                          p: 2,
                          bgcolor: facturaData.codigoEmision === 2 ? 'warning.lighter' : 'success.lighter',
                          mb: 2
                        }}
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
                        <Divider sx={{ my: 1 }} />
                        <Typography
                          variant='caption'
                          color='text.secondary'
                          sx={{ wordBreak: 'break-all', fontSize: '9px' }}
                        >
                          CUF: {facturaData.cuf}
                        </Typography>
                      </Paper>

                      <Box sx={{ display: 'flex', gap: 2 }}>
                        <Button
                          variant='contained'
                          color='primary'
                          onClick={handlePrintInvoice}
                          startIcon={<i className='tabler-printer' />}
                          fullWidth
                        >
                          Imprimir
                        </Button>
                        <Button variant='outlined' onClick={resetFacturaState} fullWidth>
                          Cerrar
                        </Button>
                      </Box>
                    </Box>
                  ) : (
                    <>
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
                          )}
                        </Paper>
                      </Collapse>

                      {/* Datos de facturación editables */}
                      <Paper variant='outlined' sx={{ p: 2, bgcolor: 'action.hover', mb: 2 }}>
                        <Typography variant='subtitle2' fontWeight='bold' sx={{ mb: 2 }}>
                          Datos de la Factura
                        </Typography>

                        <Grid container spacing={2}>
                          {/* Tipo de Documento */}
                          <Grid size={{ xs: 12, sm: 6 }}>
                            <FormControl fullWidth size='small'>
                              <InputLabel>Tipo Documento *</InputLabel>
                              <Select
                                value={editableBilling.codigoTipoDocumentoIdentidad}
                                label='Tipo Documento *'
                                onChange={e => handleTipoDocumentoChange(e.target.value as number)}
                              >
                                {tiposDocumento.map(tipo => (
                                  <MenuItem key={tipo.codigoClasificador} value={tipo.codigoClasificador}>
                                    {tipo.descripcion}
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                          </Grid>

                          {/* CI/NIT con búsqueda */}
                          <Grid size={{ xs: 12, sm: 6 }}>
                            <Box sx={{ display: 'flex', gap: 1 }}>
                              <TextField
                                fullWidth
                                size='small'
                                label={isNitSelected ? 'NIT *' : 'CI *'}
                                value={editableBilling.ci}
                                onChange={e => handleCiChange(e.target.value)}
                                placeholder={isNitSelected ? 'Ej: 12345678' : 'Ej: 1234567'}
                                inputProps={{ maxLength: 15 }}
                                error={isNitSelected && nitValidationStatus === 'invalid'}
                                helperText={isNitSelected && nitValidationStatus !== 'idle' ? nitValidationMessage : ''}
                                InputProps={{
                                  endAdornment:
                                    isNitSelected && verificarNitMutation.isPending ? (
                                      <CircularProgress size={16} />
                                    ) : isNitSelected && nitValidationStatus === 'valid' ? (
                                      <i className='tabler-check text-success' />
                                    ) : null
                                }}
                              />
                              <Button
                                variant='outlined'
                                size='small'
                                onClick={handleSearchBilling}
                                disabled={editableBilling.ci.length < 5 || isSearchingBilling}
                                sx={{ minWidth: 40, px: 1 }}
                              >
                                {isSearchingBilling ? <CircularProgress size={16} /> : <i className='tabler-search' />}
                              </Button>
                            </Box>
                          </Grid>

                          {/* Resultado de búsqueda */}
                          {showBillingResults && billingSearchData && (
                            <Grid size={{ xs: 12 }}>
                              <Alert
                                severity='info'
                                action={
                                  <Button color='inherit' size='small' onClick={handleSelectBilling}>
                                    Usar estos datos
                                  </Button>
                                }
                              >
                                <Typography variant='caption'>
                                  <strong>Encontrado:</strong> {billingSearchData.name || 'Sin nombre'} -{' '}
                                  {billingSearchData.ci}
                                </Typography>
                              </Alert>
                            </Grid>
                          )}

                          {showBillingResults && !billingSearchData && !isSearchingBilling && (
                            <Grid size={{ xs: 12 }}>
                              <Alert severity='warning'>No se encontraron datos para este CI/NIT</Alert>
                            </Grid>
                          )}

                          {/* Nombre/Razón Social */}
                          <Grid size={{ xs: 12 }}>
                            <TextField
                              fullWidth
                              size='small'
                              label='Nombre / Razón Social *'
                              value={editableBilling.name}
                              onChange={e => setEditableBilling(prev => ({ ...prev, name: e.target.value }))}
                              placeholder='Nombre o razón social'
                            />
                          </Grid>

                          {/* Complemento */}
                          <Grid size={{ xs: 12, sm: 4 }}>
                            <TextField
                              fullWidth
                              size='small'
                              label='Complemento'
                              value={editableBilling.complemento}
                              onChange={e => setEditableBilling(prev => ({ ...prev, complemento: e.target.value }))}
                              placeholder='1E, 1J, etc.'
                              inputProps={{ maxLength: 5 }}
                            />
                          </Grid>

                          {/* Teléfono */}
                          <Grid size={{ xs: 12, sm: 4 }}>
                            <TextField
                              fullWidth
                              size='small'
                              label='Teléfono'
                              value={editableBilling.phone}
                              onChange={e =>
                                setEditableBilling(prev => ({ ...prev, phone: e.target.value.replace(/\D/g, '') }))
                              }
                              placeholder='Ej: 70000000'
                              inputProps={{ maxLength: 15 }}
                            />
                          </Grid>

                          {/* Email */}
                          <Grid size={{ xs: 12, sm: 4 }}>
                            <TextField
                              fullWidth
                              size='small'
                              label='Email'
                              type='email'
                              value={editableBilling.email}
                              onChange={e => setEditableBilling(prev => ({ ...prev, email: e.target.value }))}
                              placeholder='correo@ejemplo.com'
                            />
                          </Grid>
                        </Grid>
                      </Paper>

                      {/* Botones de facturación */}
                      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                        <Button
                          variant='contained'
                          color='primary'
                          onClick={() => setShowEmitirConfirm(true)}
                          disabled={
                            !selectedBranchId ||
                            isPendingFactura ||
                            !editableBilling.ci ||
                            !editableBilling.name ||
                            (isNitSelected && nitValidationStatus !== 'valid') ||
                            (showContingencia && (!selectedEventoId || !selectedCafcId || !fechaEmisionContingencia))
                          }
                          startIcon={
                            isPendingFactura ? (
                              <CircularProgress size={20} color='inherit' />
                            ) : (
                              <i className='tabler-file-invoice' />
                            )
                          }
                          fullWidth
                        >
                          {isPendingFactura
                            ? 'Emitiendo...'
                            : showContingencia
                              ? 'Emitir Contingencia'
                              : 'Emitir Factura'}
                        </Button>
                      </Box>

                      <Box sx={{ display: 'flex', gap: 2 }}>
                        <Button
                          variant='text'
                          color='warning'
                          onClick={() => setShowContingencia(!showContingencia)}
                          fullWidth
                          size='small'
                        >
                          {showContingencia ? 'Cancelar contingencia' : '⚠️ Facturar por Contingencia'}
                        </Button>
                        <Button variant='outlined' onClick={resetFacturaState} fullWidth size='small'>
                          Cancelar
                        </Button>
                      </Box>
                    </>
                  )}
                </Collapse>

                {!showFacturacion && (
                  <Alert severity='info' sx={{ mt: 2 }}>
                    Esta orden está lista para ser facturada. Haga clic en Facturar para emitir la factura electrónica.
                  </Alert>
                )}
              </CardContent>
            </Card>
          )}

          {order.customer && (
            <Card variant='outlined'>
              <CardContent>
                <Typography variant='h6' className='mb-4 text-textPrimary'>
                  Información del Cliente
                </Typography>
                <Grid container spacing={3}>
                  {(() => {
                    const isGuestCustomer = order.customer.email === 'guest@moneroget.com'

                    // Si es invitado, usar datos del billing; si no, usar datos del customer
                    const displayName = isGuestCustomer ? order.billing?.name || '-' : order.customer.name

                    const displayEmail = isGuestCustomer
                      ? order.billing?.email || order.email || '-'
                      : order.customer.email

                    const displayPhone = isGuestCustomer ? order.billing?.phone || null : order.customer.phone

                    return (
                      <>
                        <Grid size={{ xs: 12, sm: 6 }}>
                          <Typography variant='overline' className='text-textSecondary text-xs font-medium block'>
                            Nombre
                          </Typography>
                          <Typography variant='body1' className='font-semibold mt-1'>
                            {displayName || '-'}
                          </Typography>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>
                          <Typography variant='overline' className='text-textSecondary text-xs font-medium block'>
                            Email
                          </Typography>
                          <Typography variant='body1' className='font-medium mt-1'>
                            {displayEmail || '-'}
                          </Typography>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>
                          <Typography variant='overline' className='text-textSecondary text-xs font-medium block'>
                            Teléfono
                          </Typography>
                          {displayPhone ? (
                            <Box className='flex items-center gap-2 mt-1'>
                              <Typography variant='body1' className='font-medium'>
                                {displayPhone}
                              </Typography>
                              <IconButton
                                size='small'
                                color='success'
                                href={`https://wa.me/${displayPhone.replace(/[^0-9]/g, '')}`}
                                target='_blank'
                                rel='noopener noreferrer'
                                sx={{
                                  bgcolor: '#25D366',
                                  color: 'white',
                                  width: 32,
                                  height: 32,
                                  '&:hover': {
                                    bgcolor: '#128C7E'
                                  }
                                }}
                              >
                                <i className='tabler-brand-whatsapp' style={{ fontSize: '1.25rem' }} />
                              </IconButton>
                            </Box>
                          ) : (
                            <Typography variant='body1' className='font-medium mt-1'>
                              -
                            </Typography>
                          )}
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>
                          <Typography variant='overline' className='text-textSecondary text-xs font-medium block'>
                            Tipo de Cliente
                          </Typography>
                          <Typography variant='body1' className='font-medium mt-1'>
                            {isGuestCustomer
                              ? 'Invitado'
                              : order.customer.type === 'registered'
                                ? 'Registrado'
                                : 'Suscriptor'}
                          </Typography>
                        </Grid>
                      </>
                    )
                  })()}
                </Grid>
              </CardContent>
            </Card>
          )}

          {order.address && (
            <Card variant='outlined'>
              <CardContent>
                <Typography variant='h6' className='mb-4 text-textPrimary'>
                  Dirección de Envío
                </Typography>
                <Grid container spacing={3}>
                  {order.address.address && (
                    <Grid size={{ xs: 12 }}>
                      <Typography variant='overline' className='text-textSecondary text-xs font-medium block'>
                        Dirección
                      </Typography>
                      <Typography variant='body1' className='font-medium mt-1' style={{ whiteSpace: 'pre-line' }}>
                        {order.address.address}
                      </Typography>
                    </Grid>
                  )}
                  {order.address.city && (
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Typography variant='overline' className='text-textSecondary text-xs font-medium block'>
                        Ciudad
                      </Typography>
                      <Typography variant='body1' className='font-semibold mt-1'>
                        {order.address.city}
                      </Typography>
                    </Grid>
                  )}
                  {order.address.country && (
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Typography variant='overline' className='text-textSecondary text-xs font-medium block'>
                        País
                      </Typography>
                      <Typography variant='body1' className='font-semibold mt-1'>
                        {order.address.country}
                      </Typography>
                    </Grid>
                  )}
                  {order.address.postal_code && (
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Typography variant='overline' className='text-textSecondary text-xs font-medium block'>
                        Código Postal
                      </Typography>
                      <Typography variant='body1' className='font-medium mt-1'>
                        {order.address.postal_code}
                      </Typography>
                    </Grid>
                  )}
                  {order.address.type && (
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Typography variant='overline' className='text-textSecondary text-xs font-medium block'>
                        Tipo de Envío
                      </Typography>
                      <Typography variant='body1' className='font-medium mt-1'>
                        {order.address.type === 'national' ? 'Nacional' : 'Internacional'}
                      </Typography>
                    </Grid>
                  )}
                </Grid>
              </CardContent>
            </Card>
          )}

          {order.shipment && (
            <Card variant='outlined'>
              <CardContent>
                <Typography variant='h6' className='mb-4 text-textPrimary'>
                  Información de Envío
                </Typography>
                <Grid container spacing={3}>
                  {order.shipment.name && (
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Typography variant='overline' className='text-textSecondary text-xs font-medium block'>
                        Tipo de Envío
                      </Typography>
                      <Typography variant='body1' className='font-semibold mt-1'>
                        {order.shipment.name}
                      </Typography>
                    </Grid>
                  )}
                  {order.shipment.price && (
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Typography variant='overline' className='text-textSecondary text-xs font-medium block'>
                        Costo de Envío
                      </Typography>
                      <Typography variant='h6' className='font-bold text-primary mt-1'>
                        Bs. {parseFloat(order.shipment.price).toFixed(2)}
                      </Typography>
                    </Grid>
                  )}
                  {order.dhl_code && (
                    <Grid size={{ xs: 12 }}>
                      <Typography variant='overline' className='text-textSecondary text-xs font-medium block'>
                        Código DHL
                      </Typography>
                      <Typography variant='h6' className='font-bold mt-1'>
                        {order.dhl_code}
                      </Typography>
                    </Grid>
                  )}
                </Grid>
              </CardContent>
            </Card>
          )}

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
        </Box>
      </DialogContent>

      <DialogActions className='p-6 pt-0'>
        <Box className='flex gap-3 w-full justify-between flex-wrap'>
          {/* Botón de Editar Orden  */}
          {canEditOrder() && (
            <Button
              variant='outlined'
              color='warning'
              onClick={handleEditOrder}
              disabled={cancelForEditMutation.isPending}
              startIcon={
                cancelForEditMutation.isPending ? (
                  <CircularProgress size={20} color='inherit' />
                ) : (
                  <i className='tabler-edit' />
                )
              }
            >
              {cancelForEditMutation.isPending
                ? 'Preparando...'
                : order.status === 'cancelled_for_edit'
                  ? 'Seguir Editando'
                  : 'Editar Orden'}
            </Button>
          )}

          <Box className='flex gap-3 flex-wrap'>
            {order.status === 'pending' && canCancelOrder() && (
              <Button
                variant='contained'
                color='error'
                onClick={() => setShowCancelConfirm(true)}
                disabled={cancelOrderMutation.isPending}
                startIcon={<i className='tabler-x' />}
              >
                Cancelar Orden
              </Button>
            )}

            {order.status === 'paid' && (
              <>
                {canCancelOrder() && (
                  <Button
                    variant='outlined'
                    color='error'
                    onClick={() => setShowCancelConfirm(true)}
                    disabled={cancelOrderMutation.isPending || sendOrderMutation.isPending}
                    startIcon={<i className='tabler-x' />}
                  >
                    Cancelar Orden
                  </Button>
                )}

                {!showDhlInput && (
                  <Button
                    variant='contained'
                    color='primary'
                    onClick={() => setShowDhlInput(true)}
                    disabled={cancelOrderMutation.isPending || sendOrderMutation.isPending}
                    startIcon={<i className='tabler-truck' />}
                  >
                    Enviar Pedido
                  </Button>
                )}

                {showDhlInput && (
                  <>
                    {!order.shipment && (
                      <TextField
                        size='small'
                        label='Código DHL'
                        value={dhlCode}
                        onChange={e => setDhlCode(e.target.value)}
                        placeholder='Ej: DHL-123456'
                        className='max-sm:is-full sm:is-[200px]'
                        disabled={sendOrderMutation.isPending}
                        required
                      />
                    )}
                    <Button
                      variant='outlined'
                      onClick={() => {
                        setShowDhlInput(false)
                        setDhlCode('')
                      }}
                      disabled={sendOrderMutation.isPending}
                    >
                      Cancelar
                    </Button>
                    <Button
                      variant='contained'
                      color='success'
                      onClick={handleSendOrder}
                      disabled={sendOrderMutation.isPending || (!order.shipment && !dhlCode.trim())}
                      startIcon={
                        sendOrderMutation.isPending ? (
                          <CircularProgress size={20} color='inherit' />
                        ) : (
                          <i className='tabler-check' />
                        )
                      }
                    >
                      {sendOrderMutation.isPending ? 'Enviando...' : 'Confirmar Envío'}
                    </Button>
                  </>
                )}
              </>
            )}

            {order.status === 'sent' && canCancelOrder() && (
              <Button
                variant='contained'
                color='error'
                onClick={() => setShowCancelConfirm(true)}
                disabled={cancelOrderMutation.isPending}
                startIcon={<i className='tabler-x' />}
              >
                Cancelar Orden
              </Button>
            )}

            {!['pending', 'paid', 'sent'].includes(order.status) && (
              <Button variant='outlined' onClick={onClose}>
                Cerrar
              </Button>
            )}
          </Box>
        </Box>
      </DialogActions>

      {/* Modal de confirmación de cancelación */}
      <Dialog open={showCancelConfirm} onClose={() => setShowCancelConfirm(false)} maxWidth='xs' fullWidth>
        <DialogTitle>
          <Typography fontWeight='bold'>¿Cancelar Orden?</Typography>
        </DialogTitle>
        <DialogContent>
          <Typography>
            ¿Estás seguro que deseas cancelar la orden #{order.inherited_id || order.id}? Esta acción no se puede
            deshacer.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button
            onClick={() => setShowCancelConfirm(false)}
            disabled={cancelOrderMutation.isPending}
            variant='outlined'
            fullWidth
          >
            No, Continuar
          </Button>
          <Button
            onClick={handleCancelar}
            color='error'
            variant='contained'
            disabled={cancelOrderMutation.isPending}
            startIcon={cancelOrderMutation.isPending ? <CircularProgress size={20} color='inherit' /> : null}
            fullWidth
          >
            {cancelOrderMutation.isPending ? 'Cancelando...' : 'Sí, Cancelar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal de confirmación de edición */}
      <Dialog open={showEditConfirm} onClose={() => setShowEditConfirm(false)} maxWidth='xs' fullWidth>
        <DialogTitle>
          <Typography fontWeight='bold'>
            {order.status === 'cancelled_for_edit' ? '¿Continuar Editando?' : '¿Editar Orden?'}
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Typography>
            {order.status === 'cancelled_for_edit'
              ? `¿Deseas continuar editando la orden ?`
              : `¿Estás seguro que deseas editar la orden ? Podrás modificar los productos y cantidades.`}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button
            onClick={() => setShowEditConfirm(false)}
            disabled={cancelForEditMutation.isPending}
            variant='outlined'
            fullWidth
          >
            No, Cancelar
          </Button>
          <Button
            onClick={handleEditOrderConfirm}
            color='warning'
            variant='contained'
            disabled={cancelForEditMutation.isPending}
            startIcon={cancelForEditMutation.isPending ? <CircularProgress size={20} color='inherit' /> : null}
            fullWidth
          >
            {cancelForEditMutation.isPending
              ? 'Preparando...'
              : order.status === 'cancelled_for_edit'
                ? 'Sí, Continuar'
                : 'Sí, Editar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal de confirmación de anulación de factura */}
      <Dialog open={showAnularConfirm} onClose={() => setShowAnularConfirm(false)} maxWidth='xs' fullWidth>
        <DialogTitle>
          <Typography fontWeight='bold' color='error'>
            ¿Anular Factura?
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>
            Esta acción anulará la factura #{order.factura?.numeroFactura} de forma permanente en el SIAT.
          </Typography>

          <FormControl fullWidth size='small'>
            <InputLabel>Motivo de Anulación *</InputLabel>
            <Select
              value={motivoAnulacion}
              label='Motivo de Anulación *'
              onChange={e => setMotivoAnulacion(e.target.value as number)}
            >
              <MenuItem value={1}>FACTURA MAL EMITIDA</MenuItem>
              <MenuItem value={2}>NOTA DE CREDITO-DEBITO MAL EMITIDA</MenuItem>
              <MenuItem value={3}>DATOS DE EMISION INCORRECTOS</MenuItem>
              <MenuItem value={4}>FACTURA O NOTA DE CREDITO-DEBITO DEVUELTA</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button
            onClick={() => setShowAnularConfirm(false)}
            disabled={anularFacturaMutation.isPending}
            variant='outlined'
            fullWidth
          >
            Cancelar
          </Button>
          <Button
            onClick={handleAnularFactura}
            color='error'
            variant='contained'
            disabled={anularFacturaMutation.isPending}
            startIcon={
              anularFacturaMutation.isPending ? (
                <CircularProgress size={20} color='inherit' />
              ) : (
                <i className='tabler-x' />
              )
            }
            fullWidth
          >
            {anularFacturaMutation.isPending ? 'Anulando...' : 'Sí, Anular Factura'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal de confirmación de revertir anulación */}
      <Dialog open={showRevertirConfirm} onClose={() => setShowRevertirConfirm(false)} maxWidth='xs' fullWidth>
        <DialogTitle>
          <Typography fontWeight='bold' color='warning.main'>
            ¿Revertir Anulación?
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Alert severity='error' sx={{ mb: 2 }}>
            Esta acción solo puede realizarse UNA VEZ por factura. Una vez revertida, la orden no podrá ser editada ni
            cancelada.
          </Alert>
          <Typography>
            Al revertir la anulación, la factura #{order.factura?.numeroFactura} volverá a estado activo (REVERTIDA) en
            el SIAT.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button
            onClick={() => setShowRevertirConfirm(false)}
            disabled={revertirAnulacionMutation.isPending}
            variant='outlined'
            fullWidth
          >
            Cancelar
          </Button>
          <Button
            onClick={handleRevertirAnulacion}
            color='warning'
            variant='contained'
            disabled={revertirAnulacionMutation.isPending}
            startIcon={
              revertirAnulacionMutation.isPending ? (
                <CircularProgress size={20} color='inherit' />
              ) : (
                <i className='tabler-restore' />
              )
            }
            fullWidth
          >
            {revertirAnulacionMutation.isPending ? 'Revirtiendo...' : 'Sí, Revertir Anulación'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal de confirmación de emisión de factura */}
      <Dialog open={showEmitirConfirm} onClose={() => setShowEmitirConfirm(false)} maxWidth='xs' fullWidth>
        <DialogTitle>
          <Typography fontWeight='bold' color='primary'>
            {showContingencia ? '¿Emitir Factura por Contingencia?' : '¿Emitir Factura?'}
          </Typography>
        </DialogTitle>
        <DialogContent>
          {showContingencia && (
            <Alert severity='warning' sx={{ mb: 2 }}>
              Esta factura se emitirá en modo contingencia (fuera de línea).
            </Alert>
          )}
          <Typography sx={{ mb: 2 }}>Se emitirá una factura electrónica al SIAT con los siguientes datos:</Typography>
          <Paper variant='outlined' sx={{ p: 2, bgcolor: 'action.hover' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant='caption' color='text.secondary'>
                Razón Social
              </Typography>
              <Typography variant='body2' fontWeight='medium'>
                {editableBilling.name || '-'}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant='caption' color='text.secondary'>
                Documento
              </Typography>
              <Typography variant='body2' fontWeight='medium'>
                {editableBilling.ci}
                {editableBilling.complemento ? `-${editableBilling.complemento}` : ''}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant='caption' color='text.secondary'>
                Monto Total
              </Typography>
              <Typography variant='body2' fontWeight='bold' color='primary'>
                Bs. {parseFloat(order.totalPrice).toFixed(2)}
              </Typography>
            </Box>
          </Paper>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={() => setShowEmitirConfirm(false)} disabled={isPendingFactura} variant='outlined' fullWidth>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirmarEmision}
            color='primary'
            variant='contained'
            disabled={isPendingFactura}
            startIcon={
              isPendingFactura ? <CircularProgress size={20} color='inherit' /> : <i className='tabler-file-invoice' />
            }
            fullWidth
          >
            {isPendingFactura ? 'Emitiendo...' : 'Sí, Emitir Factura'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbarOpen}
        onClose={handleSnackbarClose}
        autoHideDuration={3000}
        TransitionProps={{ onExited: handleExited }}
        key={messageInfo ? messageInfo.key : undefined}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          variant='filled'
          onClose={handleSnackbarClose}
          className='is-full shadow-xs items-center'
          severity={messageInfo?.severity || 'info'}
        >
          {messageInfo?.message}
        </Alert>
      </Snackbar>
    </Dialog>
  )
}

export default OrderDetailsModal
