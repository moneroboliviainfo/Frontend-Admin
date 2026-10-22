// Etiqueta de variante para impresora térmica de etiquetas (DP30S y similares).
// Lleva el QR, el producto, la talla, el color y el id — lo que se lee de un
// vistazo en la percha y lo que escanea el POS.
//
// Dos salidas, igual que la facturación: hoja (ventana de impresión del
// navegador) y térmica por Bluetooth (ESC/POS).

import { ESC_POS, connectBluetoothPrinter, isBluetoothConnected, printLine, writeToprinter } from './bluetoothPrinter'

export type LabelSize = {
  id: string
  label: string
  width: number
  height: number
}

// Las cuatro medidas de rollo que se usan. El armado es el mismo en todas
// —texto a la izquierda, QR a la derecha—; el alto solo cambia el tamaño de
// la tipografía.
export const LABEL_SIZES: LabelSize[] = [
  { id: '30x20', label: '30 × 20 mm', width: 30, height: 20 },
  { id: '40x40', label: '40 × 40 mm', width: 40, height: 40 },
  { id: '50x50', label: '50 × 50 mm', width: 50, height: 50 },
  { id: '50x25', label: '50 × 25 mm', width: 50, height: 25 }
]

export type VariantLabel = {
  variantId: number
  productName?: string
  colorName: string
  sizeName: string

  // PNG del QR en data URL: el SVG de pantalla no se imprime fiable
  qrDataUrl: string
}

// --------------------------------------------------------------- hoja / PDF

export const generateLabelHTML = (label: VariantLabel, size: LabelSize): string => {
  // Siempre el mismo armado: texto a la izquierda, QR a la derecha, en los
  // cuatro tamaños. El QR se topa al 42% del ancho para que el texto conserve
  // su mitad: a pura altura, en una etiqueta cuadrada se comeria la etiqueta.
  const qrSide = Math.min(size.height - 3, size.width * 0.42)

  // Las etiquetas bajas necesitan tipografias mas chicas para entrar
  const chica = size.height <= 25

  const texto = `
    ${label.productName ? `<div class="producto">${label.productName}</div>` : ''}
    <div class="talla">TALLA: ${label.sizeName}</div>
    <div class="color">COLOR: ${label.colorName}</div>
    <div class="id">ID: ${label.variantId}</div>`

  return `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="UTF-8">
    <title>Etiqueta ${label.variantId}</title>
    <style>
      @page {
        size: ${size.width}mm ${size.height}mm;
        margin: 0;
      }

      * { margin: 0; padding: 0; box-sizing: border-box; }

      body {
        width: ${size.width}mm;
        height: ${size.height}mm;
        padding: 1.5mm;
        font-family: Arial, Helvetica, sans-serif;
        font-weight: bold;
        color: #000;
        background: #fff;
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 1.5mm;
        overflow: hidden;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      img {
        width: ${qrSide}mm;
        height: ${qrSide}mm;
        flex: none;
        image-rendering: pixelated;
      }

      .texto {
        flex: 1;
        min-width: 0;
        text-align: left;
        line-height: 1.2;
      }

      /* El nombre nunca parte la etiqueta: una linea y se corta */
      .producto {
        font-size: ${chica ? 5 : 8}pt;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        margin-bottom: 0.3mm;
      }

      .talla { font-size: ${chica ? 7 : 11}pt; }
      .color { font-size: ${chica ? 6 : 9}pt; }
      .id { font-size: ${chica ? 4.5 : 6}pt; font-weight: normal; }

      @media screen {
        html {
          background: #f5f5f5;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        body {
          transform: scale(4);
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.25);
          border: 1px solid #ddd;
        }
      }
    </style>
  </head>
  <body>
    <div class="texto">${texto}</div>
    <img src="${label.qrDataUrl}" alt="" />
  </body>
</html>`
}

export const printVariantLabel = (label: VariantLabel, size: LabelSize): void => {
  const printWindow = window.open('', '_blank', 'width=700,height=600')

  if (!printWindow) return

  printWindow.document.write(generateLabelHTML(label, size))
  printWindow.document.close()
  printWindow.focus()

  // La imagen tiene que estar cargada antes de imprimir o sale la etiqueta vacía
  setTimeout(() => printWindow.print(), 500)
}

// ------------------------------------------------------------ Bluetooth

// QR nativo de ESC/POS (GS ( k): lo dibuja la impresora. Mandar el QR como
// imagen raster sale borroso en etiquetas chicas.
const qrCommands = (data: string, moduleSize: number): Uint8Array[] => {
  const bytes = new TextEncoder().encode(data)
  const length = bytes.length + 3

  return [
    // Modelo 2
    new Uint8Array([0x1d, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00]),

    // Tamaño del módulo (1-16): define cuánto ocupa el QR en la etiqueta
    new Uint8Array([0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, moduleSize]),

    // Corrección de errores M: sobrevive a un roce sin agrandar demasiado
    new Uint8Array([0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x31]),

    // Datos
    new Uint8Array([0x1d, 0x28, 0x6b, length & 0xff, (length >> 8) & 0xff, 0x31, 0x50, 0x30, ...bytes]),

    // Imprimir
    new Uint8Array([0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30])
  ]
}

export const printVariantLabelBluetooth = async (label: VariantLabel, size: LabelSize): Promise<void> => {
  if (!isBluetoothConnected()) await connectBluetoothPrinter()

  // En 20–25 mm de alto el QR tiene que achicarse o empuja el texto fuera
  const moduleSize = size.height <= 25 ? 4 : 6

  await writeToprinter(ESC_POS.INIT)
  await new Promise(resolve => setTimeout(resolve, 100))
  await writeToprinter(ESC_POS.FONT_B)
  await writeToprinter(ESC_POS.ALIGN_CENTER)

  for (const command of qrCommands(`<qr>${label.variantId}</qr>`, moduleSize)) {
    await writeToprinter(command)
  }

  await writeToprinter(ESC_POS.BOLD_ON)

  if (label.productName) await printLine(label.productName.slice(0, 24))
  await printLine(`TALLA: ${label.sizeName}`)
  await printLine(`COLOR: ${label.colorName}`)
  await writeToprinter(ESC_POS.BOLD_OFF)
  await printLine(`ID: ${label.variantId}`)

  await writeToprinter(ESC_POS.FEED_LINE)
}
