// En que sucursal vale un descuento.
//
// Desde el 06/11/2026 un descuento se asigna a sucursales y canales concretos.
// `appliesInStore` / `appliesOnline` quedaron como un RESUMEN —"aplica en ese
// canal de alguna sucursal"— y por eso no sirven para decidir si mostrarlo:
// con ellos, el POS de la sucursal B mostraba el precio rebajado de un
// descuento que era solo de la A, y despues cobraba el precio lleno.
//
// El precio final siempre lo calcula el back con la sucursal de la venta: esto
// es solo para que la pantalla muestre lo mismo que se va a cobrar.

import type { ProductDiscount } from '@/types/api/variants'

export const aplicaEnSucursal = (
  discount: ProductDiscount | null | undefined,
  branchId: number | null | undefined,
  channel: 'in_store' | 'online' = 'in_store'
): boolean => {
  if (!discount) return false

  // Sin `branches` no hay con que decidir: pasa con un back viejo o si el
  // endpoint no lo manda. Se cae al resumen, que es lo que habia antes
  if (!discount.branches) {
    return channel === 'online' ? !!discount.appliesOnline : !!discount.appliesInStore
  }

  // Sin sucursal conocida no se puede afirmar que aplique
  if (!branchId) return false

  return discount.branches.some(b => b.branchId === branchId && b.channel === channel)
}
