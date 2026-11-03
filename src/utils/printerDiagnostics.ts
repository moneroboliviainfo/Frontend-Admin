// Diagnostico de la impresora de etiquetas (DP30 y similares).
//
// Por que existe: la etiqueta sale en blanco aunque el dibujo ya tiene contenido
// (la red de seguridad de renderLabelBitmap no salta) y el papel avanza una
// etiqueta justa. Eso pasa cuando la impresora entiende el avance de papel pero
// DESCARTA el comando de imagen — o porque no habla ese dialecto, o porque la
// imagen cae fuera del papel.
//
// Estas pruebas mandan lo minimo indispensable para contestar una pregunta a la
// vez. Se corren desde el panel de diagnostico del modal de QR.
//
// NADA de esto toca la facturacion: la MTP-4C sigue usando printInvoiceBluetooth
// tal cual estaba.

import { ESC_POS, connectBluetoothPrinter, isBluetoothConnected, writeToprinter } from './bluetoothPrinter'
import { ANCHO_CABEZAL_MM, DOTS_PER_MM } from './variantLabel'

export type PrinterTest = {
  id: string
  label: string

  // Que confirma esta prueba si SALE algo impreso
  significa: string
  run: () => Promise<void>
}

const encode = (text: string) => new TextEncoder().encode(text)

const concat = (...parts: Uint8Array[]): Uint8Array => {
  const total = parts.reduce((acc, part) => acc + part.length, 0)
  const result = new Uint8Array(total)
  let offset = 0

  for (const part of parts) {
    result.set(part, offset)
    offset += part.length
  }

  return result
}

const ensureConnected = async () => {
  if (!isBluetoothConnected()) await connectBluetoothPrinter()
}

// GS FF: avanza a la siguiente etiqueta. Es lo unico que hoy sabemos que la DP30
// SI obedece (el papel avanza una etiqueta justa)
const FORM_FEED = new Uint8Array([0x1d, 0x0c])

// ---------------------------------------------------------------- bandas negras

const anchoBytes = Math.ceil((ANCHO_CABEZAL_MM * DOTS_PER_MM) / 8)

// Banda negra de `altoMm` que cubre TODO el ancho del cabezal. Al ocupar el
// cabezal entero, sale manchada sin importar donde apoye el rollo: separa
// "no entiende el comando" de "lo entiende pero la imagen cae fuera del papel".
const bandaNegra = (altoMm: number) => {
  const height = Math.round(altoMm * DOTS_PER_MM)
  const data = new Uint8Array(anchoBytes * height).fill(0xff)

  return { widthBytes: anchoBytes, height, data }
}

// GS v 0 — el comando raster que usa hoy la etiqueta
const rasterGSv0 = ({ widthBytes, height, data }: ReturnType<typeof bandaNegra>) =>
  concat(
    new Uint8Array([0x1d, 0x76, 0x30, 0x00, widthBytes & 0xff, widthBytes >> 8, height & 0xff, height >> 8]),
    data
  )

// ESC * — el modo de imagen viejo de ESC/POS. Muchas impresoras que ignoran
// GS v 0 si lo soportan. Va por franjas de 8 puntos de alto, un byte por columna.
const rasterEscAsterisco = ({ widthBytes, height, data }: ReturnType<typeof bandaNegra>) => {
  const width = widthBytes * 8
  const partes: Uint8Array[] = []

  for (let top = 0; top < height; top += 8) {
    const columnas = new Uint8Array(width)

    for (let x = 0; x < width; x++) {
      let columna = 0

      for (let bit = 0; bit < 8; bit++) {
        const y = top + bit

        if (y < height && data[y * widthBytes + (x >> 3)] & (0x80 >> (x & 7))) {
          columna |= 0x80 >> bit
        }
      }

      columnas[x] = columna
    }

    partes.push(new Uint8Array([0x1b, 0x2a, 0x00, width & 0xff, width >> 8]), columnas, new Uint8Array([0x0a]))
  }

  return concat(...partes)
}

// ------------------------------------------------------------------- las pruebas

export const PRINTER_TESTS: PrinterTest[] = [
  {
    id: 'texto',
    label: '1 · Texto ESC/POS',
    significa: 'La DP30 habla ESC/POS. El problema queda aislado en el comando de imagen.',
    run: async () => {
      await ensureConnected()
      await writeToprinter(ESC_POS.INIT)
      await writeToprinter(concat(encode('PRUEBA 1 ESC/POS'), new Uint8Array([0x0a, 0x0a])))
      await writeToprinter(FORM_FEED)
    }
  },
  {
    id: 'gsv0',
    label: '2 · Banda negra (GS v 0)',
    significa:
      'Entiende el comando raster que ya usamos. Si la prueba 2 sale y la etiqueta no, el problema es la posicion.',
    run: async () => {
      await ensureConnected()
      await writeToprinter(ESC_POS.INIT)
      await writeToprinter(rasterGSv0(bandaNegra(8)), 6)
      await writeToprinter(FORM_FEED)
    }
  },
  {
    id: 'escasterisco',
    label: '3 · Banda negra (ESC *)',
    significa: 'Entiende el modo de imagen viejo. Habria que pasar la etiqueta a ESC * en vez de GS v 0.',
    run: async () => {
      await ensureConnected()
      await writeToprinter(ESC_POS.INIT)
      await writeToprinter(rasterEscAsterisco(bandaNegra(8)), 6)
      await writeToprinter(FORM_FEED)
    }
  },
  {
    id: 'tspl',
    label: '4 · TSPL (etiquetadoras)',
    significa: 'La DP30 usa TSPL, no ESC/POS. Hay que reescribir la salida de etiquetas en TSPL.',
    run: async () => {
      await ensureConnected()

      const tspl = [
        'SIZE 30 mm,20 mm',
        'GAP 2 mm,0 mm',
        'DIRECTION 1',
        'CLS',
        'TEXT 16,16,"3",0,1,1,"TSPL OK"',
        'BAR 16,60,200,24',
        'PRINT 1,1',
        ''
      ].join('\r\n')

      await writeToprinter(encode(tspl))
    }
  },
  {
    id: 'cpcl',
    label: '5 · CPCL (etiquetadoras)',
    significa: 'La DP30 usa CPCL. Hay que reescribir la salida de etiquetas en CPCL.',
    run: async () => {
      await ensureConnected()

      const cpcl = ['! 0 200 200 160 1', 'TEXT 4 0 16 16 CPCL OK', 'LINE 16 60 220 60 24', 'FORM', 'PRINT', ''].join(
        '\r\n'
      )

      await writeToprinter(encode(cpcl))
    }
  },
  {
    id: 'posicion',
    label: '6 · Regla de posicion',
    significa:
      'Tres bloques: izquierda, centro y derecha del cabezal. Los que se vean dicen donde apoya el rollo en el cabezal.',
    run: async () => {
      await ensureConnected()

      const height = Math.round(8 * DOTS_PER_MM)
      const data = new Uint8Array(anchoBytes * height)
      const bloque = Math.max(1, Math.round(anchoBytes / 6))
      const inicios = [0, Math.round((anchoBytes - bloque) / 2), anchoBytes - bloque]

      for (let y = 0; y < height; y++) {
        for (const inicio of inicios) {
          data.fill(0xff, y * anchoBytes + inicio, y * anchoBytes + inicio + bloque)
        }
      }

      await writeToprinter(ESC_POS.INIT)
      await writeToprinter(rasterGSv0({ widthBytes: anchoBytes, height, data }), 6)
      await writeToprinter(FORM_FEED)
    }
  }
]
