export interface CartItem {
  variantId: number
  quantity: number
}

export interface CartRequest {
  items: CartItem[]
  token?: string
}

export interface CartResponse {
  cart: CartItem[]
  token: string
}

export interface RepriceItem {
  variantId: number
  quantity: number
  unit_price: number
  discountValue: number
  totalPrice: string
}

export interface RepriceResponse {
  items: RepriceItem[]
  total: string
}

export interface RepriceError {
  message: string
  error: string
  statusCode: number
}

export interface OrderItemSize {
  id: number
  name: string
  createdAt: string
}

export interface OrderItemColor {
  id: number
  name: string
  code: string
  createdAt: string
}

export interface OrderItemProduct {
  id: number
  name: string
  description: string
  price: string
  enabled: boolean
  codigoProductoSin: number
  unidadMedida: number
  createdAt: string
}

export interface OrderItemProductColor {
  id: number
  multimedia: string[]
  pdfs: string[]
  createdAt: string
  color: OrderItemColor
  product: OrderItemProduct
}

export interface OrderItemVariant {
  id: number
  createdAt: string
  size: OrderItemSize
  productColor: OrderItemProductColor
}

export interface OrderItem {
  id: number
  quantity: number
  unit_price: string
  discountValue: number
  totalPrice: string
  createdAt?: string
  variant: OrderItemVariant
}

export interface OrderBilling {
  id: number
  ci: string
  name: string | null
  phone: string | null
  email: string | null
  complemento: string | null
  codigoTipoDocumentoIdentidad: number
  createdAt: string
}

export interface OrderFactura {
  id: number
  nitEmisor: string
  razonSocialEmisor: string
  municipio: string
  telefono: string
  numeroFactura: number
  cuf: string
  cufd: string
  codigoSucursal: number
  nombreSucursal: string
  direccion: string
  codigoPuntoVenta: number
  tipoFacturaDocumento: number
  fechaEmision: string
  nombreRazonSocial: string
  codigoTipoDocumentoIdentidad: number
  numeroDocumento: string
  complemento: string
  codigoCliente: string
  codigoMetodoPago: number
  numeroTarjeta: string | null
  montoTotal: string
  montoTotalSujetoIva: string
  codigoMoneda: number
  tipoCambio: string
  montoTotalMoneda: string
  montoGiftCard: string | null
  descuentoAdicional: string
  codigoExcepcion: number
  leyenda: string
  usuario: string
  emails: string[]
  codigoDocumentoSector: number
  estado: 'PENDIENTE' | 'VALIDADA' | 'RECHAZADA' | 'ANULADA' | 'REVERTIDA'
  xml: string
  codigoEmision: string
  createdAt: string
  codigoDescripcion: string | null
  codigoEstado: number | null
  codigoRecepcion: string | null
  mensajesList: any[] | null
  transaccion: boolean | null
  fechaRespuesta: string | null
}

export interface Order {
  id: number
  type: 'in_store' | 'online'
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'paid' | 'sent' | 'expired' | 'cancelled_for_edit'
  payment_type: 'cash' | 'card' | 'qr'
  codigoMetodoPago: number | null
  enabled: boolean
  shipment_price: number
  totalPrice: string
  address_data: any | null
  dhl_code: string | null
  createdAt: string
  expiresAt: string | null
  edited: boolean
  email: string | null
  name_phone: string | null
  inherited_id: number | null
  items: OrderItem[]
  customer: any | null
  shipment: any | null
  address: any | null
  billing: OrderBilling | null
  factura: OrderFactura | null
}

export interface BillingInfo {
  ci: string
  name?: string
  phone?: string
  email?: string
  complemento?: string
  codigoTipoDocumentoIdentidad: number
}

export interface BillingSearchResponse {
  id: number
  ci: string
  name: string
  phone: string
  email: string
  complemento: string
  codigoTipoDocumentoIdentidad: number
  createdAt: string
}

// Tipos para parametricas SIAT
export interface TipoDocumentoIdentidad {
  descripcion: string
  codigoClasificador: number
}

// Tipo para eventos significativos del catálogo SIAT
export interface EventoSignificativoParametrica {
  descripcion: string
  codigoClasificador: number
}

export interface ParametricaItem {
  id: number
  methodName: string
  payload: TipoDocumentoIdentidad[]
  createdAt: string
}

export interface ParametricasResponse {
  id: number
  codigoAmbiente: number
  codigoPuntoVenta: number
  codigoSistema: string
  codigoSucursal: number
  codigoCuis: string
  nit: string
  createdAt: string
  parametrica: ParametricaItem[]
}

export interface ParametricasRequest {
  metodo: string
}

// Tipos para verificar NIT
export interface VerificarNitRequest {
  nitParaVerificacion: number
}

export interface VerificarNitMensaje {
  codigo: number
  descripcion: string
}

export interface VerificarNitResponse {
  success: boolean
  data: {
    RespuestaVerificarNit: {
      mensajesList: VerificarNitMensaje[]
      transaccion: boolean
    }
  }
  timestamp: string
}

export interface CreateOrderRequest {
  items: string
  payment_type: 'cash' | 'card' | 'qr'
  billing: BillingInfo
}

export interface ConfirmOrderRequest {
  customerId?: string | number
}

export interface ConfirmOrderResponse {
  success: boolean
  orderId: number
  message: string
}
export interface CancelOrderRequest {
  orderId: number
}

export interface CancelOrderResponse {
  success: boolean
  message: string
}
export interface ProductColor {
  id: number
  multimedia: string[]
  pdfs: string[]
  product: {
    id: number
    name: string
    description: string
    price: string
    enabled: boolean
  }
}

export interface Variant {
  id: number
  productColor: ProductColor
}

export interface OrdersListParams {
  page?: number
  limit?: number
  type?: 'in_store' | 'online' | 'all'
  startDate?: string
  endDate?: string
  paymentType?: 'cash' | 'card' | 'qr'
  orderId?: number
  name?: string
  ci?: string
}

export interface OrdersListMeta {
  total: number
  page: number
  lastPage: number
  limit: number
  offset: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

export interface OrdersListResponse {
  data: Order[]
  meta: OrdersListMeta
}

// Tipos para el flujo de pago con QR
export interface GenerateQRRequest {
  orderId: number
  gloss: string
}

export interface GenerateQRResponse {
  id: string
  qr: string // Base64 del QR code
  success: boolean
  message: string
  gloss: string
  orderId: number
}

export type VerifyPaymentResponse =
  | boolean
  | {
      success: boolean
      paid: boolean
      message?: string
    }

// Tipos para sucursales
export interface Branch {
  id: number
  codigoSucursal: number
  name: string
  alias: string
  razonSocial: string
  actividadEconomica: string
  address: string
  departamento: string
  municipio: string
  telefono: string
  active: boolean
  createdAt: string
}

// Tipos para facturación
export interface FacturarRequest {
  branchId: number
  tipoFacturaDocumento: number
  codigoDocumentoSector: number
  codigoMoneda: number
  tipoCambio: number
  nombreRazonSocial: string
  numeroDocumento: string
  complemento: string
  codigoTipoDocumentoIdentidad: number
  usuario: string
  emails?: string[]
  descuentoAdicional: number
}

export interface FacturaDetalle {
  id: number
  actividadEconomica: string
  codigoProductoSin: number
  codigoProducto: string
  descripcion: string
  cantidad: number
  unidadMedida: number
  precioUnitario: number
  montoDescuento: number | null
  numeroSerie: string | null
  numeroImei: string | null
  subTotal: number
}

export interface Factura {
  id: number
  nitEmisor: number
  razonSocialEmisor: string
  municipio: string
  telefono: string
  numeroFactura: number
  cuf: string
  cufd: string
  codigoSucursal: number
  nombreSucursal: string
  direccion: string
  codigoPuntoVenta: number
  tipoFacturaDocumento: number
  fechaEmision: string
  nombreRazonSocial: string
  codigoTipoDocumentoIdentidad: number
  numeroDocumento: string
  complemento: string
  codigoCliente: string
  codigoMetodoPago: number
  numeroTarjeta: string | null
  montoTotal: number
  montoTotalSujetoIva: number
  codigoMoneda: number
  tipoCambio: number
  montoTotalMoneda: number
  montoGiftCard: number | null
  descuentoAdicional: number
  codigoExcepcion: number
  leyenda: string
  usuario: string
  emails: string[]
  codigoDocumentoSector: number
  estado: string
  xml: string
  codigoEmision: number
  createdAt: string
  codigoDescripcion: string
  codigoEstado: number
  codigoRecepcion: string
  mensajesList: any[] | null
  transaccion: boolean
  fechaRespuesta: string
  detalles: FacturaDetalle[]
  order?: Order
}

export interface FacturarResponse {
  response: {
    codigoDescripcion: string
    codigoEstado: number
    codigoRecepcion: string
    transaccion: boolean
  }
  factura: Factura
}

// Tipos para CUFD (Código Único de Factura Diaria)
export interface Cufd {
  id: number
  codigoAmbiente: number
  codigoModalidad: number
  codigoPuntoVenta: number
  codigoSistema: string
  codigoSucursal: number
  codigoCuis: string
  nit: string
  codigo: string
  codigoControl: string
  direccion: string
  fechaVigencia: string
  transaccion: boolean
  createdAt: string
}

// Tipos para CAFC (Código de Autorización de Facturación por Contingencia)
export interface Cafc {
  id: number
  codigo: string
  numeroInicial: string
  numeroFinal: string
  ultimoNumero: string
  createdAt: string
}

export interface CafcCreateRequest {
  codigo: string
  numeroInicial: number
  numeroFinal: number
}

// Request para facturación por contingencia (extiende facturación normal)
export interface FacturarContingenciaRequest extends FacturarRequest {
  cafc: string
  cufdId: number
  numeroTarjeta?: string | null
  montoGiftCard?: number
}

// Tipos para Eventos Significativos
export interface EventoSignificativo {
  id: number
  codigoAmbiente: number
  codigoMotivoEvento: number
  codigoPuntoVenta: number
  codigoSistema: string
  codigoSucursal: number
  codigoCufd: string
  cufdEvento: string
  codigoCuis: string
  descripcion: string
  fechaHoraFinEvento: string
  fechaHoraInicioEvento: string
  nit: string
  codigoRecepcionEventoSignificativo: string
  transaccion: boolean
  fechaRespuesta: string
}

export interface EventoSignificativoRequest {
  codigoMotivoEvento: number
  cufdEvento: string
  descripcion: string
  fechaHoraInicioEvento: string
  fechaHoraFinEvento: string
}

// Tipos para Paquetes de Contingencia
export interface Paquete {
  id: number
  codigoAmbiente: number
  codigoPuntoVenta: number
  codigoSistema: string
  codigoSucursal: number
  nit: string
  codigoDocumentoSector: number
  codigoEmision: string
  codigoModalidad: number
  codigoCufd: string
  codigoCuis: string
  tipoFacturaDocumento: number
  archivo: string
  fechaEnvio: string
  hashArchivo: string
  cafc: string
  cantidadFacturas: number
  codigoEvento: number
  codigoDescripcion: string | null
  codigoEstado: number | null
  codigoRecepcion: string | null
  mensajesList: any[] | null
  transaccion: boolean | null
  fechaRespuesta: string | null
}

export interface PaqueteContingenciaRequest {
  descripcionEvento: string
  codigoEvento: number
  cafc: string
  cufd: string
}

export interface PaqueteValidacionRequest {
  codigoRecepcion: string
}

export interface PaquetesListParams {
  codigoSucursal?: number
  codigoPuntoVenta?: number
  page?: number
  limit?: number
}

// Tipo para CUFD disponible por CAFC (para paquetes de contingencia)
export interface CufdByCafc {
  cufd: string
  cantidadFacturas: number
  fechaDesde: string
  fechaHasta: string
}

export interface PaquetesListResponse {
  data: Paquete[]
  meta: OrdersListMeta
}

// Motivos de Evento Significativo
export const MotivoEventoSignificativo = {
  CORTE_INTERNET: 1,
  INACCESIBILIDAD_SIAT: 2,
  VIRUS_FALLA_SOFTWARE: 3,
  CORTE_ENERGIA: 4,
  OTRO: 5
} as const

export const MotivoEventoDescripcion: Record<number, string> = {
  1: 'CORTE DEL SERVICIO DE INTERNET',
  2: 'INACCESIBILIDAD AL SERVICIO WEB DE LA ADMINISTRACIÓN TRIBUTARIA',
  3: 'VIRUS INFORMÁTICO O FALLA DE SOFTWARE',
  4: 'CORTE DE ENERGÍA ELÉCTRICA',
  5: 'OTRO'
}
