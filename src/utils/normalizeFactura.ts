import type { Factura } from '@/types/api/sales'

// El back manda los decimales como texto ("12.50"). Los impresores hacen cuentas
// y .toFixed() sobre estos campos: con texto, el subtotal concatenaba en vez de
// sumar y .toFixed() rompia la impresion a la mitad (el encabezado ya habia salido).
// Se normaliza la factura entera, detalles incluidos, antes de imprimir.
const toNumber = (value: unknown): number => {
  const parsed = parseFloat(String(value ?? ''))

  return Number.isFinite(parsed) ? parsed : 0
}

export const normalizeFactura = (factura: Factura): Factura => ({
  ...factura,
  montoTotal: toNumber(factura.montoTotal),
  montoTotalSujetoIva: toNumber(factura.montoTotalSujetoIva),
  descuentoAdicional: toNumber(factura.descuentoAdicional),
  montoGiftCard: toNumber(factura.montoGiftCard),
  detalles: (factura.detalles || []).map(detalle => ({
    ...detalle,
    cantidad: toNumber(detalle.cantidad),
    precioUnitario: toNumber(detalle.precioUnitario),
    montoDescuento: toNumber(detalle.montoDescuento),
    subTotal: toNumber(detalle.subTotal)
  }))
})
