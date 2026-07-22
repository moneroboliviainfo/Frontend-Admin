import type { Factura } from '@/types/api/sales'

// Convertir número a palabras en español boliviano
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

  if (c > 0) {
    resultado += centenas[c] + ' '
  }

  if (resto >= 10 && resto <= 19) {
    resultado += especiales[resto - 10]
  } else {
    const d = Math.floor(resto / 10)
    const u = resto % 10

    if (d > 0) {
      if (d === 2 && u > 0) {
        resultado += 'VEINTI' + unidades[u].toLowerCase().toUpperCase()
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

    if (millones === 1) {
      resultado += 'UN MILLON '
    } else {
      resultado += convertirMenorMil(millones) + ' MILLONES '
    }

    if (restoMillones > 0) {
      if (restoMillones >= 1000) {
        const miles = Math.floor(restoMillones / 1000)
        const restoMiles = restoMillones % 1000

        if (miles === 1) {
          resultado += 'MIL '
        } else {
          resultado += convertirMenorMil(miles) + ' MIL '
        }

        if (restoMiles > 0) {
          resultado += convertirMenorMil(restoMiles)
        }
      } else {
        resultado += convertirMenorMil(restoMillones)
      }
    }
  } else if (entero >= 1000) {
    const miles = Math.floor(entero / 1000)
    const restoMiles = entero % 1000

    if (miles === 1) {
      resultado += 'MIL '
    } else {
      resultado += convertirMenorMil(miles) + ' MIL '
    }

    if (restoMiles > 0) {
      resultado += convertirMenorMil(restoMiles)
    }
  } else {
    resultado = convertirMenorMil(entero)
  }

  resultado = resultado.trim() + ' ' + centavos.toString().padStart(2, '0') + '/100'

  return resultado
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
  const unidades: Record<number, string> = {
    1: 'BOBINAS',
    2: 'BALDE',
    3: 'BARRILES',
    4: 'BOLSA',
    5: 'BOTELLAS',
    6: 'CAJA',
    7: 'CARTONES',
    8: 'CILINDRO',
    9: 'CONOS',
    10: 'DOCENA',
    11: 'FARDO',
    12: 'GALON',
    13: 'GRAMO',
    14: 'GRUESA',
    15: 'HECTAREA',
    16: 'HOJAS',
    17: 'JUEGO',
    18: 'KILOGRAMO',
    19: 'KILOMETRO',
    20: 'KILOVATIO',
    21: 'KILOVATIO HORA',
    22: 'LIBRAS',
    23: 'LITROS',
    24: 'MEGAVATIO',
    25: 'METRO',
    26: 'METRO CUADRADO',
    27: 'METRO CUBICO',
    28: 'MILIGRAMO',
    29: 'MILILITRO',
    30: 'MILIMETRO',
    31: 'ONZA TROY',
    32: 'PAQUETE',
    33: 'PAR',
    34: 'PIES',
    35: 'PIES CUADRADO',
    36: 'PIES CUBICO',
    37: 'PIEZA',
    38: 'PLANCHAS',
    39: 'PLIEGO',
    40: 'PULGADA',
    41: 'QUINTAL METRICO',
    42: 'RESMA',
    43: 'ROLLO',
    44: 'SET',
    45: 'TAMBOR',
    46: 'TONELADA METRICA',
    47: 'TUBO',
    48: 'YARDA',
    57: 'UNIDAD (BIENES)',
    58: 'UNIDAD (SERVICIOS)'
  }

  return unidades[codigo] || 'UNIDAD'
}

export const generateInvoiceHTML = (factura: Factura): string => {
  const fechaEmision = formatDate(factura.fechaEmision)
  const horaEmision = formatTime(factura.fechaEmision)
  const montoEnLetras = numeroALetras(factura.montoTotal)

  // Calcular subtotal de items
  const subtotal = factura.detalles.reduce((acc, item) => acc + item.subTotal, 0)

  // Generar HTML de detalles
  const detallesHTML = factura.detalles
    .map(detalle => {
      const descuento = detalle.montoDescuento || 0

      return `
        <div class="detalle-item">
          <div class="detalle-producto">${detalle.codigoProducto} - ${detalle.descripcion}</div>
          <div class="detalle-unidad">Unidad de Medida: ${getUnidadMedidaLabel(detalle.unidadMedida)}</div>
          <div class="detalle-calculo">
            <span>${detalle.cantidad.toFixed(2)} X ${detalle.precioUnitario.toFixed(2)} - ${descuento.toFixed(2)}</span>
            <span>${detalle.subTotal.toFixed(2)}</span>
          </div>
        </div>
      `
    })
    .join('')

  // URL del SIAT para verificación de factura
  const siatVerificationUrl = `https://pilotosiat.impuestos.gob.bo/consulta/QR?nit=${factura.nitEmisor}&cuf=${factura.cuf}&numero=${factura.numeroFactura}&t=2`

  // URL para generar QR (codificando la URL del SIAT)
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(siatVerificationUrl)}`

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Factura #${factura.numeroFactura}</title>
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
          font-size: 9px;
          width: 72mm;
          padding: 3mm;
          color: #000;
          background: #fff;
          margin: 0 auto;
          line-height: 1.4;
        }

        @media screen {
          body {
            transform: scale(2.5);
            transform-origin: top center;
            margin-top: 20px;
          }
        }

        @media print {
          body {
            transform: none;
            margin: 0;
          }
        }

        .header {
          text-align: center;
          margin-bottom: 8px;
        }

        .title {
          font-size: 11px;
          font-weight: bold;
          line-height: 1.2;
        }

        .company-name {
          font-size: 9px;
          margin: 6px 0 2px;
        }

        .branch-info {
          font-size: 8px;
          line-height: 1.3;
        }

        .separator {
          border-top: 1px dashed #000;
          margin: 8px 0;
        }

        .section-center {
          text-align: center;
          margin: 6px 0;
        }

        .section-center .label {
          font-size: 9px;
          font-weight: bold;
        }

        .section-center .value {
          font-size: 10px;
          font-weight: bold;
        }

        .section-center .value-large {
          font-size: 12px;
          font-weight: bold;
        }

        .cuf-section {
          text-align: center;
          margin: 6px 0;
        }

        .cuf-label {
          font-size: 9px;
          font-weight: bold;
        }

        .cuf-value {
          font-size: 6px;
          word-break: break-all;
          line-height: 1.3;
          margin-top: 2px;
        }

        .cliente-section {
          margin: 8px 0;
          text-align: center;
        }

        .info-row {
          font-size: 8px;
          margin: 3px 0;
          line-height: 1.2;
        }

        .info-row .label {
          font-weight: bold;
        }

        .info-row .value {
          margin-left: 4px;
        }

        .detalle-section {
          margin: 8px 0;
        }

        .detalle-title {
          text-align: center;
          font-weight: bold;
          font-size: 9px;
          padding: 4px 0;
          border-top: 1px dashed #000;
          border-bottom: 1px dashed #000;
        }

        .detalle-item {
          margin: 6px 0;
        }

        .detalle-producto {
          font-size: 8px;
          font-weight: bold;
        }

        .detalle-unidad {
          font-size: 7px;
          margin: 2px 0;
        }

        .detalle-calculo {
          display: flex;
          justify-content: space-between;
          font-size: 8px;
        }

        .totales {
          border-top: 1px dashed #000;
          margin-top: 8px;
          padding-top: 6px;
        }

        .total-row {
          display: flex;
          justify-content: flex-end;
          font-size: 8px;
          margin: 3px 0;
        }

        .total-row .total-label {
          text-align: right;
        }

        .total-row .total-value {
          width: 50px;
          text-align: right;
        }

        .total-row.bold {
          font-weight: bold;
          font-size: 9px;
        }

        .monto-letras {
          font-size: 8px;
          margin: 10px 0;
          text-align: left;
        }

        .leyenda-section {
          border-top: 1px dashed #000;
          margin-top: 8px;
          padding-top: 8px;
          text-align: center;
        }

        .leyenda-title {
          font-size: 8px;
          font-weight: bold;
          line-height: 1.4;
          margin-bottom: 10px;
        }

        .leyenda-text {
          font-size: 7px;
          line-height: 1.4;
          margin-bottom: 8px;
        }

        .leyenda-documento {
          font-size: 7px;
          line-height: 1.4;
          margin-top: 8px;
        }

        .qr-container {
          text-align: center;
          margin: 12px 0 8px;
        }

        .qr-container img {
          width: 90px;
          height: 90px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="title">FACTURA</div>
        <div class="title">CON DERECHO A CRÉDITO FISCAL</div>
        <div class="company-name">${factura.razonSocialEmisor}</div>
        <div class="branch-info">
          Casa Matriz<br>
          ${factura.nombreSucursal}<br>
          No. Punto de Venta ${factura.codigoPuntoVenta}<br>
          ${factura.direccion}<br>
          Tel. ${factura.telefono}<br>
          ${factura.municipio}
        </div>
      </div>

      <div class="separator"></div>

      <div class="section-center">
        <div class="label">NIT</div>
        <div class="value">${factura.nitEmisor}</div>
        <div class="label" style="margin-top: 6px;">FACTURA N°</div>
        <div class="value-large">${factura.numeroFactura}</div>
      </div>

      <div class="cuf-section">
        <div class="cuf-label">CÓD. AUTORIZACIÓN</div>
        <div class="cuf-value">${factura.cuf}</div>
      </div>

      <div class="separator"></div>

      <div class="cliente-section">
        <div class="info-row">
          <span class="label">NOMBRE/RAZÓN SOCIAL:</span> <span class="value">${factura.nombreRazonSocial}</span>
        </div>
        <div class="info-row">
          <span class="label">NIT/CI/CEX:</span> <span class="value">${factura.numeroDocumento}${factura.complemento ? '-' + factura.complemento : ''}</span>
        </div>
        <div class="info-row">
          <span class="label">COD. CLIENTE:</span> <span class="value">${factura.codigoCliente}</span>
        </div>
        <div class="info-row">
          <span class="label">FECHA DE EMISIÓN:</span> <span class="value">${fechaEmision} ${horaEmision}</span>
        </div>
      </div>

      <div class="detalle-section">
        <div class="detalle-title">DETALLE</div>
        ${detallesHTML}
      </div>

      <div class="totales">
        <div class="total-row"><span class="total-label">SUBTOTAL Bs</span><span class="total-value">${subtotal.toFixed(2)}</span></div>
        <div class="total-row"><span class="total-label">DESCUENTO Bs</span><span class="total-value">${factura.descuentoAdicional.toFixed(2)}</span></div>
        <div class="total-row"><span class="total-label">TOTAL Bs</span><span class="total-value">${factura.montoTotal.toFixed(2)}</span></div>
        <div class="total-row"><span class="total-label">MONTO GIFT CARD Bs</span><span class="total-value">${(factura.montoGiftCard || 0).toFixed(2)}</span></div>
        <div class="total-row bold"><span class="total-label">MONTO A PAGAR Bs</span><span class="total-value">${factura.montoTotal.toFixed(2)}</span></div>
        <div class="total-row bold"><span class="total-label">IMPORTE BASE CRÉDITO FISCAL Bs</span><span class="total-value">${factura.montoTotalSujetoIva.toFixed(2)}</span></div>
      </div>

      <div class="monto-letras">
        Son: ${montoEnLetras} Bolivianos
      </div>

      <div class="leyenda-section">
        <div class="leyenda-title">
          ESTA FACTURA CONTRIBUYE AL DESARROLLO DEL PAÍS,<br>
          EL USO ILÍCITO SERÁ SANCIONADO PENALMENTE DE<br>
          ACUERDO A LEY
        </div>

        <div class="leyenda-text">
          ${factura.leyenda}
        </div>

        <div class="leyenda-documento">
          "${factura.codigoEmision === 1 ? 'Este documento es la Representación Gráfica de un Documento Fiscal Digital emitido en una modalidad de facturación en línea' : 'Este documento es la Representación Gráfica de un Documento Fiscal Digital emitido en una modalidad de facturación fuera de línea'}"
        </div>
      </div>

      <div class="qr-container">
        <img src="${qrUrl}" alt="QR Code" />
      </div>

    </body>
    </html>
  `
}

export const printInvoice = (factura: Factura): void => {
  const html = generateInvoiceHTML(factura)

  const width = 1200
  const height = 700
  const left = window.screenX + 100
  const top = window.screenY + 50

  const printWindow = window.open(
    '',
    '_blank',
    `width=${width},height=${height},left=${left},top=${top},scrollbars=yes`
  )

  if (!printWindow) {
    console.error('Could not open print window')

    return
  }

  printWindow.document.write(html)
  printWindow.document.close()

  printWindow.onload = () => {
    printWindow.focus()
    printWindow.print()
    printWindow.close()
  }
}

export const openInvoicePreview = (factura: Factura): void => {
  const html = generateInvoiceHTML(factura)

  const width = 1200
  const height = 700
  const left = window.screenX + 100
  const top = window.screenY + 50

  const previewWindow = window.open(
    '',
    '_blank',
    `width=${width},height=${height},left=${left},top=${top},scrollbars=yes`
  )

  if (!previewWindow) {
    console.error('Could not open preview window')

    return
  }

  previewWindow.document.write(html)
  previewWindow.document.close()
}

export default printInvoice
