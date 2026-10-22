// Comprobante de recepción de un traslado: el papel que se firma a mano al
// recibir la mercadería. Formato igual al de las facturas (misma hoja y misma
// térmica), pero con su propio contenido: no es un documento fiscal.
//
// Se imprime ANTES de confirmar: los datos ya están en el modal, y el papel se
// firma en el momento en que las dos personas están frente al paquete.

import { ESC_POS, connectBluetoothPrinter, isBluetoothConnected, printLine, writeToprinter } from './bluetoothPrinter'

export type ReceiptLine = {
  label: string
  dispatched: number
  received: number
}

export type ReceptionReceipt = {
  transferId: number
  origin: string
  destination: string

  // 'Bodega de la sucursal' o 'Tienda', lo que eligió el cajero
  location: string
  lines: ReceiptLine[]
  note?: string

  // Quien recibe: el usuario logueado. Quien entrega firma a mano, por eso solo
  // se imprime el nombre de la sucursal de origen.
  receivedBy: string
}

const formatDateTime = (date: Date) =>
  `${date.toLocaleDateString('es-BO')} ${date.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })}`

// ---------------------------------------------------------------- hoja (PC)

export const generateReceptionHTML = (receipt: ReceptionReceipt): string => {
  const now = formatDateTime(new Date())

  const rows = receipt.lines
    .map(line => {
      const short = line.received < line.dispatched

      return `
        <div class="item${short ? ' short' : ''}">
          <div class="prenda">${line.label}</div>
          <div class="cant">
            <span>Despachado ${line.dispatched}</span>
            <span>Recibido ${line.received}</span>
          </div>
          ${short ? `<div class="falta">Faltan ${line.dispatched - line.received}</div>` : ''}
        </div>`
    })
    .join('')

  const totalDispatched = receipt.lines.reduce((sum, line) => sum + line.dispatched, 0)
  const totalReceived = receipt.lines.reduce((sum, line) => sum + line.received, 0)

  // El bloque de pagina es el MISMO que el de la factura (invoicePrinter.ts):
  // 80mm de rollo con 70mm utiles, ya calibrado contra la impresora MT. No
  // tocar sin volver a calibrar.
  return `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="UTF-8">
    <title>Recepcion traslado #${receipt.transferId}</title>
    <style>
      @page {
        size: 80mm auto;
        margin: 0;
      }

      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }

      body {
        font-family: Arial, Helvetica, sans-serif;
        font-size: 12px;
        font-weight: bold;
        width: 70mm;
        padding: 2mm 3mm 2mm 4mm;
        color: #000;
        background: #fff;
        margin: 0;
        line-height: 1.3;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      @media screen {
        html {
          background: #f5f5f5;
          min-height: 100vh;
          padding: 20px;
        }
        body {
          transform: scale(2);
          transform-origin: top center;
          margin: 30px auto;
          box-shadow: 0 2px 10px rgba(0,0,0,0.2);
          border-radius: 4px;
          background: #fff;
        }
      }

      @media print {
        body {
          transform: none;
          margin: 0;
          margin-left: -0.2mm;
          padding-left: 0;
          font-weight: bold;
        }
      }

      .header { text-align: center; margin-bottom: 3px; }
      .titulo { font-size: 14px; margin-bottom: 2px; }
      .sub { font-size: 11px; }
      .sep { border-top: 1px dashed #000; margin: 4px 0; }
      .dato { display: flex; justify-content: space-between; font-size: 11px; margin: 1px 0; }
      .dato span:first-child { font-weight: normal; }
      .item { margin: 4px 0; }
      .prenda { font-size: 11px; }
      .cant { display: flex; justify-content: space-between; font-size: 11px; font-weight: normal; }
      .item.short .cant { font-weight: bold; }
      .falta { font-size: 11px; text-align: right; }
      .total { display: flex; justify-content: space-between; font-size: 12px; margin-top: 2px; }
      .nota { font-size: 11px; font-weight: normal; margin-top: 4px; }
      .firma { text-align: center; margin-top: 14mm; }
      .firma .linea { border-top: 1px solid #000; margin: 0 4mm 2px; }
      .firma .rol { font-size: 11px; }
      .firma .aclara { font-size: 10px; font-weight: normal; }
      .pie { text-align: center; font-size: 9px; font-weight: normal; margin-top: 6px; }
    </style>
  </head>
  <body>
    <div class="header">
      <div class="titulo">COMPROBANTE DE RECEPCION</div>
      <div class="sub">Traslado #${receipt.transferId}</div>
      <div class="sub">${now}</div>
    </div>

    <div class="sep"></div>

    <div class="dato"><span>Viene de</span><span>${receipt.origin}</span></div>
    <div class="dato"><span>Recibe</span><span>${receipt.destination}</span></div>
    <div class="dato"><span>Ingresa a</span><span>${receipt.location}</span></div>

    <div class="sep"></div>

    ${rows}

    <div class="sep"></div>

    <div class="total"><span>TOTAL</span><span>${totalReceived} de ${totalDispatched}</span></div>

    ${receipt.note ? `<div class="nota">Obs: ${receipt.note}</div>` : ''}

    <div class="firma">
      <div class="linea"></div>
      <div class="rol">Entrega</div>
      <div class="aclara">${receipt.origin}</div>
    </div>

    <div class="firma">
      <div class="linea"></div>
      <div class="rol">Recibe</div>
      <div class="aclara">${receipt.receivedBy}</div>
    </div>

    <div class="pie">Las cantidades recibidas son las que quedan registradas.</div>
  </body>
</html>`
}

export const printReceptionReceipt = (receipt: ReceptionReceipt): void => {
  const printWindow = window.open('', '_blank', 'width=900,height=700')

  if (!printWindow) return

  printWindow.document.write(generateReceptionHTML(receipt))
  printWindow.document.close()
  printWindow.focus()

  // Sin la espera, Chrome imprime antes de aplicar los estilos
  setTimeout(() => printWindow.print(), 300)
}

// ------------------------------------------------------------ térmica (58mm)

// 32 caracteres por línea en FONT_B: el nombre se corta para que la cantidad
// no caiga a la línea siguiente
const row = (left: string, right: string, width = 32) => {
  const value = right.padStart(5)
  const label = left.length > width - 6 ? `${left.slice(0, width - 7)}.` : left

  return `${label.padEnd(width - 5)}${value}`
}

export const printReceptionReceiptBluetooth = async (receipt: ReceptionReceipt): Promise<void> => {
  if (!isBluetoothConnected()) await connectBluetoothPrinter()

  await writeToprinter(ESC_POS.INIT)
  await new Promise(resolve => setTimeout(resolve, 100))
  await writeToprinter(ESC_POS.FONT_B)

  await writeToprinter(ESC_POS.ALIGN_CENTER)
  await writeToprinter(ESC_POS.BOLD_ON)
  await printLine('COMPROBANTE DE RECEPCION')
  await writeToprinter(ESC_POS.BOLD_OFF)
  await printLine(`Traslado #${receipt.transferId}`)
  await printLine(formatDateTime(new Date()))
  await writeToprinter(ESC_POS.LINE_SEPARATOR)

  await writeToprinter(ESC_POS.ALIGN_LEFT)
  await printLine(`Viene de: ${receipt.origin}`)
  await printLine(`Recibe:   ${receipt.destination}`)
  await printLine(`Ingresa a: ${receipt.location}`)
  await writeToprinter(ESC_POS.LINE_SEPARATOR)

  await printLine(row('PRENDA', 'DESP/REC'))

  for (const line of receipt.lines) {
    await printLine(row(line.label, `${line.dispatched}/${line.received}`))
  }

  await writeToprinter(ESC_POS.LINE_SEPARATOR)

  if (receipt.note) {
    await printLine(`Obs: ${receipt.note}`)
    await writeToprinter(ESC_POS.LINE_SEPARATOR)
  }

  // Espacio real para firmar: sin esto las lineas quedan pegadas al texto
  await writeToprinter(ESC_POS.ALIGN_CENTER)
  await writeToprinter(ESC_POS.FEED_3_LINES)
  await printLine('______________________')
  await printLine('Entrega')
  await printLine(receipt.origin)
  await writeToprinter(ESC_POS.FEED_3_LINES)
  await printLine('______________________')
  await printLine('Recibe')
  await printLine(receipt.receivedBy)

  await writeToprinter(ESC_POS.FEED_5_LINES)
  await writeToprinter(ESC_POS.CUT_PAPER)
}
