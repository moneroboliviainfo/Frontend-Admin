// Etiqueta de variante para impresora térmica de etiquetas (DP30S y similares).
// Lleva el QR, el producto, la talla, el color y el id — lo que se lee de un
// vistazo en la percha y lo que escanea el POS.
//
// Dos salidas, igual que la facturación: hoja (ventana de impresión del
// navegador, via labelParts) y formato POS por Bluetooth (ESC/POS, via drawLabel).
// Las dos siguen las mismas medidas y tipografias (layoutFor), asi la etiqueta
// sale igual desde la PC y desde el celular.

import { LABEL_INIT, connectLabelPrinter, isLabelPrinterConnected, writeToLabelPrinter } from './labelPrinter'

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

  const producto = label.productName ? `<div class="producto">${escapeText(label.productName)}</div>` : ''

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
// Mismo protocolo que la factura termica (ESC/POS) pero con conexion propia
// (labelPrinter.ts: otra impresora). La etiqueta no se arma con renglones: con
// texto la impresora solo escribe un renglon debajo del otro y no puede poner
// el QR al costado ni usar las tipografias de cada medida. Se dibuja el MISMO
// diseño de la hoja (mismas medidas de layoutFor, ver drawLabel) a la resolucion
// de la impresora y se manda como imagen ESC/POS, asi sale igual que desde la PC.

// ---------------------------------------------------------------------------
// CALIBRACION DE LA IMPRESORA TERMICA
//
// Estos valores solo afectan al boton "Termica". La impresion por hoja
// (boton "Imprimir etiqueta") no pasa por aca y ya esta calibrada: no tocarla.
// ---------------------------------------------------------------------------

// Resolucion del cabezal. 203 dpi = 8 puntos/mm (lo habitual); una de 300 dpi
// usa 11.81. Si la etiqueta sale mas chica o mas grande que el rollo, es esto.
export const DOTS_PER_MM = 8

// Ancho FISICO del cabezal, en mm — no el de la etiqueta. ESC/POS siempre empieza
// a imprimir en el borde IZQUIERDO del cabezal, asi que cuando el rollo es mas
// angosto que el cabezal hay que correr la imagen hasta donde apoya el papel.
// En 0 no se corre nada (la imagen queda pegada al borde izquierdo).
//
// 72 mm = 576 puntos: la DP30 es de 3 pulgadas. Al principio estaba en 48 (el
// valor de una de 58 mm) y por eso la etiqueta caia 22 mm a la izquierda del
// papel y salia en blanco.
export const ANCHO_CABEZAL_MM = 72

// Donde apoya el rollo dentro del cabezal, mirando la impresora de frente.
// La DP30 lleva el rollo contra la guia DERECHA: con 'centro' (lo que habia
// antes) la etiqueta se imprimia 9 mm a la izquierda del papel y salia en blanco.
//   'izquierda' → sin relleno      'centro' → la mitad de lo que sobra
//   'derecha'   → todo lo que sobra
type AlineacionRollo = 'izquierda' | 'centro' | 'derecha'

const ALINEACION_ROLLO = 'derecha' as AlineacionRollo

// Corrimiento fino a la derecha, en mm, sobre la alineacion de arriba. Es el
// ajuste que depende de como quedo puesta la guia del rollo en cada impresora,
// asi que se calibra desde el panel de calibracion y queda guardado en el
// dispositivo (ver OFFSET_STORAGE_KEY). Este valor es solo el punto de partida.
//
// -2 mm: calibrando en la DP30, el relleno que dejo la etiqueta centrada fue de
// 40 mm, 2 menos que los 42 que da el cabezal de 72 con el rollo a la derecha.
// Es lo que separa a la guia del rollo del borde del cabezal.
const OFFSET_IZQUIERDO_MM = -2

// La version va en la clave: al corregir ANCHO_CABEZAL_MM cambio el punto de
// partida, y un valor viejo guardado en el celular se sumaria encima y lo
// mandaria todo fuera del papel
const OFFSET_STORAGE_KEY = 'monero.etiqueta.offsetDerechaMm.v2'

// Guardado por dispositivo: cada celular/PC puede tener su propia impresora con
// la guia del rollo en otra posicion
export const getOffsetEtiquetaMm = (): number => {
  if (typeof window === 'undefined') return OFFSET_IZQUIERDO_MM

  try {
    const guardado = window.localStorage.getItem(OFFSET_STORAGE_KEY)
    const valor = guardado === null ? NaN : Number(guardado)

    return Number.isFinite(valor) ? valor : OFFSET_IZQUIERDO_MM
  } catch {
    // Modo privado o almacenamiento bloqueado: se usa el valor por defecto
    return OFFSET_IZQUIERDO_MM
  }
}

export const setOffsetEtiquetaMm = (mm: number): void => {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(OFFSET_STORAGE_KEY, String(mm))
  } catch {
    // Si no se puede guardar, el ajuste igual vale para esta sesion
  }
}

// Relleno blanco a la izquierda de la etiqueta, en puntos de cabezal
const margenIzquierdo = (size: LabelSize): number => {
  const sobra = Math.max(0, ANCHO_CABEZAL_MM - size.width)

  const base = ALINEACION_ROLLO === 'izquierda' ? 0 : ALINEACION_ROLLO === 'centro' ? sobra / 2 : sobra

  // Nunca negativo: la imagen no puede empezar fuera del papel
  return Math.max(0, Math.round((base + getOffsetEtiquetaMm()) * DOTS_PER_MM))
}

// Cuanto se esta corriendo la etiqueta, para mostrarlo en el panel de calibracion
export const margenIzquierdoMm = (size: LabelSize): number => margenIzquierdo(size) / DOTS_PER_MM

// Correr la etiqueta con GS L (margen izquierdo por comando) en vez de mandar el
// relleno como puntos blancos. En 30x20 sobre este cabezal, el relleno eran 40 de
// los 70 bytes de cada fila: 11.200 bytes contra 4.800. Por Bluetooth, a 20 bytes
// por paquete, eso es 3,4 s contra 1,4 s de envio — y el motor avanzando a
// tirones mientras espera datos es justo el "zapateo".
//
// PROBADO EN LA DP30: no funciona. La impresora acepta GS L pero GS v 0 lo
// ignora y dibuja igual desde el borde del cabezal, o sea fuera del papel: la
// etiqueta volvio a salir en blanco. Queda en false — el relleno blanco es la
// unica forma de correr la imagen en esta impresora.
//
// El ahorro de bytes se consiguio por el otro lado: mandando paquetes grandes
// por Bluetooth en vez de 20 bytes con pausa (ver writeToLabelPrinter).
const MARGEN_POR_COMANDO = false

// Corrimiento VERTICAL del contenido dentro de la etiqueta, en mm. Negativo sube
// el dibujo, positivo lo baja.
//
// La impresora arranca a imprimir donde quedo el papel, que suele ser unos
// milimetros pasado el inicio de la etiqueta, y por eso el contenido sale bajo.
// Mover el avance entre etiquetas no arregla eso —solo expulsa mas o menos
// papel—; lo que si lo arregla es dibujar el contenido mas arriba dentro de la
// etiqueta, usando el blanco que queda libre sobre el. El tope es ese blanco:
// pasado ese punto, el contenido empieza a recortarse por arriba.
//
// -4 mm es lo calibrado en la DP30 con rollo de 30x20: es lo que la impresora
// se adelanta desde donde deja el papel el GS FF hasta el inicio real de la
// etiqueta. Se calibra desde el panel y queda guardado por dispositivo; este
// valor es el punto de partida de un equipo sin calibrar.
const OFFSET_VERTICAL_MM = -2

const OFFSET_VERTICAL_KEY = 'monero.etiqueta.offsetVerticalMm'

export const getOffsetVerticalMm = (): number => {
  if (typeof window === 'undefined') return OFFSET_VERTICAL_MM

  try {
    const guardado = window.localStorage.getItem(OFFSET_VERTICAL_KEY)
    const valor = guardado === null ? NaN : Number(guardado)

    return Number.isFinite(valor) ? valor : OFFSET_VERTICAL_MM
  } catch {
    return OFFSET_VERTICAL_MM
  }
}

export const setOffsetVerticalMm = (mm: number): void => {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(OFFSET_VERTICAL_KEY, String(mm))
  } catch {
    // Si no se puede guardar, el ajuste igual vale para esta sesion
  }
}

type LabelBitmap = {
  widthBytes: number
  height: number

  // Puntos a correr con GS L antes de imprimir. En 0, el corrimiento ya viene
  // dentro de `data` como puntos blancos (ver MARGEN_POR_COMANDO)
  margenDots: number

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
  const margenDots = margenIzquierdo(size)

  // Con GS L el corrimiento lo hace la impresora y el bitmap lleva solo la
  // etiqueta; si no, hay que dibujarlo como puntos blancos a la izquierda
  const relleno = MARGEN_POR_COMANDO ? 0 : margenDots

  // El ancho en puntos tiene que ser multiplo de 8: cada byte son 8 puntos
  const width = Math.ceil((etiquetaDots + relleno) / 8) * 8
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
  ctx.translate(relleno, 0)

  // El recorte se fija ANTES del corrimiento vertical: asi delimita siempre la
  // etiqueta y es el contenido el que se mueve dentro, no el recorte junto con el
  ctx.beginPath()
  ctx.rect(0, 0, etiquetaDots, height)
  ctx.clip()

  ctx.translate(0, Math.round(getOffsetVerticalMm() * DOTS_PER_MM))
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

  return { widthBytes, height, data, margenDots: MARGEN_POR_COMANDO ? margenDots : 0 }
}

// Vista previa de lo que REALMENTE se manda a la impresora: el bitmap ya
// binarizado, con el relleno blanco de la izquierda incluido. Asi se ve en el
// celular si el dibujo salio bien, sin gastar etiquetas adivinando.
export const renderLabelPreview = async (label: VariantLabel, size: LabelSize, escala = 3): Promise<string> => {
  const { widthBytes, height, data, margenDots } = await renderLabelBitmap(label, size)
  const width = widthBytes * 8

  const canvas = document.createElement('canvas')

  // El corrimiento se dibuja aunque viaje como comando GS L: en la impresora
  // ocupa ese lugar igual, y verlo es justamente lo que se esta calibrando
  canvas.width = (width + margenDots) * escala
  canvas.height = height * escala

  const ctx = canvas.getContext('2d')

  if (!ctx) throw new Error('No se pudo dibujar la vista previa')

  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#000'

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[y * widthBytes + (x >> 3)] & (0x80 >> (x & 7))) {
        ctx.fillRect((x + margenDots) * escala, y * escala, escala, escala)
      }
    }
  }

  return canvas.toDataURL('image/png')
}

// Imagen raster ESC/POS (GS v 0), por franjas: una imagen entera de una vez puede
// pasar el buffer de la impresora
const BAND_ROWS = 48

// Pausa entre paquetes Bluetooth al mandar la imagen. En 0, writeToLabelPrinter
// manda sin tiempo muerto y la impresora recibe a la velocidad del enlace, que es
// lo que hace falta para que el motor no se quede esperando datos. Si la etiqueta
// saliera cortada o con rayas (datos perdidos), subir a 2 o 4 ms.
const RASTER_PAUSE_MS = 0

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

// GS FF: avanza hasta el inicio de la etiqueta siguiente usando el sensor de gap
// (impresoras de etiquetas en modo ESC/POS). Si la impresora no lo entiende lo ignora
const FEED_TO_NEXT_LABEL = new Uint8Array([0x1d, 0x0c])

// GS L: margen izquierdo, en puntos. Corre la impresion sin gastar bytes en blanco
const margenCommand = (dots: number) => new Uint8Array([0x1d, 0x4c, dots & 0xff, dots >> 8])

export const printVariantLabelBluetooth = async (label: VariantLabel, size: LabelSize): Promise<void> => {
  // Se dibuja antes de conectar: si falla el dibujo no se ocupa la impresora
  const bitmap = await renderLabelBitmap(label, size)

  if (!isLabelPrinterConnected()) await connectLabelPrinter()

  await writeToLabelPrinter(LABEL_INIT)
  await new Promise(resolve => setTimeout(resolve, 100))

  // El corrimiento horizontal, como comando: INIT lo deja en cero, asi que va
  // despues y no hace falta devolverlo al final
  if (bitmap.margenDots > 0) await writeToLabelPrinter(margenCommand(bitmap.margenDots))

  // Una etiqueta son miles de bytes (30x20 con el relleno son 11.200): de a 20
  // bytes con pausa son unos 3 KB/s, bastante menos de lo que consume el motor,
  // y el papel avanza a los tirones esperando datos. Va por writeToLabelPrinter,
  // que manda el paquete mas grande que acepte la conexion. La facturacion no
  // pasa por aca: tiene su propio archivo y su propia conexion.
  for (const command of rasterCommands(bitmap)) {
    await writeToLabelPrinter(command, RASTER_PAUSE_MS)
  }

  // Avance hasta la etiqueta siguiente, con el sensor de gap. Se probo tambien
  // un avance fijo calibrable para corregir la altura y no sirve: cambiar cuanto
  // avanza solo expulsa mas o menos papel, no mueve el contenido dentro de la
  // etiqueta. Eso se corrige con getOffsetVerticalMm, en el dibujo.
  await writeToLabelPrinter(FEED_TO_NEXT_LABEL)
}
