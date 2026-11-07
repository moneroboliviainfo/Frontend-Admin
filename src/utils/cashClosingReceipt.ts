// Comprobante de cierre de caja: el papel que se queda el cajero (y el
// encargado) con el arqueo del turno.
//
// Mismas dos salidas que los demas comprobantes: hoja desde la PC (la RG80 por
// el driver de Windows, igual que las facturas en tienda) y termica desde el
// celular (la MTP-4C por Bluetooth). No es un documento fiscal.
//
// Lo importante del formato: el efectivo va PRIMERO y separado, porque es lo
// unico que se cuenta en el cajon. Tarjeta y QR se informan aparte y se
// controlan contra los vouchers y el banco.

import { ESC_POS, connectBluetoothPrinter, isBluetoothConnected, printLine, writeToprinter } from './bluetoothPrinter'
import type { DailyCash } from '@/types/api/dailyCash'

const money = (value: string | null | undefined) => `Bs ${Number(value ?? 0).toFixed(2)}`

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return '-'

  const date = new Date(value)

  return `${date.toLocaleDateString('es-BO')} ${date.toLocaleTimeString('es-BO', {
    hour: '2-digit',
    minute: '2-digit'
  })}`
}

// Contra que se compara lo contado. Las cajas cerradas antes del 7/11/2026 no
// tienen `expectedCashAmount`: ahi el conteo era contra el total, y se respeta
// para no mostrarles una diferencia que en su momento no existia.
export const esperadoEnCajon = (cash: DailyCash): number =>
  Number(cash.expectedCashAmount ?? cash.expectedAmount ?? 0)

export const diferenciaDeCaja = (cash: DailyCash): number =>
  Number(cash.closingAmount ?? 0) - esperadoEnCajon(cash)

// Las cajas viejas no traen el desglose por medio de pago
export const tieneDesglosePorMedio = (cash: DailyCash): boolean =>
  cash.cashAmount !== null && cash.cashAmount !== undefined

// Una caja cerrada por el sistema que todavia nadie conto tiene closingAmount
// en null: calcular la diferencia ahi daria un faltante igual a TODO lo
// esperado, que es mentira. Se dice que falta el conteo y listo.
export const sinContar = (cash: DailyCash): boolean => !!cash.countPending || cash.closingAmount === null

const textoDiferencia = (cash: DailyCash): string => {
  if (sinContar(cash)) return 'CAJA SIN CONTAR'

  const diferencia = diferenciaDeCaja(cash)

  if (diferencia === 0) return 'LA CAJA CUADRA'

  return diferencia > 0 ? `SOBRA ${money(String(diferencia))}` : `FALTA ${money(String(Math.abs(diferencia)))}`
}

// ---------------------------------------------------------------- hoja (PC)

export const generateCashClosingHTML = (cash: DailyCash): string => {
  const conDesglose = tieneDesglosePorMedio(cash)

  const fila = (label: string, value: string, clase = '') =>
    `<div class="row ${clase}"><span>${label}</span><span>${value}</span></div>`

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Cierre de caja #${cash.id}</title>
      <style>
        @page { size: 80mm auto; margin: 0; }

        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
          font-family: Arial, Helvetica, sans-serif;
          font-size: 12px;
          font-weight: bold;
          width: 70mm;
          padding: 2mm 3mm 2mm 4mm;
          color: #000;
          background: #fff;
          line-height: 1.35;
        }

        @media screen {
          html { background: #f5f5f5; min-height: 100vh; padding: 20px; }
          body {
            transform: scale(2);
            transform-origin: top center;
            margin: 30px auto;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
          }
        }

        .center { text-align: center; }
        .title { font-size: 15px; }
        .sep { border-top: 1px dashed #000; margin: 4px 0; }
        .row { display: flex; justify-content: space-between; font-size: 11px; }
        .big { font-size: 13px; }
        .muted { font-size: 10px; font-weight: normal; }
      </style>
    </head>
    <body>
      <div class="center">
        <div class="title">CIERRE DE CAJA</div>
        <div>${cash.branch?.name || ''}</div>
        <div class="muted">Caja #${cash.id}</div>
      </div>

      <div class="sep"></div>

      ${fila('Abrio', cash.openedBy?.name || '-')}
      ${fila('Apertura', formatDateTime(cash.openedAt))}
      ${fila('Cierre', formatDateTime(cash.closedAt))}
      ${cash.autoClosed ? fila('', 'CIERRE AUTOMATICO') : fila('Cerro', cash.closedBy?.name || '-')}

      <div class="sep"></div>

      ${
        conDesglose
          ? `<div class="center">COBRADO POR MEDIO DE PAGO</div>
             ${fila('Efectivo', money(cash.cashAmount))}
             ${fila('Tarjeta', money(cash.cardAmount))}
             ${fila('QR', money(cash.qrAmount))}
             <div class="sep"></div>`
          : ''
      }

      ${cash.salesAmount !== null ? fila('Ventas', money(cash.salesAmount)) : ''}
      ${cash.advancesAmount !== null ? fila('Anticipos', money(cash.advancesAmount)) : ''}
      ${cash.refundsAmount !== null ? fila('Devoluciones', `- ${money(cash.refundsAmount)}`) : ''}

      <div class="sep"></div>

      <div class="center muted">EN EL CAJON (solo efectivo)</div>
      ${fila('Monto de apertura', money(cash.openingAmount))}
      ${fila('Esperado', money(String(esperadoEnCajon(cash))), 'big')}
      ${fila('Contado', sinContar(cash) ? 'sin contar' : money(cash.closingAmount), 'big')}

      <div class="sep"></div>

      <div class="center big">${textoDiferencia(cash)}</div>

      ${
        conDesglose
          ? `<div class="sep"></div>
             <div class="muted">Tarjeta y QR no se cuentan en el cajon: se controlan contra los vouchers y el banco.</div>`
          : ''
      }

      ${cash.closingNote ? `<div class="sep"></div><div class="muted">Nota: ${cash.closingNote}</div>` : ''}

      <div style="margin-top: 12mm" class="center muted">Firma del responsable</div>
      <div style="margin: 0 8mm" class="sep"></div>
    </body>
    </html>
  `
}

export const printCashClosing = (cash: DailyCash): void => {
  const printWindow = window.open('', '_blank', 'width=900,height=700')

  if (!printWindow) return

  printWindow.document.write(generateCashClosingHTML(cash))
  printWindow.document.close()
  printWindow.focus()

  // Sin la espera, Chrome imprime antes de aplicar los estilos
  setTimeout(() => printWindow.print(), 300)
}

// ------------------------------------------------------------ térmica (58mm)

// 32 caracteres por linea en FONT_B: el monto se alinea a la derecha
const row = (left: string, right: string, width = 32) => {
  const value = right.padStart(10)
  const label = left.length > width - 11 ? `${left.slice(0, width - 12)}.` : left

  return `${label.padEnd(width - 10)}${value}`
}

export const printCashClosingBluetooth = async (cash: DailyCash): Promise<void> => {
  if (!isBluetoothConnected()) await connectBluetoothPrinter()

  const conDesglose = tieneDesglosePorMedio(cash)

  await writeToprinter(ESC_POS.INIT)
  await new Promise(resolve => setTimeout(resolve, 100))
  await writeToprinter(ESC_POS.FONT_B)

  await writeToprinter(ESC_POS.ALIGN_CENTER)
  await writeToprinter(ESC_POS.BOLD_ON)
  await printLine('CIERRE DE CAJA')
  await writeToprinter(ESC_POS.BOLD_OFF)
  if (cash.branch?.name) await printLine(cash.branch.name)
  await printLine(`Caja #${cash.id}`)
  await writeToprinter(ESC_POS.LINE_SEPARATOR)

  await writeToprinter(ESC_POS.ALIGN_LEFT)
  await printLine(row('Abrio', cash.openedBy?.name || '-'))
  await printLine(row('Apertura', formatDateTime(cash.openedAt)))
  await printLine(row('Cierre', formatDateTime(cash.closedAt)))
  await printLine(cash.autoClosed ? 'CIERRE AUTOMATICO' : row('Cerro', cash.closedBy?.name || '-'))

  await writeToprinter(ESC_POS.LINE_SEPARATOR)

  if (conDesglose) {
    await writeToprinter(ESC_POS.ALIGN_CENTER)
    await printLine('COBRADO POR MEDIO DE PAGO')
    await writeToprinter(ESC_POS.ALIGN_LEFT)
    await printLine(row('Efectivo', money(cash.cashAmount)))
    await printLine(row('Tarjeta', money(cash.cardAmount)))
    await printLine(row('QR', money(cash.qrAmount)))
    await writeToprinter(ESC_POS.LINE_SEPARATOR)
  }

  if (cash.salesAmount !== null) await printLine(row('Ventas', money(cash.salesAmount)))
  if (cash.advancesAmount !== null) await printLine(row('Anticipos', money(cash.advancesAmount)))
  if (cash.refundsAmount !== null) await printLine(row('Devoluciones', `-${money(cash.refundsAmount)}`))

  await writeToprinter(ESC_POS.LINE_SEPARATOR)

  await writeToprinter(ESC_POS.ALIGN_CENTER)
  await printLine('EN EL CAJON (solo efectivo)')
  await writeToprinter(ESC_POS.ALIGN_LEFT)
  await printLine(row('Apertura', money(cash.openingAmount)))
  await writeToprinter(ESC_POS.BOLD_ON)
  await printLine(row('Esperado', money(String(esperadoEnCajon(cash)))))
  await printLine(row('Contado', sinContar(cash) ? 'sin contar' : money(cash.closingAmount)))
  await writeToprinter(ESC_POS.BOLD_OFF)

  await writeToprinter(ESC_POS.LINE_SEPARATOR)

  await writeToprinter(ESC_POS.ALIGN_CENTER)
  await writeToprinter(ESC_POS.BOLD_ON)
  await writeToprinter(ESC_POS.TEXT_2H)
  await printLine(textoDiferencia(cash))
  await writeToprinter(ESC_POS.TEXT_NORMAL)
  await writeToprinter(ESC_POS.BOLD_OFF)

  if (conDesglose) {
    await writeToprinter(ESC_POS.FEED_LINE)
    await writeToprinter(ESC_POS.ALIGN_LEFT)
    await printLine('Tarjeta y QR no se cuentan en el')
    await printLine('cajon: se controlan contra los')
    await printLine('vouchers y el banco.')
  }

  if (cash.closingNote) {
    await writeToprinter(ESC_POS.FEED_LINE)
    await writeToprinter(ESC_POS.ALIGN_LEFT)

    const nota = `Nota: ${cash.closingNote}`

    for (const chunk of nota.match(/.{1,32}/g) || [nota]) {
      await printLine(chunk)
    }
  }

  await writeToprinter(ESC_POS.FEED_LINE)
  await writeToprinter(ESC_POS.ALIGN_CENTER)
  await printLine('--------------------------------')
  await printLine('Firma del responsable')

  await writeToprinter(ESC_POS.FEED_3_LINES)
  await writeToprinter(ESC_POS.CUT_PAPER)
}
