// Versiones en hoja A4 (impresora comun de oficina) de los comprobantes de
// bodega: recepcion de traslado, remito de envio e ingreso/baja de bodega.
//
// Es un archivo APARTE a proposito: los formatos de rollo (receptionReceipt.ts)
// estan calibrados contra la termica de 80mm y no se tocan. Aca se reutilizan
// solo los TIPOS de datos, asi que cada pantalla arma el mismo objeto y elige
// en que papel sale.

import type { DispatchNote, IncomingNote, ReceptionReceipt } from './receptionReceipt'

const formatDateTime = (date: Date) =>
  `${date.toLocaleDateString('es-BO')} ${date.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })}`

// Los nombres de prenda, notas y motivos los escribe la gente: se escapan para
// que un "<" no rompa la hoja
const esc = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

// ---------------------------------------------------------------- base común

const A4_STYLES = `
  /* Sin tamaño fijo: sale bien en hoja carta o A4, la que tenga la impresora.
     Margenes de documento impreso: 2cm, y 2.5cm a la izquierda para archivar */
  @page { size: portrait; margin: 20mm 20mm 20mm 25mm; }

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 11pt;
    color: #000;
    background: #fff;
    line-height: 1.35;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  @media screen {
    html { background: #e9e9e9; padding: 24px 0; }
    /* Vista previa en pantalla con la forma de una hoja carta y sus margenes */
    body {
      width: 216mm;
      min-height: 279mm;
      margin: 0 auto;
      padding: 20mm 20mm 20mm 25mm;
      box-shadow: 0 2px 12px rgba(0,0,0,0.2);
    }
  }

  .encabezado {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    border-bottom: 2px solid #000;
    padding-bottom: 3mm;
    margin-bottom: 5mm;
  }
  .encabezado .titulo { font-size: 18pt; font-weight: bold; letter-spacing: 0.5px; }
  .encabezado .numero { font-size: 13pt; font-weight: bold; text-align: right; }
  .encabezado .fecha { font-size: 10pt; text-align: right; }

  .datos {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 2mm 8mm;
    margin-bottom: 6mm;
  }
  .datos .dato { display: flex; gap: 2mm; border-bottom: 1px solid #ccc; padding: 1mm 0; }
  .datos .dato span:first-child { color: #555; min-width: 26mm; }
  .datos .dato span:last-child { font-weight: bold; }
  .datos .ancho { grid-column: 1 / -1; }

  table { width: 100%; border-collapse: collapse; font-size: 10.5pt; }
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; }
  th, td { border: 1px solid #000; padding: 1.8mm 2mm; text-align: left; vertical-align: middle; }
  th { background: #eee; font-weight: bold; }
  td.num, th.num { text-align: right; width: 24mm; }
  td.idx, th.idx { text-align: center; width: 9mm; }
  td.chk, th.chk { text-align: center; width: 10mm; }
  td.sku { font-family: 'Courier New', monospace; font-size: 9.5pt; width: 34mm; }
  tr.falta td { font-weight: bold; background: #f3f3f3; }
  tfoot td { font-weight: bold; background: #eee; }

  .check { display: inline-block; width: 4mm; height: 4mm; border: 0.35mm solid #000; }

  .nota { margin-top: 5mm; padding: 3mm; border: 1px solid #000; min-height: 14mm; }
  .nota .rotulo { font-weight: bold; margin-bottom: 1mm; }

  .firmas { display: flex; gap: 15mm; margin-top: 22mm; page-break-inside: avoid; }
  .firma { flex: 1; text-align: center; }
  .firma .linea { border-top: 1px solid #000; margin-bottom: 1.5mm; }
  .firma .rol { font-weight: bold; }
  .firma .aclara { font-size: 9.5pt; color: #333; }
  .firma .ci { font-size: 9pt; color: #555; margin-top: 4mm; text-align: left; }

  .pie { margin-top: 8mm; font-size: 9pt; color: #555; text-align: center; }
`

const page = (title: string, body: string) => `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="UTF-8">
    <title>${esc(title)}</title>
    <style>${A4_STYLES}</style>
  </head>
  <body>${body}</body>
</html>`

const header = (titulo: string, numero?: string) => `
  <div class="encabezado">
    <div class="titulo">${esc(titulo)}</div>
    <div>
      ${numero ? `<div class="numero">${esc(numero)}</div>` : ''}
      <div class="fecha">${formatDateTime(new Date())}</div>
    </div>
  </div>`

const dato = (label: string, value: unknown, wide = false) =>
  `<div class="dato${wide ? ' ancho' : ''}"><span>${esc(label)}</span><span>${esc(value)}</span></div>`

const firma = (rol: string, aclara: string) => `
  <div class="firma">
    <div class="linea"></div>
    <div class="rol">${esc(rol)}</div>
    <div class="aclara">${esc(aclara)}</div>
    <div class="ci">Aclaración / C.I.: ______________________</div>
  </div>`

const openAndPrint = (html: string) => {
  const printWindow = window.open('', '_blank', 'width=1000,height=800')

  if (!printWindow) return

  printWindow.document.write(html)
  printWindow.document.close()
  printWindow.focus()

  // Sin la espera, Chrome imprime antes de aplicar los estilos
  setTimeout(() => printWindow.print(), 300)
}

// ------------------------------------------------------- recepción de traslado

export const generateReceptionA4HTML = (receipt: ReceptionReceipt): string => {
  const totalDispatched = receipt.lines.reduce((sum, line) => sum + line.dispatched, 0)
  const totalReceived = receipt.lines.reduce((sum, line) => sum + line.received, 0)

  const rows = receipt.lines
    .map((line, index) => {
      const diff = line.received - line.dispatched

      return `
        <tr class="${diff < 0 ? 'falta' : ''}">
          <td class="idx">${index + 1}</td>
          <td class="chk"><span class="check"></span></td>
          <td>${esc(line.label)}</td>
          <td class="num">${line.dispatched}</td>
          <td class="num">${line.received}</td>
          <td class="num">${diff < 0 ? `Faltan ${-diff}` : diff > 0 ? `+${diff}` : '—'}</td>
        </tr>`
    })
    .join('')

  const diffTotal = totalReceived - totalDispatched

  return page(
    `Recepcion traslado #${receipt.transferId}`,
    `
    ${header('COMPROBANTE DE RECEPCIÓN', `Traslado #${receipt.transferId}`)}

    <div class="datos">
      ${dato('Viene de', receipt.origin)}
      ${dato('Recibe', receipt.destination)}
      ${dato('Despachó', receipt.dispatchedBy || '—')}
      ${dato('Recibido por', receipt.receivedBy)}
      ${dato('Ingresa a', receipt.location, true)}
    </div>

    <table>
      <thead>
        <tr>
          <th class="idx">#</th>
          <th class="chk">✓</th>
          <th>Prenda</th>
          <th class="num">Despachado</th>
          <th class="num">Recibido</th>
          <th class="num">Diferencia</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr>
          <td colspan="3">TOTAL</td>
          <td class="num">${totalDispatched}</td>
          <td class="num">${totalReceived}</td>
          <td class="num">${diffTotal < 0 ? `Faltan ${-diffTotal}` : diffTotal > 0 ? `+${diffTotal}` : '—'}</td>
        </tr>
      </tfoot>
    </table>

    <div class="nota">
      <div class="rotulo">Observaciones</div>
      ${receipt.note ? esc(receipt.note) : ''}
    </div>

    <div class="firmas">
      ${firma('Entrega', receipt.dispatchedBy ? `${receipt.dispatchedBy} · ${receipt.origin}` : receipt.origin)}
      ${firma('Recibe', `${receipt.receivedBy} · ${receipt.destination}`)}
    </div>

    <div class="pie">Las cantidades recibidas son las que quedan registradas.</div>
    `
  )
}

export const printReceptionReceiptA4 = (receipt: ReceptionReceipt): void =>
  openAndPrint(generateReceptionA4HTML(receipt))

// ----------------------------------------------------------- remito de envío

export const generateDispatchA4HTML = (note: DispatchNote): string => {
  const total = note.lines.reduce((sum, line) => sum + line.quantity, 0)

  const rows = note.lines
    .map(
      (line, index) => `
        <tr>
          <td class="idx">${index + 1}</td>
          <td class="chk"><span class="check"></span></td>
          <td>${esc(line.label)}</td>
          <td class="num">${line.quantity}</td>
        </tr>`
    )
    .join('')

  return page(
    `Envio${note.transferId ? ` #${note.transferId}` : ''}`,
    `
    ${header('REMITO DE ENVÍO', note.transferId ? `Traslado #${note.transferId}` : undefined)}

    <div class="datos">
      ${dato('Sale de', 'Bodega Central')}
      ${dato('Va a', note.destination)}
      ${dato('Despacha', note.dispatchedBy, true)}
    </div>

    <table>
      <thead>
        <tr>
          <th class="idx">#</th>
          <th class="chk">✓</th>
          <th>Prenda</th>
          <th class="num">Cantidad</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr>
          <td colspan="3">TOTAL</td>
          <td class="num">${total}</td>
        </tr>
      </tfoot>
    </table>

    <div class="pie">Acompaña la mercadería. Se firma al recibir, en destino.</div>
    `
  )
}

export const printDispatchNoteA4 = (note: DispatchNote): void => openAndPrint(generateDispatchA4HTML(note))

// ------------------------------------------------- ingreso / baja de bodega

export const generateIncomingA4HTML = (note: IncomingNote): string => {
  const baja = note.kind === 'baja'
  const signo = baja ? '-' : ''
  const total = note.lines.reduce((sum, line) => sum + line.quantity, 0)

  const rows = note.lines
    .map(
      (line, index) => `
        <tr>
          <td class="idx">${index + 1}</td>
          <td class="chk"><span class="check"></span></td>
          <td>${esc(line.label)}</td>
          <td class="sku">${esc(line.sku || '—')}</td>
          <td class="num">${signo}${line.quantity}</td>
        </tr>`
    )
    .join('')

  return page(
    baja ? 'Baja de bodega' : 'Ingreso a bodega',
    `
    ${header(baja ? 'BAJA DE BODEGA CENTRAL' : 'INGRESO A BODEGA')}

    <div class="datos">
      ${dato(baja ? 'Sale de' : 'Entra a', 'Bodega Central')}
      ${dato('Registra', note.registeredBy)}
      ${note.reason ? dato('Motivo', note.reason, true) : ''}
    </div>

    <table>
      <thead>
        <tr>
          <th class="idx">#</th>
          <th class="chk">✓</th>
          <th>Prenda</th>
          <th>SKU</th>
          <th class="num">Cantidad</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr>
          <td colspan="4">TOTAL</td>
          <td class="num">${signo}${total}</td>
        </tr>
      </tfoot>
    </table>

    <div class="firmas">
      ${firma('Registra', note.registeredBy)}
      ${firma('Revisa / Autoriza', '')}
    </div>

    <div class="pie">${baja ? 'Comprobante interno de baja de mercadería.' : 'Comprobante interno de ingreso de mercadería.'}</div>
    `
  )
}

export const printIncomingNoteA4 = (note: IncomingNote): void => openAndPrint(generateIncomingA4HTML(note))
