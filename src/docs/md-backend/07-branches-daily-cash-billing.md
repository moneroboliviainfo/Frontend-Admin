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

**Caja por usuario** (desde el 3/11/2026): cada CASHIER y cada MANAGER abre,
cobra en y cierra **su propia** caja — el encargado es un cajero más, no
cierra ni cuenta cajas ajenas. En una sucursal puede haber varias abiertas a
la vez; un usuario, una sola. ADMIN/SUPERVISOR no tienen caja (solo leen el
historial).

**Sin caja abierta no se cobra**: crear una venta en tienda, confirmarla,
cobrar un anticipo, generar su QR o devolverlo responden
`409 No tienes una caja abierta: ábrela para <acción>` (o
`409 Tu caja abierta (#N) es de otra sucursal: …`).

```
POST /dailyCash/open                                                (M, C)
{ "openingAmount": "200.00" }
→ DailyCash { id, status: "open", openedAt, openedBy: {id, name}, branch, ... }
  409 si ya tenés una abierta, o si tenés una caja cerrada automáticamente sin
  conteo (ver abajo)

GET /dailyCash/current                                              (M, C)
→ TU caja abierta (404 si no tenés), con `summary`: el resumen EN VIVO por
  medio de pago (ver abajo) — para mostrarlo ANTES de contar y cerrar

POST /dailyCash/:id/close                                           (M, C, solo la propia)
{ "closingAmount": "1090.00", "closingNote?": "Faltante de 10 Bs" }
  closingAmount = SOLO el efectivo contado en el cajón
→ DailyCash { status: "closed", cashAmount, cardAmount, qrAmount,
               expectedCashAmount, closingAmount, closedBy,
               salesAmount, advancesAmount, refundsAmount, expectedAmount, ... }
```

### Totales por medio de pago

Lo que ve el cajero al cerrar. Cada medio = ventas + anticipos − devoluciones
de esa caja (la tarjeta del POS y la online van juntas; las devoluciones son
siempre en efectivo):

| Campo (guardado al cerrar) | Qué es |
|---|---|
| `cashAmount` | total en **efectivo** |
| `cardAmount` | total con **tarjeta** |
| `qrAmount` | total por **QR** |
| `expectedCashAmount` | **efectivo que tiene que haber en el cajón** = apertura + `cashAmount` |
| `closingAmount` | lo que contó el cajero — **solo efectivo** |

**Sobrante / faltante = `closingAmount − expectedCashAmount`** (el front lo
calcula). La tarjeta y el QR no se cuentan en el cajón: se controlan contra
los vouchers / el banco. En cajas cerradas antes del 7/11/2026 estos campos
vienen `null` (ahí el conteo se comparaba con `expectedAmount`).

En la caja **abierta**, `GET /dailyCash/current` trae lo mismo calculado en
vivo, con el detalle por concepto:

```json
"summary": {
  "sales":    { "cash": "700.00", "card": "300.00", "qr": "150.00", "total": "1150.00" },
  "advances": { "cash": "80.00",  "card": "0.00",   "qr": "50.00",  "total": "130.00" },
  "refunds":  { "cash": "50.00",  "card": "0.00",   "qr": "0.00",   "total": "50.00" },
  "byMethod": { "cash": "730.00", "card": "300.00", "qr": "200.00", "total": "1230.00" },
  "expectedCash": "930.00",     // apertura (200) + byMethod.cash
  "expected": "1430.00"         // apertura + todo (= expectedAmount)
}
```

El resumen en vivo no incluye la plata que llegó tarde a la sucursal (un
pago QR/tarjeta cuya caja ya había cerrado): esa entra recién en el cierre,
así que el cierre puede traer algo más que el último `summary`.

**El cierre a mano se rechaza (`409`) si en la caja queda algo a medio
cobrar** — el mensaje dice qué y con qué número:
- ventas en tienda `PENDING` sin vencer (cobrarlas o cancelarlas);
- un QR de anticipo de pedido generado desde esta caja, sin pagar y sin
  vencer (esperar el pago o que venza).

`expectedAmount` se calcula **en el momento del cierre** con lo que entró en
**esta** caja, no es un contador que el frontend tenga que llevar:

**`expectedAmount` = apertura + `salesAmount` + `advancesAmount` − `refundsAmount`**

| Campo | Qué suma |
|---|---|
| `salesAmount` | ventas in-store vigentes de esta caja, por lo **cobrado en caja**: en la venta de retiro de un pedido cobrado, sin la parte del anticipo |
| `advancesAmount` | anticipos de pedidos cobrados en esta caja (un anticipo QR: en la caja de quien generó el QR) |
| `refundsAmount` | devoluciones de anticipos pagadas desde esta caja (siempre en efectivo) |

En qué caja entra cada cobro:
- **Venta en tienda**: en la de quien la crea. **Confirmarla a mano**
  (`POST /orders/confirm/:id`) la pasa a la caja de **quien confirma** (es
  quien recibe la plata). Las que se confirman solas (QR, tarjeta online)
  quedan en la de quien la creó.
- **Editar o cancelar** una venta es **corregir un error de registro** (no
  se cobra ni se devuelve plata): lo puede hacer cualquier cajero o
  encargado, sin caja abierta, y la corrección queda en **la caja de la
  venta original** (donde está la plata). Si esa caja sigue abierta, su
  esperado se corrige; si ya cerró, su cierre no cambia y el descuadre lo
  explica la corrección (`editedBy`/`cancelledBy` en la venta).
- **Anticipo / devolución** de un pedido: en la de quien cobra / devuelve.
- **Plata que llega con su caja ya cerrada** (un QR o tarjeta que se paga
  tarde, un anticipo QR pagado después del cierre): entra en el **próximo
  cierre de esa sucursal**, de cualquier cajero.

`expectedAmount` mezcla todos los medios: el conteo del cajón se compara con
`expectedCashAmount`, no con este. En cajas cerradas antes del 10/2026 los
tres campos del desglose vienen `null`.
Detalle de anticipos en [13-prepaid-branch-requests.md](13-prepaid-branch-requests.md).

> Una venta **editada** cuenta con el medio de pago de la venta **original**
> (la réplica de una edición se guarda como efectivo, pero se pagó como la
> original).

### Cierre automático a la medianoche y conteo pendiente

Una caja que sigue abierta a las **00:00 (hora de Bolivia)** se cierra sola:
`autoClosed: true`, `closedBy: null`, los totales calculados (`cashAmount`,
`cardAmount`, `qrAmount`, `expectedCashAmount`, `expectedAmount`…), pero
`closingAmount: null` — nadie contó la plata. Viene con
`countPending: true`. Su dueño **está obligado a registrar el conteo**: hasta
hacerlo no puede abrir otra caja (y sin caja no puede vender).

```
GET /dailyCash/pending-count                                        (M, C)
→ tu caja cerrada automáticamente que espera conteo, o null
  (mostrala al entrar al POS, antes de "Abrir caja")

POST /dailyCash/:id/count                                           (M, C, solo la propia)
{ "closingAmount": "1090.00", "closingNote?": "..." }   // solo el efectivo contado
  (en la pantalla, mostrar los totales por medio y expectedCashAmount de esa caja)
→ DailyCash { closingAmount, countedAt, countPending: false, ... }
  409 si esa caja no se cerró sola o ya se contó
```

### Historial

**Mis cajas** (cajero o encargado, el usuario sale de la sesión):

```
GET /dailyCash/mine?limit=&page=&status=open|closed                         (M, C)
→ { data: DailyCash[], meta } — solo las cajas del usuario logueado, con la
  misma información que el historial del admin (totales por medio de pago,
  desglose, conteo, autoClosed/countPending…)
```
No acepta `userId` ni `branchId` (mandarlos da `400`). ADMIN/SUPERVISOR no
tienen caja: `403`.

**Historial de la sucursal / de todas** (admin, supervisor, encargado):

```
GET /dailyCash?limit=&page=&status=open|closed&userId=&branchId=(solo A/S)   (A, S, M)
```
MANAGER siempre ve las de su sucursal; ADMIN/SUPERVISOR filtran con
`?branchId=` o ven todas. `?status=open` = las cajas abiertas ahora (una por
cajero); `?userId=` = las de un usuario. Cada caja trae `openedBy`/`closedBy`
como `{ id, name }`, `autoClosed`, `countedAt` y `countPending`.

No se puede **deshabilitar** a un usuario ni **cambiarlo de sucursal** con su
caja abierta: `PATCH /users/:id` → `409 … tiene una caja abierta (#N)`.

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
POST /orders/:orderId/facturar                (A, S, M, C)
POST /orders/:orderId/facturar-contingencia    (A, S, M, C)
```
Emite la factura para una orden específica, **siempre desde la sucursal de
la venta**. MANAGER/CASHIER solo facturan ventas de su sucursal (otra →
`403`); ADMIN/SUPERVISOR, cualquier venta, sin mandar `?branchId=` (no crean
ni cobran ventas, pero sí facturan). Falla si la orden ya tiene factura o no
tiene `billing`. Además:

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
- `branchId` del body **no hace falta y se ignora**: se factura desde la
  sucursal del usuario logueado.

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
