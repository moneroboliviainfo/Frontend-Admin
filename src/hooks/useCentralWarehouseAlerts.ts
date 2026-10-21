'use client'

import { useCentralWarehouse, usePendingCount } from '@/hooks/useBranchTransfers'
import { useUserRole } from '@/hooks/useUserRole'

// Lo que dentro de Bodega Central necesita al admin: envios de la bodega cerrados con
// faltantes que nadie reviso. Solo ADMIN/SUPERVISOR los resuelven.
// "En camino" no cuenta: espera a la tienda, no al admin.
// Lo usan el menu lateral y la pestaña Envios: comparten la misma consulta (cada 30 s)
export const useCentralWarehouseAlerts = () => {
  const { isAdminLike } = useUserRole()

  const { data: warehouse } = useCentralWarehouse(isAdminLike)

  // Son dos preguntas distintas al mismo endpoint, no se pueden unir:
  //
  //   con ?branchId=<bodega> → "envios que salen de la bodega": de ahi sale
  //     pendingReview (los que llegaron con faltantes sin revisar)
  //   sin branchId           → la vista de la central: ahi
  //     replenishmentsPending cuenta cuantas TIENDAS esperan ser atendidas
  //     (con branchId, ese campo responde otra cosa: doc 15 §3)
  const { data: deLaBodega } = usePendingCount(warehouse?.id, isAdminLike && !!warehouse?.id)
  const { data: deLaCentral } = usePendingCount(undefined, isAdminLike)

  return {
    pendingReview: deLaBodega?.pendingReview || 0,
    replenishmentsPending: deLaCentral?.replenishmentsPending || 0
  }
}

// Un envio de la central solo puede tener faltantes una vez recibido (lo que no salio de la
// bodega no es faltante, doc 11 §6), por eso la indicacion apunta a "Recibidos"
export const pendingReviewHint = (count: number) =>
  `${count === 1 ? '1 envío llegó' : `${count} envíos llegaron`} con faltantes. Revíselos en Envíos.`

export const replenishmentsHint = (count: number) =>
  `${count === 1 ? '1 tienda pidió' : `${count} tiendas pidieron`} reposición. Aténdalas en Reposiciones.`
