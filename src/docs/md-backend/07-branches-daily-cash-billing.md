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
GET  /branches                (A, S)  lista con datos SIAT — solo tiendas
GET  /branches?type=billing_only (A, S)  solo las sucursales "solo facturación"
GET  /branches/:id            (A, S)  tiendas y "solo facturación"
POST /branches                (A, S)
PATCH /branches/:id           (A, S)  incluye actualizar el bloque siatBranch
```
En el `PATCH`, el bloque `siatBranch` lleva **solo los campos editables**:
`codigoSucursal`, `name`, `alias`, `razonSocial`, `actividadEconomica`,
`address`, `departamento`, `municipio`, `telefono`, `active` (todos
opcionales). **No reenviar el objeto tal como vino del `GET`**: `id` y
`createdAt` son de solo lectura y el backend responde `400`
(`"siatBranch.property id should not exist"`). Lo mismo para la sucursal:
solo `name` y `active`.

```js
const { id, createdAt, ...siatBranch } = branch.siatBranch;
await api.patch(`/branches/${branch.id}`, { name, active, siatBranch });
```
No se puede desactivar (`active: false`) una sucursal con una caja abierta
ni con traslados en curso — `409 Conflict` hasta que se cierre la caja o se
reciban/anulen los traslados.

Cada sucursal trae `type: "store"`. La **bodega principal** también es una
`Branch` por dentro, pero **no aparece** en `GET /branches` ni en
`GET /web-page/branches`, y `GET /branches/:id` con su id da `404`. Se
consulta y renombra con `GET/PATCH /central-warehouse` (ver
[11-central-warehouse-and-branch-transfers.md](11-central-warehouse-and-branch-transfers.md)).

### Sucursales "solo facturación" (`type: "billing_only"`)

Sucursales con datos SIAT que **solo emiten facturas manuales**: no tienen
stock, ventas, caja ni traslados (hoy DASH 21 y ZARGA 701). Se crean o
convierten **por SQL** (la API no cambia el `type`).

- **No aparecen** en `GET /branches` sin parámetro ni en
  `GET /web-page/branches`: los selectores de stock, ventas, envíos y pedidos
  nunca las muestran. El admin las ve con `GET /branches?type=billing_only`
  y las edita (datos SIAT, activar/desactivar) con `GET`/`PATCH /branches/:id`.
- Se les pueden asignar **MANAGER y CASHIER** (`POST /users/staff`,
  `PATCH /users/:id` con su `branchId`). ⚠️ El selector de sucursal del
  formulario de usuarios no las ve si carga solo `GET /branches`: tiene que
  cargar también `GET /branches?type=billing_only`. `GET /users` trae
  `branch.type` de cada usuario.
- Su staff usa **todo lo de facturación SIAT** (`/facturacion`, `/paquetes`,
  `/catalogos`, `POST /codigos/verificar-nit`, eventos significativos de
  `/operaciones`, leer `/cafc`), limitado a su sucursal SIAT. Cualquier
  endpoint de stock, ventas, caja o traslados responde
  `403 Esta sucursal es solo de facturación: esta acción no está disponible para ella`
  (lo mismo si un admin manda `?branchId=<sucursal solo facturación>`).
- El login trae `branch.type`: con `"billing_only"`, mostrar solo el menú de
  facturación.

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
factura, no tiene `billing`, o no es de tu sucursal. Además:

- **Solo ventas cobradas**: en tienda `sent`; online `paid` o `sent`. Otra
  orden (`pending`, `cancelled`, `expired`, `cancelled_for_edit`,
  `completed_edition`) → `400 La order N está <estado>: solo se facturan ventas cobradas (...)`.
- **Edición de una venta facturada**: si es una edición (`inherited_id`) y la
  original u otra edición ya tiene una factura vigente (VALIDADA/REVERTIDA)
  → `400 La order N es una edición de la order R, que ya tiene la factura …`.
  Primero hay que anular esa factura.
- `usuario`, `descuentoAdicional` y `montoGiftCard` del body **se ignoran**:
  en la factura figura el usuario logueado, y el monto es lo cobrado en la
  orden (sale de sus items).

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
El PDF de cada una sale por su `id` (endpoint de abajo).

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

### Nivel SIAT bajo nivel
Todo bajo `/facturacion`, `/cafc`, `/catalogos`, `/codigos`, `/paquetes`,
`/operaciones` — facturas manuales, listado, anular/revertir, contingencia,
paquetes, catálogos, CUIS/CUFD, puntos de venta. La mayoría lo usan también
**MANAGER y CASHIER**, limitados a su sucursal SIAT (y es lo único que usa
el staff de una sucursal "solo facturación"); CUIS/CUFD, puntos de venta y
crear/editar CAFC siguen siendo ADMIN + SUPERVISOR. Detalle endpoint por
endpoint en [02](02-roles-and-permissions.md) y
[10](10-siat-low-level.md).

### PDF de la factura
`GET /facturacion/facturacion/:id/representacion-grafica` devuelve el PDF
(`application/pdf`). Todos los roles: MANAGER/CASHIER solo los de su
sucursal SIAT (otra → `404`). Además el cliente recibe la factura por email
al momento de facturar.
