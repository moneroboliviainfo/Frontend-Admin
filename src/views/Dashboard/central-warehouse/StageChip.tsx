'use client'

import Chip from '@mui/material/Chip'
import Tooltip from '@mui/material/Tooltip'

import type { BranchTransfer } from '@/types/api/branchTransfer'
import { stageOf } from './transfers'

const formatDate = (value: string | null) => (value ? new Date(value).toLocaleString('es-BO') : null)

// Que significa cada etapa. La etapa la calcula el back segun quien mira (doc 15 §4):
// el mismo pedido es "Por despachar" para la tienda origen y "Esperando despacho" para la que pidio
const hintOf = (transfer: BranchTransfer): string => {
  const isRequest = transfer.type === 'branch_request'
  const origin = transfer.sourceBranch?.name || (isRequest ? 'la tienda origen' : 'la bodega')
  const destination = transfer.destinationBranch?.name || 'la tienda destino'
  const holdUntil = formatDate(transfer.holdUntil)
  const deadline = formatDate(transfer.pickupDeadline)

  switch (transfer.stage) {
    // Reposiciones
    case 'to_attend':
      return `${destination} pidió estas variantes. Falta que la central elija cuánto mandar o la rechace.`
    case 'awaiting_central':
      return 'La central todavía no la atendió. Mientras tanto se pueden agregar o quitar variantes.'
    case 'rejected':
      return 'La central la atendió con todo en 0: no se mandó nada. El motivo está en el detalle.'

    // Cobro del anticipo
    case 'awaiting_payment':
      return 'Pedido cobrado por QR: el cliente todavía no pagó. La prenda queda apartada mientras el QR esté vigente.'
    case 'payment_expired':
      return 'El QR venció sin pago y la prenda dejó de estar apartada. Se puede generar otro QR o anular el pedido.'

    // Despacho
    case 'awaiting_dispatch':
      return `${origin} todavía no lo envió. La prenda ya está apartada allá. Se puede anular hasta que salga.`
    case 'to_dispatch':
      return `${destination} le pidió esto a su tienda: hay que despacharlo (todo, una parte o nada).`

    // En camino
    case 'to_receive':
      return 'Ya salió y viene en camino hacia su tienda. Hay que recibirlo cuando llegue.'
    case 'in_transit':
      return isRequest
        ? `Salió de ${origin} y todavía no lo recibe ${destination}.`
        : `Salió de la bodega y todavía no lo recibe ${destination}. Mientras tanto no figura en el stock de nadie.`

    // Despues de recibir (pedidos)
    case 'awaiting_customer':
      return `Llegó y espera a su cliente${deadline ? ` hasta el ${deadline}` : ''}.${
        holdUntil ? ` Apartado para él hasta el ${holdUntil}.` : ' No está apartado: se puede vender a otro.'
      }`
    case 'delivered':
      return `Se entregó a ${destination}. Lo que pase con el cliente ya es de esa tienda.`
    case 'picked_up':
      return `El cliente lo retiró${transfer.pickupOrderId ? ` con la venta #${transfer.pickupOrderId}` : ''}.`
    case 'not_picked_up':
      return 'Se marcó que el cliente no lo retiró. La prenda quedó libre para la venta.'
    case 'pickup_expired':
      return 'Venció el plazo y el cliente no vino. Si el pedido no estaba cobrado, todavía se le puede entregar.'

    // Cierres
    case 'received':
      return isRequest ? 'Se recibió, pero no llegó ninguna prenda.' : 'La tienda lo recibió y ya está en su stock.'
    case 'not_found':
      return `${origin} no encontró nada de lo pedido. Hay que avisarle al cliente.`
    case 'lost':
      return 'Salió y nunca llegó. Se dio por perdido: no volvió a ningún lado.'
    case 'cancelled':
      return transfer.dispatchedAt
        ? `Se anuló en camino: lo enviado volvió a ${isRequest ? origin : 'la bodega'}.`
        : 'Se anuló antes de salir: no se movió mercadería.'
    default:
      return ''
  }
}

// Chip de etapa con su explicacion al pasar el mouse
const StageChip = ({ transfer }: { transfer: BranchTransfer }) => {
  const stage = stageOf(transfer)
  const hint = hintOf(transfer)
  const chip = <Chip label={stage.label} size='small' variant='tonal' color={stage.color} />

  if (!hint) return chip

  return (
    <Tooltip title={hint} arrow>
      {chip}
    </Tooltip>
  )
}

// Acompaña a la etapa cuando el traslado cerro con faltantes: lo resuelve la central
export const PendingReviewChip = () => (
  <Tooltip
    title='Llegó menos de lo enviado (o el origen no encontró todo). Un administrador debe indicar qué pasó con cada faltante: se perdió, apareció en el destino o apareció en el origen.'
    arrow
  >
    <Chip label='Faltantes por revisar' size='small' variant='tonal' color='warning' />
  </Tooltip>
)

export default StageChip
