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
import Paper from '@mui/material/Paper'
import TextField from '@mui/material/TextField'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
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
import { useUserRole } from '@/hooks/useUserRole'
import { useBranchContext } from '@/contexts/BranchContext'
import OrderCustomerData from './components/OrderCustomerData'
import OrderCustomerInfo from './components/OrderCustomerInfo'
import OrderFedexShipping from './components/OrderFedexShipping'
import OrderGeneralInfo from './components/OrderGeneralInfo'
import OrderInvoiceCard from './components/OrderInvoiceCard'
import OrderItemsTable from './components/OrderItemsTable'
import OrderPreviousInvoices from './components/OrderPreviousInvoices'
import OrderShippingAddress from './components/OrderShippingAddress'
import OrderShippingInfo from './components/OrderShippingInfo'
import { getFedexPdfUrl, getFedexTrackingNumber } from './components/orderFormatters'
import type {
  Order,
  OrderItem,
  Branch,
  Cafc,
  Factura,
  BillingInfo,
  TipoDocumentoIdentidad,
  OrderFacturaDetalle,
  EventoSignificativo
} from '@/types/api/sales'

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


const OrderDetailsModal = ({ open, onClose, order: orderProp }: OrderDetailsModalProps) => {
  const router = useRouter()
  const queryClient = useQueryClient()

  // Usar useGetOrder para poder refrescar los datos después de anular/revertir/facturar
  const { data: orderData, refetch: refetchOrder } = useGetOrder(orderProp?.id ?? null, open && !!orderProp?.id)

  // Usar los datos refrescados si existen, sino usar el prop original
  const order = orderData ?? orderProp

  const [trackingCode, setTrackingCode] = useState('')
  const [showTrackingInput, setShowTrackingInput] = useState(false)

  // Que la orden ya se envio desde este modal. Va aparte de `despacho` a
  // proposito: el prop `order` sigue diciendo 'paid' hasta que el padre
  // refresque, y si esto dependiera de los items de la respuesta, una respuesta
  // sin `items` dejaria el boton de enviar en pantalla.
  const [enviadaLocal, setEnviadaLocal] = useState(false)

  // Lo que el back devuelve al pasar la orden a enviada: trae por item de donde
  // sale cada prenda. Se guarda para mostrarlo, porque es la instruccion de que
  // sacar de cada lugar y se perderia al cerrar el modal. Puede venir vacio.
  const [despacho, setDespacho] = useState<OrderItem[] | null>(null)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [showSendConfirm, setShowSendConfirm] = useState(false)
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

  // MANAGER/CASHIER ya tienen su sucursal fija desde el login (user.branch) — no eligen
  const { userBranch, needsBranchSelector, hasFixedBranch, isAdminLike } = useUserRole()

  // El admin elige su sucursal en la navbar: el selector de facturacion arranca
  // en esa, en vez de vacio
  const { selectedBranchId: navbarBranchId } = useBranchContext()

  // Cancelar, editar, cambiar estado y confirmar pago son de MANAGER y CASHIER
  // (doc 02): al admin y al supervisor el back les responde 403. Facturar queda
  // porque, aunque el doc lo liste igual, hoy se usa desde este panel.
  const puedeOperarLaVenta = !isAdminLike

  // Hooks de facturación
  const { data: branchesData, isLoading: isLoadingBranches } = useBranches(needsBranchSelector)
  const facturarMutation = useFacturar()
  const facturarContingenciaMutation = useFacturarContingencia()
  const anularFacturaMutation = useAnularFactura()
  const revertirAnulacionMutation = useRevertirAnulacion()

  // Hooks para contingencia
  const { data: cafcsData } = useCafcs()

  // Hooks para edición de datos de facturación
  //
  // El branchId va SIEMPRE que se tenga: para ADMIN/SUPERVISOR el back no puede
  // deducir la sucursal de la sesion y responde 403 "La sucursal no pudo ser
  // determinada". Es la misma sucursal con la que se factura la orden, no la del
  // selector de la navbar, asi que sale de `selectedBranchId` de este modal.
  //
  // Mientras el admin no haya elegido sucursal la consulta ni se dispara; un
  // MANAGER/CASHIER no manda nada y el back usa la suya.
  const branchIdFacturacion = typeof selectedBranchId === 'number' ? selectedBranchId : undefined

  const { data: tiposDocumentoData } = useTiposDocumentoIdentidad(
    branchIdFacturacion,
    !needsBranchSelector || branchIdFacturacion !== undefined
  )

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
    selectedBranch?.id,
    undefined,
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

  // MANAGER/CASHIER: la sucursal ya viene fija del login, se autocompleta sin elegir
  useEffect(() => {
    if (hasFixedBranch && userBranch?.id && selectedBranchId !== userBranch.id) {
      setSelectedBranchId(userBranch.id)
    }
  }, [hasFixedBranch, userBranch?.id, selectedBranchId])

  // ADMIN/SUPERVISOR: arranca en la sucursal del selector de la navbar y la
  // sigue cuando cambia. Igual puede elegir otra para una factura puntual: no
  // depende de `selectedBranchId`, asi que no le pisa lo que haya elegido.
  useEffect(() => {
    if (needsBranchSelector && navbarBranchId) {
      setSelectedBranchId(navbarBranchId)
    }
  }, [needsBranchSelector, navbarBranchId])

  // Resetear estados de facturación cuando cambia la orden o se cierra el modal
  useEffect(() => {
    setFacturaSuccess(false)
    setFacturaData(null)
    setFacturaError('')
    setShowFacturacion(false)
    setShowContingencia(false)
    setShowEmitirConfirm(false)
    setShowAnularConfirm(false)
    setShowRevertirConfirm(false)
    setEnviadaLocal(false)
    setDespacho(null)
    setShowSendConfirm(false)
    setShowTrackingInput(false)
  }, [orderProp?.id])

  // Verificar NIT automáticamente cuando se ingresa
  useEffect(() => {
    if (isNitSelected && editableBilling.ci.length >= 5 && /^\d+$/.test(editableBilling.ci)) {
      setNitValidationStatus('idle')

      const timer = setTimeout(() => {
        verificarNitMutation.mutate({ nit: parseInt(editableBilling.ci), branchId: selectedBranch?.id }, {
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

  // Reglas de PUT /orders/change-status, para no mandar algo que el back va a
  // rechazar con un 400 que el usuario no sabria como resolver:
  //
  //   nacional (la orden tiene shipment) -> pasa a SENT sin pedir nada
  //   FedEx sin tracking guardado        -> 400 hasta que se mande uno
  //   FedEx con la guia cancelada        -> 400 hasta que se mande uno DISTINTO
  //                                         del guardado (caso del pago tardio
  //                                         con tarjeta)
  //   FedEx con tracking guardado        -> el body puede ir vacio
  const esEnvioNacional = !!order.shipment
  const trackingGuardado = getFedexTrackingNumber(order)
  const guiaCancelada = order.fedexShipmentCancelled

  const trackingObligatorio = !esEnvioNacional && (!trackingGuardado || guiaCancelada)

  const trackingInvalido =
    trackingObligatorio &&
    (!trackingCode.trim() || (guiaCancelada && trackingCode.trim() === trackingGuardado))

  const handleSendOrder = async () => {
    try {
      const enviada = await sendOrderMutation.mutateAsync({
        orderId: order.id,
        trackingCode: trackingCode.trim() || undefined
      })

      showMessage('Orden enviada exitosamente', 'success')

      // La tabla de atras seguia mostrando "pagado" hasta recargar la pagina.
      // Invalidar sola no alcanzaba, asi que primero se parchea la fila en el
      // cache con lo que devolvio el PUT —el estado nuevo ya viene ahi— y
      // despues se revalida contra el servidor.
      queryClient.setQueriesData({ queryKey: ['orders'] }, (previo: any) => {
        if (!previo?.data) return previo

        return {
          ...previo,
          data: previo.data.map((o: Order) => (o.id === order.id ? { ...o, ...enviada } : o))
        }
      })

      queryClient.invalidateQueries({ queryKey: ['orders'], refetchType: 'all' })
      setShowTrackingInput(false)
      setTrackingCode('')

      // El modal NO se cierra solo: la respuesta dice de donde sacar cada
      // prenda y hay que poder leerlo antes de ir a armar el paquete
      setShowSendConfirm(false)
      setEnviadaLocal(true)
      setDespacho(enviada?.items ?? null)
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
    if (!puedeOperarLaVenta) return false

    // Con la guia FedEx ya emitida el backend rechaza el cancel-for-edit
    if (order.type === 'online' && order.fedex_shipping_data) return false

    if (order.status === 'cancelled_for_edit') return true
    if (!['paid', 'sent'].includes(order.status)) return false

    // Se puede editar aunque tenga factura activa
    return true
  }

  // Verificar si se puede cancelar la orden (bloquear si tiene factura activa)
  const canCancelOrder = () => {
    if (!puedeOperarLaVenta) return false

    if (order.factura && ['VALIDADA', 'PENDIENTE', 'REVERTIDA'].includes(order.factura.estado)) {
      return false
    }

    return true
  }

  // Verificar si la factura está bloqueando acciones
  const hasBlockingFactura = order.factura && ['VALIDADA', 'PENDIENTE', 'REVERTIDA'].includes(order.factura.estado)

  // Handlers de facturación
  const getFacturaBaseData = () => ({
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

    // Vuelve a la sucursal por defecto, no a vacio: la del login para un cajero
    // y la del selector de la navbar para un admin
    setSelectedBranchId(userBranch?.id ?? navbarBranchId ?? '')
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

  // Con la factura en estos estados el mismo endpoint emite una nueva que la reemplaza
  const refacturableStates = ['ANULADA', 'RECHAZADA']

  const canInvoice =
    (order.status === 'sent' || (order.status === 'paid' && order.payment_type === 'card_online')) &&
    (!order.factura || refacturableStates.includes(order.factura.estado)) &&
    billingInfo

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
          {/* Que sacar y de donde, con lo que devolvio el cambio de estado */}
          {despacho && (
            <Alert severity='success' icon={<i className='tabler-package' />}>
              <AlertTitle>Orden enviada · qué sacar</AlertTitle>
              {despacho.map(item => {
                const deBodega = item.fromWarehouse || 0
                const deTienda = item.fromSalesFloor || 0

                return (
                  <Typography key={item.id} variant='body2' className='block'>
                    <strong>{item.variant?.productColor?.product?.name || 'Producto'}</strong>
                    {item.variant?.size?.name ? ` · Talla ${item.variant.size.name}` : ''}
                    {item.variant?.productColor?.color?.name ? ` · ${item.variant.productColor.color.name}` : ''}
                    {' — '}
                    {deBodega > 0 && `${deBodega} de bodega`}
                    {deBodega > 0 && deTienda > 0 && ' y '}
                    {deTienda > 0 && `${deTienda} de tienda`}
                    {deBodega === 0 && deTienda === 0 && 'sin stock asignado'}
                    {!!item.missingQuantity && ` · faltan ${item.missingQuantity}`}
                  </Typography>
                )
              })}
            </Alert>
          )}

          <OrderGeneralInfo order={order} />

          {order.billing && (
            <OrderCustomerData order={order} />
          )}

          {order.factura && (
          <OrderInvoiceCard
            order={order}
            canAnular={!!canAnular}
            canRevertir={!!canRevertir}
            handlePrintInvoice={handlePrintInvoice}
            setShowAnularConfirm={setShowAnularConfirm}
            setShowRevertirConfirm={setShowRevertirConfirm}
          />
          )}

          {(getFedexTrackingNumber(order) || getFedexPdfUrl(order)) && (
            <OrderFedexShipping order={order} />
          )}

          {!!order.facturasAnteriores?.length && (
            <OrderPreviousInvoices order={order} />
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
                      {order.factura ? 'Emitir Nueva Factura' : 'Facturar'}
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
                      {/* Selector de sucursal: ADMIN elige, MANAGER/CASHIER ya la traen fija del login */}
                      {needsBranchSelector ? (
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
                      ) : (
                        <TextField
                          fullWidth
                          size='small'
                          label='Sucursal'
                          value={userBranch?.name || ''}
                          disabled
                          sx={{ mb: 2 }}
                        />
                      )}

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
            <OrderCustomerInfo order={order} />
          )}

          {order.address && (
            <OrderShippingAddress order={order} />
          )}

          {order.shipment && (
            <OrderShippingInfo order={order} />
          )}

          <OrderItemsTable order={order} />
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

            {/* `order` es un prop: al enviar, el back ya la paso a SENT pero este
                objeto sigue diciendo 'paid' hasta que el padre refresque. Sin
                `!despacho` el boton seguia ofreciendo enviar algo ya enviado */}
            {order.status === 'paid' && !enviadaLocal && (
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

                {/* En un envio nacional no hay guia que cargar: el back pasa la
                    orden a enviada sin body, asi que se confirma de una */}
                {puedeOperarLaVenta && esEnvioNacional && (
                  <Button
                    variant='contained'
                    color='success'
                    onClick={() => setShowSendConfirm(true)}
                    disabled={cancelOrderMutation.isPending || sendOrderMutation.isPending}
                    startIcon={<i className='tabler-truck' />}
                  >
                    Marcar como enviado
                  </Button>
                )}

                {puedeOperarLaVenta && !esEnvioNacional && !showTrackingInput && (
                  <Button
                    variant='contained'
                    color='primary'
                    onClick={() => {
                      // Con la guia cancelada el guardado ya no sirve: se arranca
                      // en blanco para que se cargue el nuevo
                      setTrackingCode(guiaCancelada ? '' : trackingGuardado || '')
                      setShowTrackingInput(true)
                    }}
                    disabled={cancelOrderMutation.isPending || sendOrderMutation.isPending}
                    startIcon={<i className='tabler-truck' />}
                  >
                    Enviar por FedEx
                  </Button>
                )}

                {puedeOperarLaVenta && !esEnvioNacional && showTrackingInput && (
                  <>
                    <TextField
                      size='small'
                      label='Código de Seguimiento FedEx'
                      value={trackingCode}
                      onChange={e => setTrackingCode(e.target.value)}
                      placeholder='Ej: 794658135200'
                      className='max-sm:is-full sm:is-[200px]'
                      disabled={sendOrderMutation.isPending}
                      required={trackingObligatorio}
                      error={trackingInvalido && trackingCode.trim().length > 0}
                      helperText={
                        guiaCancelada
                          ? 'La guía anterior se canceló: cargá una nueva, distinta de la anterior'
                          : trackingObligatorio
                            ? 'Obligatorio: la orden no tiene guía guardada'
                            : 'Opcional: ya hay una guía guardada'
                      }
                    />
                    <Button
                      variant='outlined'
                      onClick={() => {
                        setShowTrackingInput(false)
                        setTrackingCode('')
                      }}
                      disabled={sendOrderMutation.isPending}
                    >
                      Cancelar
                    </Button>
                    <Button
                      variant='contained'
                      color='success'
                      onClick={handleSendOrder}
                      disabled={sendOrderMutation.isPending || trackingInvalido}
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

          {/* Cancelar devuelve el pedido a "esperando"; editar lo mantiene entregado */}
          {order.branchTransferId && (
            <Alert severity='warning' sx={{ mt: 3 }}>
              Esta venta entregó el <strong>pedido #{order.branchTransferId}</strong>. Al cancelarla, el pedido
              vuelve a figurar como pendiente de retiro y habrá que volver a enlazarlo en la venta nueva. Si solo
              necesita corregir datos, use <strong>Editar</strong> en lugar de cancelar.
            </Alert>
          )}
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

      {/* Confirmacion de envio (nacional). El de FedEx no la necesita: ya pasa
          por el campo de guia y su propio "Confirmar Envio" */}
      <Dialog open={showSendConfirm} onClose={() => setShowSendConfirm(false)} maxWidth='xs' fullWidth>
        <DialogTitle>
          <Typography fontWeight='bold'>¿Marcar como enviado?</Typography>
        </DialogTitle>
        <DialogContent>
          <Typography>
            La orden #{order.inherited_id || order.id} pasará a <strong>enviada</strong> y se descontará el stock de
            bodega y de tienda. Esta acción no se puede deshacer desde acá.
          </Typography>

          <Alert severity='info' sx={{ mt: 3 }}>
            Al confirmar vas a ver cuántas prendas sacar de cada lugar.
          </Alert>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button
            onClick={() => setShowSendConfirm(false)}
            disabled={sendOrderMutation.isPending}
            variant='outlined'
            fullWidth
          >
            No, volver
          </Button>
          <Button
            onClick={handleSendOrder}
            color='success'
            variant='contained'
            disabled={sendOrderMutation.isPending}
            startIcon={sendOrderMutation.isPending ? <CircularProgress size={20} color='inherit' /> : null}
            fullWidth
          >
            {sendOrderMutation.isPending ? 'Enviando...' : 'Sí, enviar'}
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
