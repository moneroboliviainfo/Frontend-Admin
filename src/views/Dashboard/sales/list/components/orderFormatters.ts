// Formato y etiquetas de una orden, compartidos por el modal de detalle y sus
// secciones. Se movieron aca tal cual estaban en SaleDetailsModal: son funciones
// puras, sin estado ni hooks, asi que no cambia nada de la logica.

import type { Order } from '@/types/api/sales'

export const getEstadoColor = (estado: string): 'primary' | 'error' | 'success' | 'warning' => {
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

export const getEstadoLabel = (estado: string): string => {
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

export const getPaymentLabel = (paymentType: string): string => {
  const labels: Record<string, string> = {
    cash: 'Efectivo',
    card: 'Tarjeta',
    qr: 'QR',
    card_online: 'Tarjeta Online'
  }

  return labels[paymentType] || paymentType
}

// trackingCode puede venir null aunque el envio exista: ahi vale el de la respuesta de FedEx
export const getFedexTrackingNumber = (order: Order): string | null => {
  return (
    order.trackingCode || order.fedex_shipment_response?.output?.transactionShipments?.[0]?.masterTrackingNumber || null
  )
}

export const getFedexPdfUrl = (order: Order): string | null => {
  const shipment = order.fedex_shipment_response?.output?.transactionShipments?.[0]

  if (!shipment) return null

  const merged = shipment.shipmentDocuments?.find(doc => doc.contentType === 'MERGED_LABEL_DOCUMENTS')

  if (merged?.url) return merged.url
  if (shipment.shipmentDocuments?.[0]?.url) return shipment.shipmentDocuments[0].url

  // Con un solo bulto no hay documento combinado
  return shipment.pieceResponses?.[0]?.packageDocuments?.[0]?.url || null
}

export const getTipoLabel = (tipo: string): string => {
  return tipo === 'in_store' ? 'En Tienda' : 'En Línea'
}

export const formatDate = (dateString: string): string => {
  const date = new Date(dateString)

  return date.toLocaleDateString('es-BO', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}
