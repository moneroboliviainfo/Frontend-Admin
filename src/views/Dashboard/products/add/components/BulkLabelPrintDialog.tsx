'use client'

// Impresion de etiquetas en lote de UN producto, por stock de bodega central.
//
// La idea: en vez de abrir el QR de cada talla una por una, se arma de una sola
// vez el desglose completo del producto (color -> talla -> cuantas hay en
// bodega) y se manda todo a la DP30.
//
// El dialogo en si (las dos salidas, el tamaño, el desglose editable, el
// progreso) es `LabelBatchDialog`, compartido con las otras pantallas que
// etiquetan en lote. Aca solo se traduce la forma de los datos de este lugar:
// las variantes del producto y su `centralWarehouseStock`.
//
// Las cantidades llegan sugeridas desde el stock pero todo es editable: sirve
// igual para reimprimir una sola talla que se arruino.

import { useMemo } from 'react'

import LabelBatchDialog from '@/components/labels/LabelBatchDialog'
import type { LabelBatchRow } from '@/components/labels/LabelBatchDialog'
import type { Variant } from '@/types/api/variants'

interface Props {
  open: boolean
  onClose: () => void
  variants: Variant[]
  productName?: string
}

const BulkLabelPrintDialog = ({ open, onClose, variants, productName }: Props) => {
  // Todas las tallas del producto, con o sin stock: las de stock 0 las esconde
  // el filtro del dialogo, pero se arman siempre
  const rows = useMemo<LabelBatchRow[]>(() => {
    const filas: LabelBatchRow[] = []

    for (const variant of variants) {
      const colorName = variant.color?.name || variant.colorName || ''
      const colorCode = variant.color?.code || variant.colorCode || '#000'

      for (const variantSize of variant.variants) {
        if (!variantSize.id) continue

        const sizeName =
          typeof variantSize.size === 'object' ? (variantSize.size as any)?.name : String(variantSize.size || '')

        const stock = variantSize.centralWarehouseStock ?? 0

        filas.push({
          variantId: Number(variantSize.id),
          sku: variantSize.sku,
          productName,
          colorName,
          colorCode,
          sizeName,
          stock,

          // El caso normal es etiquetar lo que hay en bodega
          quantity: stock,
          hint: `${stock} en bodega`
        })
      }
    }

    return filas
  }, [variants, productName])

  return (
    <LabelBatchDialog
      open={open}
      onClose={onClose}
      title={`Imprimir etiquetas ${productName ? `· ${productName}` : ''}`}
      rows={rows}
      groupBy='color'
      stockFilter
    />
  )
}

export default BulkLabelPrintDialog
