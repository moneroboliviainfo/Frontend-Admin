// Etiqueta de variante para impresora térmica de etiquetas (DP30S y similares).
// Lleva el QR, el producto, la talla, el color y el id — lo que se lee de un
// vistazo en la percha y lo que escanea el POS.
//
// Dos salidas, igual que la facturación: hoja (ventana de impresión del
// navegador) y formato POS por Bluetooth (ESC/POS). Las dos usan el mismo
// diseño (labelParts), asi la etiqueta sale igual desde la PC y desde el celular.

import { ESC_POS, connectBluetoothPrinter, isBluetoothConnected, writeToprinter } from './bluetoothPrinter'

export type LabelSize = {
  id: string
  label: string
  width: number
  height: number
}

// Las cuatro medidas de rollo que se usan. Las bajas llevan el QR al costado
// del texto; las cuadradas, el texto arriba y el QR abajo (ver layoutFor).
// Cada medida tiene que existir tambien como tamaño de papel en el driver.
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

// Armado y tipografias de cada medida, en pt. Jerarquia en todas: el producto
// completo arriba, talla y color chicos, y el id —el numero que se busca a
// ojo— en grande y sin rotulo.
type LabelLayout = {

  // 'side': el nombre arriba a todo el ancho; debajo talla, color e id a la
  //   izquierda y el QR pegado a la derecha (etiquetas bajas, apilado no entra)
  // 'stack': texto arriba y QR abajo (etiquetas cuadradas, sobra alto)
  mode: 'side' | 'stack'
  qrSide: number
  producto: number
  productoLineas: number
  detalle: number
  detalleLineas: number

  // mm que se corre a la derecha el bloque de talla/color/id, para acercarlo al QR
  sangria: number
  id: number
}

const layoutFor = (size: LabelSize): LabelLayout => {
  const padding = 1.5

  if (size.height < size.width * 0.75) {
    const chica = size.width <= 30

    return {
      mode: 'side',

      // Tope de ancho: el QR toma el alto que deja el nombre, pero sin pasar el
      // 45% del ancho para que talla y color conserven su lado
      qrSide: size.width * 0.45,

      // Con el nombre a todo el ancho entran 2 renglones. En 30 mm talla y color
      // van mas chicos para que entren completos en el lado del QR
      producto: chica ? 5.5 : 8.5,
      productoLineas: 2,
      detalle: chica ? 5.5 : 7.5,
      sangria: chica ? 1.5 : 4,
      detalleLineas: chica ? 3 : 2,
      id: chica ? 8 : 13
    }
  }

  const grande = size.width >= 50

  // El QR toma todo el alto que deja el texto (ver .qrbox): el id un poco mas
  // chico que el maximo posible le deja mas lugar al QR
  return {
    mode: 'stack',
    qrSide: size.width - padding * 2,
    producto: grande ? 10 : 8,
    productoLineas: 2,
    detalle: grande ? 7.5 : 6,
    detalleLineas: 2,
    sangria: 0,
    id: grande ? 15 : 12
  }
}

// "PANTALÓN MONERO" → "Pantalón monero": se lee mejor que todo en mayusculas y
// ocupa menos ancho. La talla no pasa por aca: XL, M o 28 van tal cual
const sentenceCase = (text: string) =>
  text ? text.charAt(0).toLocaleUpperCase('es') + text.slice(1).toLocaleLowerCase('es') : text

// Los nombres vienen del catalogo: un "&" o un "<" romperia el armado (y en el
// formato POS, el XML del SVG)
const escapeText = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// El diseño de la etiqueta, una sola vez: lo usan la hoja (PC) y el formato POS
// (Bluetooth), asi las dos salen iguales. Devuelve el CSS de .etiqueta y su contenido
const labelParts = (label: VariantLabel, size: LabelSize) => {
  const layout = layoutFor(size)
  const stack = layout.mode === 'stack'

  const producto = label.productName
    ? `<div class="producto">${escapeText(sentenceCase(label.productName))}</div>`
    : ''

  const detalles = `
    <div class="detalle">Talla: ${escapeText(label.sizeName)}</div>
    <div class="detalle">Color: ${escapeText(sentenceCase(label.colorName))}</div>
    <div class="id">${label.variantId}</div>`

  const qr = `<img src="${label.qrDataUrl}" alt="" />`

  const markup = stack
    ? `<div class="texto">${producto}${detalles}</div><div class="qrbox">${qr}</div>`
    : `${producto}<div class="fila"><div class="texto"><div>${detalles}</div></div>${qr}</div>`

  const css = `
      .etiqueta, .etiqueta * { margin: 0; padding: 0; box-sizing: border-box; }

      .etiqueta {
        width: ${size.width}mm;
        height: ${size.height}mm;
        padding: 1.5mm;
        font-family: Arial, Helvetica, sans-serif;
        font-weight: bold;
        color: #000;
        background: #fff;
        display: flex;
        flex-direction: column;
        align-items: ${stack ? 'center' : 'stretch'};
        justify-content: flex-start;
        gap: 0.5mm;
        overflow: hidden;
        line-height: 1.15;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      /* El QR ocupa todo el alto que deja el texto, siempre cuadrado. Asi crece
         al maximo y nunca se sale de la etiqueta aunque el texto ocupe mas */
      .etiqueta img {
        flex: none;
        height: 100%;
        width: auto;
        aspect-ratio: 1 / 1;
        max-width: ${layout.qrSide}mm;
        image-rendering: pixelated;
      }

      /* Cuadradas: debajo del texto, centrado */
      .qrbox {
        flex: 1;
        min-height: 0;
        width: 100%;
        display: flex;
        justify-content: center;
        align-items: center;
      }

      .texto {
        ${stack ? 'width: 100%; text-align: center;' : 'flex: 1; min-width: 0;'}
      }

      /* Bajas: talla, color e id centrados en el lado izquierdo, o sea mas
         cerca del QR, pero alineados entre si a la izquierda */
      ${
        stack
          ? ''
          : `.texto {
        display: flex;
        justify-content: center;

        /* Con un color largo el bloque llena el lado y centrar no lo mueve:
           la sangria lo corre igual hacia el QR */
        padding-left: ${layout.sangria}mm;
      }

      .texto > div {
        min-width: 0;
        text-align: left;
      }`
      }

      /* Debajo del nombre: talla, color e id y el QR pegado a la derecha */
      .fila {
        flex: 1;
        min-height: 0;
        display: flex;
        align-items: center;
        gap: 1mm;
      }

      /* El nombre va completo, partido en renglones. El tope de renglones es
         solo un resguardo para nombres larguisimos: sin el, empujaria al QR
         fuera de la etiqueta */
      .producto {
        font-size: ${layout.producto}pt;
        overflow-wrap: anywhere;
        display: -webkit-box;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: ${layout.productoLineas};
        overflow: hidden;
        margin-bottom: 0.3mm;
      }

      /* Talla y color completos: si no entran en un renglon pasan al siguiente.
         El tope de renglones es el mismo resguardo que el del nombre */
      .detalle {
        font-size: ${layout.detalle}pt;
        overflow-wrap: anywhere;
        display: -webkit-box;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: ${layout.detalleLineas};
        overflow: hidden;
      }

      /* El id es lo que se busca a ojo: grande y sin rotulo */
      .id {
        font-size: ${layout.id}pt;
        line-height: 1;
        margin-top: 0.3mm;
      }`

  return { css, markup }
}

export const generateLabelHTML = (label: VariantLabel, size: LabelSize): string => {
  const { css, markup } = labelParts(label, size)

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

      html, body { margin: 0; padding: 0; }
      ${css}

      @media screen {
        body {
          background: #f5f5f5;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .etiqueta {
          transform: scale(4);
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.25);
          border: 1px solid #ddd;
        }
      }
    </style>
  </head>
  <body>
    <div class="etiqueta">${markup}</div>
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

// ------------------------------------------------- formato POS (Bluetooth)
//
// Mismo protocolo y misma conexion que la factura termica (ESC/POS por
// bluetoothPrinter.ts), pero la etiqueta no se arma con renglones de texto: con
// texto la impresora solo escribe un renglon debajo del otro y no puede poner
// el QR al costado ni usar las tipografias de cada medida. Se dibuja el MISMO
// diseño de la hoja (labelParts) a la resolucion de la impresora y se manda
// como imagen ESC/POS, asi sale igual que desde la PC.

// 203 dpi = 8 puntos por milimetro
const DOTS_PER_MM = 8

// CSS trabaja a 96 px por pulgada: los mm y pt del diseño se resuelven sobre esto
const PX_PER_MM = 96 / 25.4

type LabelBitmap = {
  widthBytes: number
  height: number

  // 1 bit por punto, 1 = negro, filas de arriba hacia abajo
  data: Uint8Array
}

// Dibuja el HTML de la etiqueta en un canvas sin librerias: el navegador pinta
// HTML dentro de un SVG (foreignObject) y el SVG se dibuja como cualquier imagen
export const renderLabelBitmap = async (label: VariantLabel, size: LabelSize): Promise<LabelBitmap> => {
  const { css, markup } = labelParts(label, size)

  const cssWidth = size.width * PX_PER_MM
  const cssHeight = size.height * PX_PER_MM

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${cssWidth}" height="${cssHeight}">
  <foreignObject x="0" y="0" width="100%" height="100%">
    <div xmlns="http://www.w3.org/1999/xhtml">
      <style>${css}</style>
      <div class="etiqueta">${markup}</div>
    </div>
  </foreignObject>
</svg>`

  const image = new Image()

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = () => reject(new Error('No se pudo dibujar la etiqueta'))
    image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
  })

  // El ancho en puntos tiene que ser multiplo de 8: cada byte son 8 puntos
  const width = Math.ceil((size.width * DOTS_PER_MM) / 8) * 8
  const height = Math.round(size.height * DOTS_PER_MM)

  const canvas = document.createElement('canvas')

  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d')

  if (!ctx) throw new Error('No se pudo dibujar la etiqueta')

  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(image, 0, 0, width, height)

  // Termica = blanco o negro. El corte va por encima del gris medio: el borde
  // suavizado de las letras cuenta como negro y la negrita no sale finita
  const pixels = ctx.getImageData(0, 0, width, height).data
  const widthBytes = width / 8
  const data = new Uint8Array(widthBytes * height)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const luminance = pixels[i] * 0.299 + pixels[i + 1] * 0.587 + pixels[i + 2] * 0.114

      if (luminance < 170) data[y * widthBytes + (x >> 3)] |= 0x80 >> (x & 7)
    }
  }

  return { widthBytes, height, data }
}

// Imagen raster ESC/POS (GS v 0), por franjas: una imagen entera de una vez puede
// pasar el buffer de la impresora
const BAND_ROWS = 48

// Pausa entre paquetes Bluetooth al mandar la imagen. Si la impresora pierde
// datos (sale cortada o con rayas), subirla hacia los 20 ms de la factura
const RASTER_PAUSE_MS = 6

const rasterCommands = ({ widthBytes, height, data }: LabelBitmap): Uint8Array[] => {
  const commands: Uint8Array[] = []

  for (let top = 0; top < height; top += BAND_ROWS) {
    const rows = Math.min(BAND_ROWS, height - top)
    const header = [0x1d, 0x76, 0x30, 0x00, widthBytes & 0xff, widthBytes >> 8, rows & 0xff, rows >> 8]
    const band = data.slice(top * widthBytes, (top + rows) * widthBytes)
    const command = new Uint8Array(header.length + band.length)

    command.set(header)
    command.set(band, header.length)
    commands.push(command)
  }

  return commands
}

// GS FF: avanza hasta el inicio de la etiqueta siguiente (impresoras de etiquetas
// en modo ESC/POS). Si la impresora no lo entiende lo ignora
const FEED_TO_NEXT_LABEL = new Uint8Array([0x1d, 0x0c])

export const printVariantLabelBluetooth = async (label: VariantLabel, size: LabelSize): Promise<void> => {
  // Se dibuja antes de conectar: si falla el dibujo no se ocupa la impresora
  const bitmap = await renderLabelBitmap(label, size)

  if (!isBluetoothConnected()) await connectBluetoothPrinter()

  await writeToprinter(ESC_POS.INIT)
  await new Promise(resolve => setTimeout(resolve, 100))

  // Una etiqueta son miles de bytes (50x50 = 20.000): con la pausa de 20 ms de la
  // factura tardaria unos 20 s. La imagen va con pausas cortas entre paquetes
  for (const command of rasterCommands(bitmap)) {
    await writeToprinter(command, RASTER_PAUSE_MS)
  }

  await writeToprinter(FEED_TO_NEXT_LABEL)
}
