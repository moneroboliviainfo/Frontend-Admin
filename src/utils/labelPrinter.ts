// Conexion Bluetooth de la impresora de ETIQUETAS (DP30 y similares).
//
// Vive aparte de bluetoothPrinter.ts a proposito, por dos razones:
//
//   1. bluetoothPrinter.ts es la facturacion (MTP-4C) y esta en produccion en
//      tienda. Tocarlo para arreglar la etiqueta pone en riesgo algo que ya
//      funciona, asi que no se toca.
//
//   2. Son dos impresoras distintas. Compartiendo una sola conexion global,
//      imprimir una factura dejaba la MTP-4C conectada y la etiqueta siguiente
//      se iba a esa misma impresora. Con una conexion propia cada una va a donde
//      corresponde.
//
// Los tipos de Web Bluetooth son los que declara bluetoothPrinter.ts en su bloque
// `declare global`: son globales del proyecto, no hace falta importarlos.

// ESC @ — reinicia la impresora y limpia el buffer
export const LABEL_INIT = new Uint8Array([0x1b, 0x40])

// Web Bluetooth SOLO deja ver los servicios declarados aca: `getPrimaryServices()`
// no descubre nada que no este en esta lista. Si la impresora usa otro UUID, el
// navegador devuelve una lista vacia y parece que el equipo "no tiene servicios".
const SERVICE_UUIDS = [
  '000018f0-0000-1000-8000-00805f9b34fb', // impresoras ESC/POS comunes
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC / Microchip transparent UART
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
  '0000ff00-0000-1000-8000-00805f9b34fb', // chinas genericas
  '0000ffe0-0000-1000-8000-00805f9b34fb', // HM-10 y clones
  '0000fff0-0000-1000-8000-00805f9b34fb',
  '0000fee7-0000-1000-8000-00805f9b34fb', // varias etiquetadoras
  '0000ff80-0000-1000-8000-00805f9b34fb',
  '6e400001-b5a3-f393-e0a9-e50e24dcca9e' // Nordic UART (NUS)
]

const CHARACTERISTIC_UUIDS = [
  '00002af1-0000-1000-8000-00805f9b34fb',
  '49535343-8841-43f4-a8d4-ecbe34729bb3',
  'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f'
]

// Estado propio de la etiquetadora, separado del de la facturacion
let labelDevice: BluetoothDevice | null = null
let labelCharacteristic: BluetoothRemoteGATTCharacteristic | null = null

export const isLabelPrinterAvailable = (): boolean =>
  typeof navigator !== 'undefined' && 'bluetooth' in navigator

export const isLabelPrinterConnected = (): boolean => labelDevice?.gatt?.connected ?? false

export const getLabelPrinterName = (): string | null => labelDevice?.name ?? null

export const disconnectLabelPrinter = (): void => {
  if (labelDevice?.gatt?.connected) labelDevice.gatt.disconnect()

  labelDevice = null
  labelCharacteristic = null
  tamanoPaquete = 0
}

export const connectLabelPrinter = async (): Promise<boolean> => {
  if (!isLabelPrinterAvailable()) {
    throw new Error('Web Bluetooth no está disponible en este navegador. Usa Chrome en Android.')
  }

  // Se arranca limpio: si quedaba la caracteristica de una conexion anterior (la
  // impresora se apago o se alejo), la busqueda de abajo la daba por buena y se
  // escribia en una conexion muerta ("GATT server is disconnected") hasta recargar
  labelCharacteristic = null

  // La MTU se negocia por conexion: el tamaño de paquete se vuelve a averiguar
  tamanoPaquete = 0

  labelDevice = await navigator.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: SERVICE_UUIDS
  })

  if (!labelDevice.gatt) throw new Error('No se pudo acceder al GATT del dispositivo')

  const server = await labelDevice.gatt.connect()

  let service: BluetoothRemoteGATTService | null = null

  for (const uuid of SERVICE_UUIDS) {
    try {
      service = await server.getPrimaryService(uuid)
      break
    } catch {
      // Continuar buscando
    }
  }

  // Si ninguno de los conocidos respondio, se recorren todos los visibles y se
  // elige el primero que tenga donde escribir: quedarse con el primero a secas
  // falla cuando ese es, por ejemplo, el servicio de bateria
  const candidatos = service ? [service] : await server.getPrimaryServices()

  for (const candidato of candidatos) {
    for (const uuid of CHARACTERISTIC_UUIDS) {
      try {
        labelCharacteristic = await candidato.getCharacteristic(uuid)
        break
      } catch {
        // Continuar buscando
      }
    }

    if (!labelCharacteristic) {
      const characteristics = await candidato.getCharacteristics()

      labelCharacteristic =
        characteristics.find(char => char.properties.write || char.properties.writeWithoutResponse) || null
    }

    if (labelCharacteristic) {
      service = candidato
      break
    }
  }

  if (!labelCharacteristic) {
    // El detalle ayuda a identificar una impresora no contemplada
    const vistos = candidatos.map(c => c.uuid).join(', ') || 'ninguno'

    throw new Error(`La impresora no expone un servicio de impresión reconocido. Servicios visibles: ${vistos}`)
  }

  return true
}

// ---------------------------------------------------------------- envio rapido
//
// Una etiqueta es una imagen de miles de bytes. Mandandola de a 20 bytes con una
// pausa —lo que le alcanza y le sobra a una factura de texto— son unos 3 KB/s, y
// el motor de la impresora consume bastante mas: se queda sin datos a mitad de la
// etiqueta, frena, arranca, y el papel avanza a los tirones (el "zapateo").
//
// Aca se manda el paquete mas grande que acepte la conexion. El tope real depende
// de la MTU que negocio el celular y Web Bluetooth no la expone, asi que se prueba
// de mayor a menor: si no entra, el navegador rechaza la escritura ANTES de
// transmitir, con lo cual reintentar mas chico es seguro y no corrompe lo que la
// impresora ya recibio.
const TAMANOS_DE_PAQUETE = [180, 100, 60, 20]

let tamanoPaquete = 0

const escribir = async (chunk: Uint8Array): Promise<void> => {
  if (!labelCharacteristic) throw new Error('Impresora no conectada')

  // El cast es por la version del lib DOM: writeValue pide BufferSource
  const buffer = chunk as unknown as BufferSource

  if (labelCharacteristic.properties.writeWithoutResponse) {
    await labelCharacteristic.writeValueWithoutResponse(buffer)
  } else {
    await labelCharacteristic.writeValue(buffer)
  }
}

// pauseMs en 0: la promesa de la escritura ya espera a que el paquete salga, asi
// que la pausa solo agrega tiempo muerto. El parametro queda por si alguna
// impresora necesitara respirar entre paquetes.
export const writeToLabelPrinter = async (data: Uint8Array, pauseMs = 0): Promise<void> => {
  if (!labelCharacteristic) throw new Error('Impresora no conectada')

  for (let i = 0; i < data.length; ) {
    // Se prueba de mayor a menor. Con un tamaño ya confirmado se arranca de ahi,
    // pero los menores quedan disponibles: si ese tamaño dejara de entrar y la
    // lista fuera solo el confirmado, no se enviaria nada, `i` no avanzaria y el
    // bucle no terminaria nunca.
    const candidatos = tamanoPaquete
      ? TAMANOS_DE_PAQUETE.filter(tamano => tamano <= tamanoPaquete)
      : TAMANOS_DE_PAQUETE

    let enviado = 0

    for (const tamano of candidatos) {
      try {
        await escribir(data.slice(i, i + tamano))
        tamanoPaquete = tamano
        enviado = tamano
        break
      } catch (error) {
        // El ultimo es el minimo de BLE: si tampoco entra, el problema es otro
        if (tamano === candidatos[candidatos.length - 1]) throw error
      }
    }

    // Resguardo: sin esto, un `enviado` en 0 colgaria el navegador en silencio
    if (enviado === 0) throw new Error('No se pudo enviar el paquete a la impresora')

    i += enviado

    if (pauseMs > 0) await new Promise(resolve => setTimeout(resolve, pauseMs))
  }
}
