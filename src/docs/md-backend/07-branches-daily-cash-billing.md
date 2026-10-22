# Sucursales, caja diaria y facturación

## Sucursales

Cada `Branch` puede tener (o no) datos de facturación SIAT asociados
(`SiatBranch`: CUIS/CUFD, código de sucursal SIN, razón social, dirección,
etc.). **Una sucursal sin `SiatBranch` activo no puede vender online** — no
aparece en `GET /web-page/branches` (el selector del checkout) y si se
intenta crear una orden online para esa sucursal igual, el backend la
rechaza (`400`) porque la venta se factura sola al confirmar el pago y sin
SIAT quedaría sin factura. **En tienda física sí se puede vender sin SIAT
configurado** (la venta queda, pero no se puede facturar hasta que se
configure).

```
GET  /branches                (A, S)  lista con datos SIAT
GET  /branches/:id            (A, S)
POST /branches                (A, S)
PATCH /branches/:id           (A, S)  incluye actualizar el bloque siatBranch
```
No se puede desactivar (`active: false`) una sucursal con una caja abierta
ni con traslados en curso — `409 Conflict` hasta que se cierre la caja o se
reciban/anulen los traslados.

Cada sucursal trae `type: "store"`. La **bodega principal** también es una
`Branch` por dentro, pero **no aparece** en `GET /branches` ni en
`GET /web-page/branches`, y `GET /branches/:id` con su id da `404`. Se
consulta y renombra con `GET/PATCH /central-warehouse` (ver
[11-central-warehouse-and-branch-transfers.md](11-central-warehouse-and-branch-transfers.md)).

## Caja diaria (`dailyCash`)

Un turno de caja por sucursal. Solo puede haber **una caja abierta a la vez**
por sucursal.

```
POST /dailyCash/open
{ "openingAmount": "200.00" }
→ DailyCash { id, status: "open", openedAt, openedBy, branch }

GET /dailyCash/current
→ la caja abierta de tu sucursal (o 404/null si no hay ninguna — chequear
  antes de intentar abrir otra)

POST /dailyCash/:id/close
{ "closingAmount": "1350.00", "closingNote?": "Faltante de 5 Bs, revisado con el cajero" }
→ DailyCash { status: "closed", expectedAmount, closingAmount, closedBy,
               salesAmount, advancesAmount, refundsAmount, ... }
```
`expectedAmount` se calcula **en el momento del cierre** (desde `openedAt`
hasta ahora), no es un contador que el frontend tenga que llevar:

**`expectedAmount` = apertura + `salesAmount` + `advancesAmount` − `refundsAmount`**

| Campo | Qué suma |
|---|---|
| `salesAmount` | ventas in-store vigentes del turno, por lo **cobrado en caja**: en la venta de retiro de un pedido cobrado, sin la parte del anticipo |
| `advancesAmount` | anticipos de pedidos entre sucursales cobrados **desde el cierre anterior** de la tienda (no son ventas; un anticipo QR cuenta cuando BNB confirma — si confirmó con la caja cerrada, entre dos turnos, entra en el cierre siguiente) |
| `refundsAmount` | devoluciones de anticipos pagadas desde el cierre anterior (siempre en efectivo, con caja abierta: en la práctica, las del turno) |

Comparalo contra `closingAmount` para mostrar sobrantes/faltantes, y mostrá
el desglose. En cajas cerradas antes de este cambio los tres campos vienen
`null`. Cobrar un anticipo, generar su QR o devolverlo **exige la caja
abierta** (`409 La caja de esta sucursal no está abierta: ábrela para cobrar|devolver el anticipo`).
Detalle en [13-prepaid-branch-requests.md](13-prepaid-branch-requests.md).

> El total no separa por método de pago (efectivo, tarjeta, QR van juntos),
> igual que antes.

```
GET /dailyCash?limit=&page=&branchId=(solo ADMIN/SUPERVISOR)      (A, S, M)  historial
```
MANAGER siempre ve el de su sucursal; ADMIN/SUPERVISOR filtran con
`?branchId=` o ven todas si lo omiten.

## Datos de facturación del cliente (`billing`)

```
GET  /billing/:ci      (M, C)   busca por CI/NIT, para autocompletar en el POS
POST /billing          (M, C)   crear/actualizar un registro
```
`ci`, `codigoTipoDocumentoIdentidad` son obligatorios; `name`, `phone`,
`email`, `complemento` opcionales. Estos mismos campos son los que se mandan
embebidos en `billing` al crear cualquier orden (in-store u online) — no
hace falta llamar `POST /billing` aparte si ya lo mandás en la creación de
la orden, el backend lo crea/actualiza solo.

## Facturación (SIAT)

Dos niveles:

### Nivel orden (lo que usa el frontend de ventas)
```
POST /orders/:orderId/facturar                (M, C)
POST /orders/:orderId/facturar-contingencia    (M, C)
```
Emite la factura para una orden específica. Falla si la orden ya tiene
factura, no tiene `billing`, o no es de tu sucursal.

**Refacturar** (mismo endpoint): si la factura actual de la orden está
**ANULADA** o **RECHAZADA**, se emite una nueva que la reemplaza. En el body
podés corregir los datos del cliente: `nombreRazonSocial`, `numeroDocumento`,
`complemento`, `codigoTipoDocumentoIdentidad`, `numeroTarjeta`, `emails` (si
no los mandás, se usan los del `billing` de la orden). Con la factura en
cualquier otro estado → `400 La order N ya tiene una factura generada (id X, estado E)`.
Si la emisión falla, la factura anterior sigue ligada a la orden (nada queda
a medias).

**Historial**: `GET /orders/:id` (staff) trae `facturasAnteriores`, las
facturas reemplazadas (también las de la orden original si es una edición):
`{ id, numeroFactura, cuf, estado, fechaEmision, montoTotal, nombreRazonSocial, numeroDocumento, ordenOriginalId }`.
El PDF de cada una sale por su `id` (endpoint de abajo, ADMIN/SUPERVISOR).

### Estados de la factura y qué se puede hacer

| Estado | ¿Vigente? | Acciones |
|---|---|---|
| `VALIDADA` | Sí | Anular (ADMIN/SUPERVISOR, `/facturacion/facturacion/anulacion`) |
| `ANULADA` | No | **O** refacturar la orden, **o** revertir la anulación (`/facturacion/facturacion/reversion`) — excluyentes: refacturada, ya no se revierte |
| `REVERTIDA` | **Sí** (mostrala como válida) | Ninguna: es definitiva, no se puede volver a anular ni refacturar |
| `RECHAZADA` | No | Refacturar la orden |
| `OBSERVADA` | — | Por ahora ninguna (pendiente conocido del backend) |

Anular una factura que no está `VALIDADA` → `400` con el motivo.

**Venta online: se factura sola.** Al confirmarse el pago (webhook QR o
Cybersource), el backend dispara la facturación automáticamente
(fire-and-forget, no bloquea la respuesta del webhook). Si falla (datos
faltantes, SIAT caído), la orden queda `PAID` sin factura y **no hay
reintento automático** — se factura a mano después con el endpoint de
arriba.

**Venta in-store: manual siempre.** El cajero/manager decide cuándo facturar
llamando el endpoint de arriba.

### Nivel SIAT bajo nivel (ADMIN y SUPERVISOR, uso interno/soporte)
Todo bajo `/facturacion`, `/cafc`, `/catalogos`, `/codigos`, `/paquetes`,
`/operaciones` — configuración de CUIS/CUFD, catálogos SIAT, puntos de
venta, contingencia, paquetes de envío masivo. El frontend de ventas
normalmente **no** llama nada de esto directamente; es panel de
administración/soporte técnico.

### PDF de la factura
Existe `GET /facturacion/facturacion/:id/representacion-grafica` (ADMIN,
SUPERVISOR) que devuelve el PDF. **No está expuesto para MANAGER/CASHIER a
propósito** — el
cliente recibe la factura por email al momento de facturar. Si tu POS
necesita reimprimir/mostrar el PDF en el momento de la venta, es un gap
conocido, no algo que ya funcione — avisá antes de asumirlo.
