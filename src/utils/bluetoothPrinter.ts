import type { Factura } from '@/types/api/sales'

// ============================================
// Tipos de Web Bluetooth API
// ============================================
declare global {
  interface Navigator {
    bluetooth: Bluetooth
  }

  interface Bluetooth {
    requestDevice(options: RequestDeviceOptions): Promise<BluetoothDevice>
  }

  interface RequestDeviceOptions {
    acceptAllDevices?: boolean
    filters?: BluetoothLEScanFilter[]
    optionalServices?: BluetoothServiceUUID[]
  }

  interface BluetoothLEScanFilter {
    services?: BluetoothServiceUUID[]
    name?: string
    namePrefix?: string
  }

  type BluetoothServiceUUID = string | number

  interface BluetoothDevice {
    id: string
    name?: string
    gatt?: BluetoothRemoteGATTServer
  }

  interface BluetoothRemoteGATTServer {
    connected: boolean
    device: BluetoothDevice
    connect(): Promise<BluetoothRemoteGATTServer>
    disconnect(): void
    getPrimaryService(service: BluetoothServiceUUID): Promise<BluetoothRemoteGATTService>
    getPrimaryServices(service?: BluetoothServiceUUID): Promise<BluetoothRemoteGATTService[]>
  }

  interface BluetoothRemoteGATTService {
    device: BluetoothDevice
    uuid: string
    getCharacteristic(characteristic: BluetoothCharacteristicUUID): Promise<BluetoothRemoteGATTCharacteristic>
    getCharacteristics(characteristic?: BluetoothCharacteristicUUID): Promise<BluetoothRemoteGATTCharacteristic[]>
  }

  type BluetoothCharacteristicUUID = string | number

  interface BluetoothRemoteGATTCharacteristic {
    service: BluetoothRemoteGATTService
    uuid: string
    properties: BluetoothCharacteristicProperties
    value?: DataView
    writeValue(value: BufferSource): Promise<void>
    writeValueWithoutResponse(value: BufferSource): Promise<void>
    readValue(): Promise<DataView>
  }

  interface BluetoothCharacteristicProperties {
    broadcast: boolean
    read: boolean
    writeWithoutResponse: boolean
    write: boolean
    notify: boolean
    indicate: boolean
    authenticatedSignedWrites: boolean
    reliableWrite: boolean
    writableAuxiliaries: boolean
  }
}

// ============================================
// Web Bluetooth ESC/POS Printer para MTP-4C
// ============================================

// Comandos ESC/POS básicos
const ESC = 0x1b
const GS = 0x1d
const LF = 0x0a

const ESC_POS = {
  INIT: new Uint8Array([ESC, 0x40]),
  ALIGN_LEFT: new Uint8Array([ESC, 0x61, 0x00]),
  ALIGN_CENTER: new Uint8Array([ESC, 0x61, 0x01]),
  ALIGN_RIGHT: new Uint8Array([ESC, 0x61, 0x02]),
  BOLD_ON: new Uint8Array([ESC, 0x45, 0x01]),
  BOLD_OFF: new Uint8Array([ESC, 0x45, 0x00]),
  TEXT_NORMAL: new Uint8Array([GS, 0x21, 0x00]),
  TEXT_2H: new Uint8Array([GS, 0x21, 0x01]),
  TEXT_2W: new Uint8Array([GS, 0x21, 0x10]),
  TEXT_2X: new Uint8Array([GS, 0x21, 0x11]),
  FEED_LINE: new Uint8Array([LF]),
  FEED_3_LINES: new Uint8Array([ESC, 0x64, 0x03]),
  FEED_5_LINES: new Uint8Array([ESC, 0x64, 0x05]),
  CUT_PAPER: new Uint8Array([GS, 0x56, 0x01]),
  LINE_SEPARATOR: new Uint8Array([
    0x2d, 0x2d, 0x2d, 0x2d, 0x2d, 0x2d, 0x2d, 0x2d, 0x2d, 0x2d, 0x2d, 0x2d, 0x2d, 0x2d, 0x2d, 0x2d,
    0x2d, 0x2d, 0x2d, 0x2d, 0x2d, 0x2d, 0x2d, 0x2d, 0x2d, 0x2d, 0x2d, 0x2d, 0x2d, 0x2d, 0x2d, 0x2d,
    LF
  ])
}

// Estado de conexión Bluetooth
let bluetoothDevice: BluetoothDevice | null = null
let printerCharacteristic: BluetoothRemoteGATTCharacteristic | null = null

const PRINTER_SERVICE_UUIDS = [
  '000018f0-0000-1000-8000-00805f9b34fb',
  '49535343-fe7d-4ae5-8fa9-9fafd205e455',
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2'
]

const PRINTER_CHARACTERISTIC_UUIDS = [
  '00002af1-0000-1000-8000-00805f9b34fb',
  '49535343-8841-43f4-a8d4-ecbe34729bb3',
  'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f'
]

export const isBluetoothAvailable = (): boolean => {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator
}

export const connectBluetoothPrinter = async (): Promise<boolean> => {
  if (!isBluetoothAvailable()) {
    throw new Error('Web Bluetooth no está disponible en este navegador. Usa Chrome en Android.')
  }

  try {
    bluetoothDevice = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: PRINTER_SERVICE_UUIDS
    })

    if (!bluetoothDevice.gatt) {
      throw new Error('No se pudo acceder al GATT del dispositivo')
    }

    const server = await bluetoothDevice.gatt.connect()

    let service: BluetoothRemoteGATTService | null = null

    for (const serviceUuid of PRINTER_SERVICE_UUIDS) {
      try {
        service = await server.getPrimaryService(serviceUuid)
        break
      } catch {
        // Continuar buscando
      }
    }

    if (!service) {
      const services = await server.getPrimaryServices()

      if (services.length > 0) {
        service = services[0]
      }
    }

    if (!service) {
      throw new Error('No se encontró un servicio de impresión compatible')
    }

    for (const charUuid of PRINTER_CHARACTERISTIC_UUIDS) {
      try {
        printerCharacteristic = await service.getCharacteristic(charUuid)
        break
      } catch {
        // Continuar buscando
      }
    }

    if (!printerCharacteristic) {
      const characteristics = await service.getCharacteristics()

      for (const char of characteristics) {
        if (char.properties.write || char.properties.writeWithoutResponse) {
          printerCharacteristic = char
          break
        }
      }
    }

    if (!printerCharacteristic) {
      throw new Error('No se encontró una característica de escritura compatible')
    }

    console.log('Impresora Bluetooth conectada:', bluetoothDevice.name)

    return true
  } catch (error) {
    console.error('Error conectando a impresora Bluetooth:', error)
    throw error
  }
}

export const disconnectBluetoothPrinter = (): void => {
  if (bluetoothDevice?.gatt?.connected) {
    bluetoothDevice.gatt.disconnect()
  }

  bluetoothDevice = null
  printerCharacteristic = null
}

export const isBluetoothConnected = (): boolean => {
  return bluetoothDevice?.gatt?.connected ?? false
}

const writeToprinter = async (data: Uint8Array): Promise<void> => {
  if (!printerCharacteristic) {
    throw new Error('Impresora no conectada')
  }

  const chunkSize = 20

  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.slice(i, i + chunkSize)

    if (printerCharacteristic.properties.writeWithoutResponse) {
      await printerCharacteristic.writeValueWithoutResponse(chunk)
    } else {
      await printerCharacteristic.writeValue(chunk)
    }

    await new Promise(resolve => setTimeout(resolve, 20))
  }
}

const textToBytes = (text: string): Uint8Array => {
  const encoder = new TextEncoder()

  const cleanText = text
    .replace(/á/g, 'a')
    .replace(/é/g, 'e')
    .replace(/í/g, 'i')
    .replace(/ó/g, 'o')
    .replace(/ú/g, 'u')
    .replace(/Á/g, 'A')
    .replace(/É/g, 'E')
    .replace(/Í/g, 'I')
    .replace(/Ó/g, 'O')
    .replace(/Ú/g, 'U')
    .replace(/ñ/g, 'n')
    .replace(/Ñ/g, 'N')
    .replace(/°/g, 'o')

  return encoder.encode(cleanText)
}

const printLine = async (text: string): Promise<void> => {
  const textBytes = textToBytes(text)
  const lineBytes = new Uint8Array([...textBytes, LF])

  await writeToprinter(lineBytes)
}

const combineBytes = (...arrays: Uint8Array[]): Uint8Array => {
  const totalLength = arrays.reduce((acc, arr) => acc + arr.length, 0)
  const result = new Uint8Array(totalLength)
  let offset = 0

  for (const arr of arrays) {
    result.set(arr, offset)
    offset += arr.length
  }

  return result
}

// Funciones de formato
const unidades = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE']
const decenas = ['', 'DIEZ', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA']
const especiales = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISEIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE']
const centenas = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS']

const convertirMenorMil = (n: number): string => {
  if (n === 0) return ''
  if (n === 100) return 'CIEN'

  let resultado = ''
  const c = Math.floor(n / 100)
  const resto = n % 100

  if (c > 0) resultado += centenas[c] + ' '

  if (resto >= 10 && resto <= 19) {
    resultado += especiales[resto - 10]
  } else {
    const d = Math.floor(resto / 10)
    const u = resto % 10

    if (d > 0) {
      if (d === 2 && u > 0) {
        resultado += 'VEINTI' + unidades[u]
      } else {
        resultado += decenas[d]
        if (u > 0) resultado += ' Y ' + unidades[u]
      }
    } else if (u > 0) {
      resultado += unidades[u]
    }
  }

  return resultado.trim()
}

const numeroALetras = (monto: number): string => {
  if (monto === 0) return 'CERO'

  const entero = Math.floor(monto)
  const centavos = Math.round((monto - entero) * 100)
  let resultado = ''

  if (entero >= 1000000) {
    const millones = Math.floor(entero / 1000000)
    const restoMillones = entero % 1000000

    resultado += millones === 1 ? 'UN MILLON ' : convertirMenorMil(millones) + ' MILLONES '

    if (restoMillones > 0) {
      if (restoMillones >= 1000) {
        const miles = Math.floor(restoMillones / 1000)
        const restoMiles = restoMillones % 1000

        resultado += miles === 1 ? 'MIL ' : convertirMenorMil(miles) + ' MIL '
        if (restoMiles > 0) resultado += convertirMenorMil(restoMiles)
      } else {
        resultado += convertirMenorMil(restoMillones)
      }
    }
  } else if (entero >= 1000) {
    const miles = Math.floor(entero / 1000)
    const restoMiles = entero % 1000

    resultado += miles === 1 ? 'MIL ' : convertirMenorMil(miles) + ' MIL '
    if (restoMiles > 0) resultado += convertirMenorMil(restoMiles)
  } else {
    resultado = convertirMenorMil(entero)
  }

  return resultado.trim() + ' ' + centavos.toString().padStart(2, '0') + '/100'
}

const formatDate = (dateString: string): string => {
  const date = new Date(dateString)

  return date.toLocaleDateString('es-BO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'America/La_Paz'
  })
}

const formatTime = (dateString: string): string => {
  const date = new Date(dateString)

  return date.toLocaleTimeString('es-BO', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/La_Paz'
  })
}

const getUnidadMedidaLabel = (codigo: number): string => {
  const unidadesMedida: Record<number, string> = {
    1: 'BOBINAS', 2: 'BALDE', 3: 'BARRILES', 4: 'BOLSA', 5: 'BOTELLAS',
    6: 'CAJA', 7: 'CARTONES', 14: 'DOCENA', 17: 'GRAMO', 22: 'KILOGRAMO',
    28: 'LITRO', 30: 'METRO', 42: 'PAQUETE', 43: 'PAR', 47: 'PIEZAS',
    57: 'UNIDAD', 58: 'UNIDAD', 62: 'OTRO'
  }

  return unidadesMedida[codigo] || 'UNIDAD'
}

const generateQRCommand = (data: string): Uint8Array => {
  const dataBytes = textToBytes(data)
  const modelCmd = new Uint8Array([GS, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00])
  const sizeCmd = new Uint8Array([GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, 0x04])
  const errorCmd = new Uint8Array([GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x31])
  const dataLen = dataBytes.length + 3
  const pL = dataLen % 256
  const pH = Math.floor(dataLen / 256)
  const storeCmd = new Uint8Array([GS, 0x28, 0x6b, pL, pH, 0x31, 0x50, 0x30, ...dataBytes])
  const printCmd = new Uint8Array([GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30])

  return combineBytes(modelCmd, sizeCmd, errorCmd, storeCmd, printCmd)
}

export const printInvoiceBluetooth = async (factura: Factura): Promise<void> => {
  if (!isBluetoothConnected()) {
    await connectBluetoothPrinter()
  }

  const fechaEmision = formatDate(factura.fechaEmision)
  const horaEmision = formatTime(factura.fechaEmision)
  const montoEnLetras = numeroALetras(factura.montoTotal)
  const subtotal = factura.detalles.reduce((acc, item) => acc + item.subTotal, 0)

  try {
    await writeToprinter(ESC_POS.INIT)
    await new Promise(resolve => setTimeout(resolve, 100))

    // ENCABEZADO
    await writeToprinter(ESC_POS.ALIGN_CENTER)
    await writeToprinter(ESC_POS.BOLD_ON)
    await writeToprinter(ESC_POS.TEXT_2X)
    await printLine('FACTURA')
    await writeToprinter(ESC_POS.TEXT_NORMAL)
    await printLine('CON DERECHO A CREDITO FISCAL')
    await writeToprinter(ESC_POS.BOLD_OFF)

    await writeToprinter(ESC_POS.FEED_LINE)
    await printLine(factura.razonSocialEmisor)
    await printLine(`${factura.nombreSucursal} ${factura.codigoSucursal}`)
    await printLine(`No. Punto de Venta ${factura.codigoPuntoVenta}`)
    await printLine(factura.direccion)
    await printLine(`Tel. ${factura.telefono}`)
    await printLine(factura.municipio)

    await writeToprinter(ESC_POS.LINE_SEPARATOR)

    // NIT Y FACTURA
    await writeToprinter(ESC_POS.BOLD_ON)
    await printLine('NIT')
    await writeToprinter(ESC_POS.TEXT_2H)
    await printLine(factura.nitEmisor.toString())
    await writeToprinter(ESC_POS.TEXT_NORMAL)
    await printLine('FACTURA No')
    await writeToprinter(ESC_POS.TEXT_2X)
    await printLine(factura.numeroFactura.toString())
    await writeToprinter(ESC_POS.TEXT_NORMAL)
    await writeToprinter(ESC_POS.BOLD_OFF)

    // CUF
    await printLine('COD. AUTORIZACION')
    const cuf = factura.cuf
    const cufChunks = cuf.match(/.{1,32}/g) || [cuf]

    for (const chunk of cufChunks) {
      await printLine(chunk)
    }

    await writeToprinter(ESC_POS.LINE_SEPARATOR)

    // DATOS CLIENTE
    await writeToprinter(ESC_POS.ALIGN_LEFT)
    await printLine(`NOMBRE: ${factura.nombreRazonSocial}`)
    await printLine(`NIT/CI: ${factura.numeroDocumento}${factura.complemento ? '-' + factura.complemento : ''}`)
    await printLine(`COD. CLIENTE: ${factura.codigoCliente}`)
    await printLine(`FECHA: ${fechaEmision} ${horaEmision}`)

    await writeToprinter(ESC_POS.LINE_SEPARATOR)

    // DETALLE
    await writeToprinter(ESC_POS.ALIGN_CENTER)
    await writeToprinter(ESC_POS.BOLD_ON)
    await printLine('DETALLE')
    await writeToprinter(ESC_POS.BOLD_OFF)
    await writeToprinter(ESC_POS.ALIGN_LEFT)

    for (const detalle of factura.detalles) {
      await writeToprinter(ESC_POS.BOLD_ON)
      await printLine(`${detalle.codigoProducto}`)
      await writeToprinter(ESC_POS.BOLD_OFF)
      await printLine(detalle.descripcion)
      await printLine(`UM: ${getUnidadMedidaLabel(detalle.unidadMedida)}`)
      await printLine(`${detalle.cantidad.toFixed(2)} x ${detalle.precioUnitario.toFixed(2)} = ${detalle.subTotal.toFixed(2)}`)

      if (detalle.montoDescuento && detalle.montoDescuento > 0) {
        await printLine(`Desc: -${detalle.montoDescuento.toFixed(2)}`)
      }

      await writeToprinter(ESC_POS.FEED_LINE)
    }

    await writeToprinter(ESC_POS.LINE_SEPARATOR)

    // TOTALES
    await writeToprinter(ESC_POS.ALIGN_RIGHT)
    await printLine(`SUBTOTAL Bs ${subtotal.toFixed(2)}`)
    await printLine(`DESCUENTO Bs ${factura.descuentoAdicional.toFixed(2)}`)
    await writeToprinter(ESC_POS.BOLD_ON)
    await printLine(`TOTAL Bs ${factura.montoTotal.toFixed(2)}`)
    await writeToprinter(ESC_POS.BOLD_OFF)

    if (factura.montoGiftCard && factura.montoGiftCard > 0) {
      await printLine(`GIFT CARD Bs ${factura.montoGiftCard.toFixed(2)}`)
    }

    await writeToprinter(ESC_POS.BOLD_ON)
    await printLine(`MONTO A PAGAR Bs ${factura.montoTotal.toFixed(2)}`)
    await printLine(`BASE IVA Bs ${factura.montoTotalSujetoIva.toFixed(2)}`)
    await writeToprinter(ESC_POS.BOLD_OFF)

    // MONTO EN LETRAS
    await writeToprinter(ESC_POS.ALIGN_LEFT)
    await printLine(`Son: ${montoEnLetras} Bolivianos`)

    await writeToprinter(ESC_POS.LINE_SEPARATOR)

    // LEYENDA
    await writeToprinter(ESC_POS.ALIGN_CENTER)
    await printLine('ESTA FACTURA CONTRIBUYE AL')
    await printLine('DESARROLLO DEL PAIS, EL USO')
    await printLine('ILICITO SERA SANCIONADO')
    await printLine('PENALMENTE DE ACUERDO A LEY')
    await writeToprinter(ESC_POS.FEED_LINE)

    const leyenda = factura.leyenda || ''
    const leyendaChunks = leyenda.match(/.{1,32}/g) || [leyenda]

    for (const chunk of leyendaChunks) {
      await printLine(chunk)
    }

    await writeToprinter(ESC_POS.FEED_LINE)

    const tipoEmision = factura.codigoEmision === 1
      ? 'Documento Fiscal Digital emitido en modalidad de facturacion en linea'
      : 'Documento Fiscal Digital emitido en modalidad de facturacion fuera de linea'

    const tipoChunks = tipoEmision.match(/.{1,32}/g) || [tipoEmision]

    for (const chunk of tipoChunks) {
      await printLine(chunk)
    }

    // QR CODE
    await writeToprinter(ESC_POS.FEED_LINE)
    await writeToprinter(ESC_POS.ALIGN_CENTER)

    const qrUrl = `https://pilotosiat.impuestos.gob.bo/consulta/QR?nit=${factura.nitEmisor}&cuf=${factura.cuf}&numero=${factura.numeroFactura}&t=2`

    try {
      const qrCommands = generateQRCommand(qrUrl)

      await writeToprinter(qrCommands)
    } catch (qrError) {
      console.warn('QR no soportado, imprimiendo URL:', qrError)
      await printLine('Verifique en:')
      const urlChunks = qrUrl.match(/.{1,32}/g) || [qrUrl]

      for (const chunk of urlChunks) {
        await printLine(chunk)
      }
    }

    // FINALIZAR
    await writeToprinter(ESC_POS.FEED_5_LINES)
    await writeToprinter(ESC_POS.CUT_PAPER)

    console.log('Factura impresa exitosamente via Bluetooth')
  } catch (error) {
    console.error('Error imprimiendo via Bluetooth:', error)
    throw error
  }
}

export const getConnectedDeviceName = (): string | null => {
  return bluetoothDevice?.name ?? null
}
