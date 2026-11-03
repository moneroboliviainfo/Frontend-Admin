// Etiqueta de variante para impresora térmica de etiquetas (DP30S y similares).
// Lleva el QR, el producto, la talla, el color y el id — lo que se lee de un
// vistazo en la percha y lo que escanea el POS.
//
// Dos salidas, igual que la facturación: hoja (ventana de impresión del
// navegador, via labelParts) y formato POS por Bluetooth (ESC/POS, via drawLabel).
// Las dos siguen las mismas medidas y tipografias (layoutFor), asi la etiqueta
// sale igual desde la PC y desde el celular.

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
  sku?: string
  productName?: string
  colorName: string
  sizeName: string

  // PNG del QR en data URL: el SVG de pantalla no se imprime fiable
  qrDataUrl: string
}

// --------------------------------------------------------------- hoja / PDF

// Armado y tipografias de cada medida, en pt. Jerarquia en todas: el producto
// completo arriba, talla y color chicos, y el SKU —el codigo que se busca a
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
  id: number

  // Aire, en mm: entre talla y color (cada uno es un parrafo: si no entra en un
  // renglon baja dentro del suyo) y el espacio marcado antes del SKU
  parrafo: number
  antesDelSku: number
}

const layoutFor = (size: LabelSize): LabelLayout => {
  const padding = 1.5

  if (size.height < size.width * 0.75) {
    const chica = size.width <= 30

    return {
      mode: 'side',

      // Lado fijo del QR en mm, el mismo en toda etiqueta de esta medida. Entra
      // con el nombre en sus 2 renglones: 30x20 deja ~11 mm de alto, 50x25 ~12,8
      qrSide: chica ? 10 : 12,

      // Con el nombre a todo el ancho entran 2 renglones. En 30 mm talla y color
      // van mas chicos para que entren completos en el lado del QR
      producto: size.id === '30x20' ? 6 : 9.5,
      productoLineas: 2,
      detalle: size.id === '30x20' ? 5 : 7.5,
      detalleLineas: chica ? 3 : 2,
      id: chica ? 5 : 7,
      parrafo: chica ? 0.6 : 1,
      antesDelSku: chica ? 0.8 : 1.2
    }
  }

  const grande = size.width >= 50

  // Lado fijo del QR en mm. Entra aun con nombre y color en 2 renglones cada uno
  // (el texto ocupa hasta ~22 mm en 40x40 y ~27 mm en 50x50)
  return {
    mode: 'stack',
    qrSide: Math.min(size.width - padding * 2, grande ? 19 : 15),
    producto: grande ? 11 : 9,
    productoLineas: 2,
    detalle: grande ? 7.5 : 6,
    detalleLineas: 2,
    id: grande ? 9 : 7,
    parrafo: grande ? 1.2 : 1,
    antesDelSku: grande ? 2 : 1.5
  }
}

// "PANTALÓN MONERO" → "Pantalón monero": se lee mejor que todo en mayusculas y
// ocupa menos ancho. La talla no pasa por aca: XL, M o 28 van tal cual
const sentenceCase = (text: string) =>
  text ? text.charAt(0).toLocaleUpperCase('es') + text.slice(1).toLocaleLowerCase('es') : text

// Los nombres vienen del catalogo: un "&" o un "<" romperia el armado de la hoja
// (el formato POS no pasa por HTML: dibuja el texto tal cual en el canvas)
const escapeText = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// El diseño de la etiqueta, una sola vez: lo usan la hoja (PC) y el formato POS
// (Bluetooth), asi las dos salen iguales. Devuelve el CSS de .etiqueta y su contenido
const labelParts = (label: VariantLabel, size: LabelSize) => {
  const layout = layoutFor(size)
  const stack = layout.mode === 'stack'
  const compactHorizontal = size.id === '30x20'

  const producto = label.productName
    ? `<div class="producto">${escapeText(label.productName)}</div>`
    : ''

  const detalles = `
    <div class="detalle">Talla: ${escapeText(label.sizeName)}</div>
    <div class="detalle">Color: ${escapeText(sentenceCase(label.colorName))}</div>
    <div class="id">${escapeText(label.sku || String(label.variantId))}</div>`

  const qr = `<img src="${label.qrDataUrl}" alt="" />`

  const markup = stack
    ? `<div class="texto">${producto}${detalles}</div><div class="qrbox">${qr}</div>`
    : `${producto}<div class="fila"><div class="texto">${detalles}</div>${qr}</div>`

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
        gap: ${compactHorizontal ? '0.25mm' : '0.5mm'};
        overflow: hidden;

        /* Renglones con aire: pegados se leian amontonados */
        line-height: 1.3;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      /* El QR tiene un solo tamaño por medida y siempre es cuadrado: no crece ni
         se achica con el texto, el texto se acomoda alrededor. Va sin margen
         blanco propio (ver VariantQRModal): con margen, el recuadro blanco tapaba
         las letras de al lado */
      .etiqueta img {
        flex: none;
        width: ${layout.qrSide}mm;
        height: ${layout.qrSide}mm;
        image-rendering: pixelated;
      }

      /* Cuadradas: el QR centrado en el alto que deja el texto, sin achicarse nunca */
      .qrbox {
        ${stack ? 'flex: 1 0 auto; width: 100%; display: flex; justify-content: center; align-items: center;' : ''}
      }

      /* Si algun texto fuera larguisimo, cede el texto y no el QR */
      .texto {
        ${stack ? 'width: 100%; text-align: center; flex: 0 1 auto; min-height: 0; overflow: hidden;' : 'flex: 0 1 auto; min-width: 0; text-align: left;'}
      }

      /* Bajas, debajo del nombre: talla/color/SKU y el QR forman un bloque
         centrado en la etiqueta, con el mismo aire a izquierda y derecha. El
         texto ocupa lo que necesita (si es largo, baja de renglon) y el QR va
         a su lado */
      .fila {
        flex: 1;
        min-height: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: ${compactHorizontal ? 1.5 : 3}mm;
      }

      /* El nombre va completo, partido en renglones. El tope de renglones es
         solo un resguardo para nombres larguisimos: sin el, empujaria al QR
         fuera de la etiqueta */
      .producto {
        font-size: ${layout.producto}pt;

        /* El titulo va centrado en todas las medidas */
        text-align: center;
        overflow-wrap: anywhere;
        display: -webkit-box;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: ${layout.productoLineas};
        overflow: hidden;
        margin-bottom: ${compactHorizontal ? '0.15mm' : '0.3mm'};
      }

      /* Talla y color son parrafos: si no entran en un renglon bajan dentro del
         suyo, y entre uno y otro queda aire. El tope de renglones es el mismo
         resguardo que el del nombre */
      .detalle {
        font-size: ${layout.detalle}pt;

        /* Renglones de un mismo parrafo juntos y aire entre parrafos: asi se ve
           que "Oxido wash / desgastado" es un solo color */
        line-height: 1.15;
        margin-bottom: ${layout.parrafo}mm;
        overflow-wrap: anywhere;
        display: -webkit-box;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: ${layout.detalleLineas};
        overflow: hidden;
      }

      /* El SKU identifica la variante: en un solo renglon (partido en dos se sale
         de la etiqueta) y separado del color por un espacio marcado */
      .id {
        font-size: ${layout.id}pt;
        line-height: 1;
        white-space: nowrap;
        margin-top: ${layout.antesDelSku}mm;
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
// diseño de la hoja (mismas medidas de layoutFor, ver drawLabel) a la resolucion
// de la impresora y se manda como imagen ESC/POS, asi sale igual que desde la PC.

// ---------------------------------------------------------------------------
// CALIBRACION DE LA IMPRESORA TERMICA
//
// Estos tres valores solo afectan al boton "Termica". La impresion por hoja
// (boton "Imprimir etiqueta") no pasa por aca y ya esta calibrada: no tocarla.
// ---------------------------------------------------------------------------

// Resolucion del cabezal. 203 dpi = 8 puntos/mm (lo habitual); una de 300 dpi
// usa 11.81. Si la etiqueta sale mas chica o mas grande que el rollo, es esto.
const DOTS_PER_MM = 8

// Ancho FISICO del cabezal, en mm — no el de la etiqueta. ESC/POS imprime la
// imagen pegada al borde izquierdo del cabezal, asi que con un cabezal mas
// ancho que el rollo la etiqueta sale corrida a la izquierda. Con este valor
// la imagen se centra sola. En 0 no se centra nada.
const ANCHO_CABEZAL_MM = 48

// Corrimiento fino a la derecha, en mm, por si el centrado no queda exacto.
// Acepta negativos para mover a la izquierda.
const OFFSET_IZQUIERDO_MM = 0

type LabelBitmap = {
  widthBytes: number
  height: number

  // 1 bit por punto, 1 = negro, filas de arriba hacia abajo
  data: Uint8Array
}

// 1 pt = 1/72 pulgada: las tipografias del diseño estan en pt y el canvas de la
// impresora trabaja en puntos de cabezal
const MM_PER_PT = 25.4 / 72

const ptToDots = (pt: number) => pt * MM_PER_PT * DOTS_PER_MM

const fontOf = (px: number) => `bold ${px}px Arial, Helvetica, sans-serif`

// Parte un texto en renglones que entren en `maxWidth`, igual que el diseño de
// la hoja (overflow-wrap: anywhere): primero por palabras y, si una palabra sola
// no entra, por letras. `maxLines` es el mismo resguardo del -webkit-line-clamp
const wrapLines = (
  ctx: CanvasRenderingContext2D,
  text: string,
  px: number,
  maxWidth: number,
  maxLines: number
): string[] => {
  ctx.font = fontOf(px)

  const lines: string[] = []
  let current = ''

  const flush = () => {
    if (current) lines.push(current)
    current = ''
  }

  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (ctx.measureText(word).width > maxWidth) {
      flush()

      let piece = ''

      for (const char of word) {
        if (piece && ctx.measureText(piece + char).width > maxWidth) {
          lines.push(piece)
          piece = char
        } else {
          piece += char
        }
      }

      current = piece
      continue
    }

    const tentative = current ? `${current} ${word}` : word

    if (!current || ctx.measureText(tentative).width <= maxWidth) {
      current = tentative
    } else {
      flush()
      current = word
    }
  }

  flush()

  return lines.slice(0, maxLines)
}

// Un renglon ya resuelto: el texto, su tipografia, el alto de su renglon y el
// aire que va debajo (los margenes del diseño)
type DrawLine = { text: string; px: number; height: number; gapAfter: number }

// Talla, color y SKU: cada uno es un parrafo y el SKU va en un solo renglon,
// igual que en la hoja
const detalleLines = (
  ctx: CanvasRenderingContext2D,
  label: VariantLabel,
  layout: LabelLayout,
  maxWidth: number
): DrawLine[] => {
  const detallePx = ptToDots(layout.detalle)
  const idPx = ptToDots(layout.id)
  const parrafo = layout.parrafo * DOTS_PER_MM
  const lines: DrawLine[] = []

  for (const texto of [`Talla: ${label.sizeName}`, `Color: ${sentenceCase(label.colorName)}`]) {
    const wrapped = wrapLines(ctx, texto, detallePx, maxWidth, layout.detalleLineas)

    wrapped.forEach((text, i) => {
      lines.push({
        text,
        px: detallePx,
        height: detallePx * 1.15,
        gapAfter: i === wrapped.length - 1 ? parrafo : 0
      })
    })
  }

  // Margenes adyacentes: el de abajo del color y el de arriba del SKU se
  // colapsan al mayor, como en el diseño de la hoja
  if (lines.length) {
    lines[lines.length - 1].gapAfter = Math.max(parrafo, layout.antesDelSku * DOTS_PER_MM)
  }

  lines.push({ text: label.sku || String(label.variantId), px: idPx, height: idPx, gapAfter: 0 })

  return lines
}

const blockHeight = (lines: DrawLine[]) => lines.reduce((acc, line) => acc + line.height + line.gapAfter, 0)

const blockWidth = (ctx: CanvasRenderingContext2D, lines: DrawLine[]) =>
  lines.reduce((acc, line) => {
    ctx.font = fontOf(line.px)

    return Math.max(acc, ctx.measureText(line.text).width)
  }, 0)

// Escribe un bloque de renglones. `align` decide si `x` es el borde izquierdo
// del bloque o su centro
const drawBlock = (
  ctx: CanvasRenderingContext2D,
  lines: DrawLine[],
  x: number,
  top: number,
  align: 'left' | 'center'
) => {
  let y = top

  ctx.textAlign = align === 'center' ? 'center' : 'left'

  for (const line of lines) {
    ctx.font = fontOf(line.px)
    ctx.fillText(line.text, x, y + line.height / 2)
    y += line.height + line.gapAfter
  }
}

const loadImage = (src: string): Promise<HTMLImageElement | null> =>
  new Promise(resolve => {
    if (!src) return resolve(null)

    const image = new Image()

    image.onload = () => resolve(image)
    image.onerror = () => resolve(null)
    image.src = src
  })

// Dibuja la etiqueta directo en el canvas, a la resolucion del cabezal.
//
// Antes se armaba el HTML de `labelParts` dentro de un <foreignObject> de un SVG
// y se dibujaba ese SVG como imagen. Funciona en la PC, pero Chrome de Android
// NO pinta el HTML de un foreignObject cuando el SVG se usa como imagen: el
// canvas salia todo blanco, la impresora recibia la altura correcta y por eso
// avanzaba el papel y la etiqueta salia vacia. Aca se pinta con la API del
// canvas (texto + el PNG del QR), que se comporta igual en celular y en PC.
//
// El diseño es el mismo de la hoja: medidas y tipografias salen de `layoutFor`.
const drawLabel = async (ctx: CanvasRenderingContext2D, label: VariantLabel, size: LabelSize) => {
  const layout = layoutFor(size)
  const compactHorizontal = size.id === '30x20'
  const stack = layout.mode === 'stack'

  const width = size.width * DOTS_PER_MM
  const height = size.height * DOTS_PER_MM
  const padding = 1.5 * DOTS_PER_MM
  const innerWidth = width - padding * 2
  const columnGap = (compactHorizontal ? 0.25 : 0.5) * DOTS_PER_MM
  const qrSide = layout.qrSide * DOTS_PER_MM

  const qr = await loadImage(label.qrDataUrl)

  ctx.fillStyle = '#000'
  ctx.textBaseline = 'middle'

  // El QR se escala sin suavizado: con interpolacion los modulos salen grises y
  // el umbral de blanco/negro se los come (equivale al image-rendering: pixelated)
  ctx.imageSmoothingEnabled = false

  let y = padding

  // Nombre del producto: a todo el ancho y centrado, en las dos variantes
  if (label.productName) {
    const px = ptToDots(layout.producto)
    const lines = wrapLines(ctx, label.productName, px, innerWidth, layout.productoLineas)

    drawBlock(
      ctx,
      lines.map(text => ({ text, px, height: px * 1.3, gapAfter: 0 })),
      padding + innerWidth / 2,
      y,
      'center'
    )

    if (lines.length) {
      y += lines.length * px * 1.3 + (compactHorizontal ? 0.15 : 0.3) * DOTS_PER_MM + columnGap
    }
  }

  const resto = Math.max(0, height - padding - y)

  if (stack) {
    // Cuadradas: talla/color/SKU centrados debajo del nombre y el QR centrado
    // en el alto que sobra
    const lines = detalleLines(ctx, label, layout, innerWidth)

    drawBlock(ctx, lines, padding + innerWidth / 2, y, 'center')

    const textoAlto = blockHeight(lines)
    const libre = Math.max(0, resto - textoAlto)

    if (qr) {
      ctx.drawImage(qr, padding + (innerWidth - qrSide) / 2, y + textoAlto + (libre - qrSide) / 2, qrSide, qrSide)
    }

    return
  }

  // Bajas: talla/color/SKU a la izquierda y el QR a su derecha, el conjunto
  // centrado en la etiqueta y centrado verticalmente en el alto que sobra
  const rowGap = (compactHorizontal ? 1.5 : 3) * DOTS_PER_MM
  const textoMaxWidth = Math.max(0, innerWidth - rowGap - qrSide)
  const lines = detalleLines(ctx, label, layout, textoMaxWidth)
  const textoWidth = blockWidth(ctx, lines)
  const textoAlto = blockHeight(lines)
  const grupoWidth = textoWidth + rowGap + qrSide
  const x = padding + Math.max(0, (innerWidth - grupoWidth) / 2)

  drawBlock(ctx, lines, x, y + Math.max(0, (resto - textoAlto) / 2), 'left')

  if (qr) {
    ctx.drawImage(qr, x + textoWidth + rowGap, y + Math.max(0, (resto - qrSide) / 2), qrSide, qrSide)
  }
}

export const renderLabelBitmap = async (label: VariantLabel, size: LabelSize): Promise<LabelBitmap> => {
  const etiquetaDots = Math.round(size.width * DOTS_PER_MM)

  // Margen izquierdo: lo que sobra del cabezal, repartido a la mitad, mas el
  // ajuste fino. Nunca negativo: la imagen no puede empezar fuera del papel.
  const centrado = ANCHO_CABEZAL_MM > size.width ? ((ANCHO_CABEZAL_MM - size.width) * DOTS_PER_MM) / 2 : 0
  const margenDots = Math.max(0, Math.round(centrado + OFFSET_IZQUIERDO_MM * DOTS_PER_MM))

  // El ancho en puntos tiene que ser multiplo de 8: cada byte son 8 puntos
  const width = Math.ceil((etiquetaDots + margenDots) / 8) * 8
  const height = Math.round(size.height * DOTS_PER_MM)

  const canvas = document.createElement('canvas')

  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d')

  if (!ctx) throw new Error('No se pudo dibujar la etiqueta')

  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, width, height)

  // La etiqueta conserva SU ancho y se corre a la derecha
  ctx.save()
  ctx.translate(margenDots, 0)
  ctx.beginPath()
  ctx.rect(0, 0, etiquetaDots, height)
  ctx.clip()
  await drawLabel(ctx, label, size)
  ctx.restore()

  // Termica = blanco o negro. El corte va por encima del gris medio: el borde
  // suavizado de las letras cuenta como negro y la negrita no sale finita
  const pixels = ctx.getImageData(0, 0, width, height).data
  const widthBytes = width / 8
  const data = new Uint8Array(widthBytes * height)
  let negros = 0

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const luminance = pixels[i] * 0.299 + pixels[i + 1] * 0.587 + pixels[i + 2] * 0.114

      if (luminance < 170) {
        data[y * widthBytes + (x >> 3)] |= 0x80 >> (x & 7)
        negros++
      }
    }
  }

  // Red de seguridad: antes, si el dibujo fallaba, se mandaba una imagen vacia y
  // la impresora gastaba una etiqueta en blanco sin avisar nada
  if (negros === 0) {
    throw new Error('La etiqueta se dibujo vacia: no se envio nada a la impresora')
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
