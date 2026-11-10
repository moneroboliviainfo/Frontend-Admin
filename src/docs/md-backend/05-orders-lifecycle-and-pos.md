# Ciclo de vida de la orden

## Estados (`OrderStatus`)

```
PENDING   → recién creada, esperando pago. Reserva stock, no lo descuenta.
SENT      → in-store: pago confirmado y entregado en el momento.
PAID      → online: pago confirmado, falta despachar.
PAID → SENT   (solo online, vía "cambiar estado" = marcar despachada)
PENDING/PAID/SENT → CANCELLED
PAID/SENT → CANCELLED_FOR_EDIT → (se crea una orden nueva) → la vieja pasa a COMPLETED_EDITION
PENDING vencida (sin pagar a tiempo) → EXPIRED   (perezoso, se detecta en la
                                                    próxima lectura, no hay cronjob)
EXPIRED → PAID   (solo si llega un pago con tarjeta aprobado después de vencer)
```

Puntos clave:
- **El stock se descuenta recién al confirmar el pago** (PENDING→SENT o
  PAID), nunca al crear la orden. Al crear solo se **reserva** (con
  expiración).
- **Cancelar** restaura el stock (revierte la reserva/descuento), no importa
  en qué estado estuviera (salvo `CANCELLED_FOR_EDIT`→`COMPLETED_EDITION`,
  que no es cancelación).
- **"Editar" una orden pagada nunca es un PATCH silencioso**: es
  cancelar-y-recrear. La orden vieja queda con status
  `CANCELLED_FOR_EDIT` → `COMPLETED_EDITION`, y se genera una **orden nueva**
  enlazada por `inherited_id`. Si el frontend muestra historial, mostrá la
  cadena completa, no solo el id que el usuario tiene a mano.

## `OrderType`: `in_store` | `online`

Determina qué descuentos aplican (los de la tienda física o los de la web
**de la sucursal de la venta**, ver [09](09-admin-catalog-crud.md)
§Descuentos), el `payment_type` permitido, y varía el flujo de confirmación.

## `PaymentType`: `qr` | `cash` | `card` | `card_online`

- `cash` y `card` (tienda física, datáfono) se tratan igual: confirmación
  **manual** por el cajero/manager, nunca automática.
- `qr` (BNB) y `card_online` (Cybersource) se confirman por **webhook**, el
  frontend no llama nada para "cerrar" el pago.

## Flujo POS completo

### 1. Login y apertura de caja
```
POST /auth/login                 → token de MANAGER o CASHIER
POST /dailyCash/open
{ "openingAmount": "200.00" }
```
**Cada cajero/encargado abre la suya** (una por usuario; varias por
sucursal). Al entrar al POS:
1. `GET /dailyCash/pending-count` — si devuelve una caja, su dueño tiene que
   registrar el conteo (`POST /dailyCash/:id/count`) antes de seguir: se cerró
   sola a la medianoche.
2. `GET /dailyCash/current` — si tiene una abierta, seguir; si da 404, pedir
   el monto de apertura y `POST /dailyCash/open`.

**Sin caja abierta no se puede vender ni confirmar**:
`409 No tienes una caja abierta: ábrela para vender`. Detalle en
[07-branches-daily-cash-billing.md](07-branches-daily-cash-billing.md).

### 2. Armar la venta
```
GET /billing/:ci                        (opcional: autocompletar datos del cliente)
POST /cart?type=in_store
POST /orders/reprice   { "items": "<jwt>", "type": "in_store", "branchId?": <la del cajero>, "branchTransferId?": <pedido> }
```

**Si la prenda no está en esta tienda** pero sí en otra: el cajero la
**pide** (`GET /variants/branch-stock/:variantId` → `POST /branch-transfers/requests`).
Dos opciones:
- **Sin cobro**: cuando la prenda llega, el cliente vuelve y se le hace una
  venta normal. Ver
  [11-central-warehouse-and-branch-transfers.md](11-central-warehouse-and-branch-transfers.md) §5.
- **Cobrando al pedir** (anticipo en efectivo, tarjeta o QR; no se factura):
  cotizar, cobrar y crear con nombre, teléfono y CI. Al retirar se cobra solo
  la diferencia. Ver [13-prepaid-branch-requests.md](13-prepaid-branch-requests.md).

**Si el carrito tiene una prenda de un pedido que espera a su cliente**
(`GET /branch-transfers?awaitingPickup=true&variantIds=...`), preguntá
"¿es el pedido #N de <cliente>?" y, si sí, mandá `branchTransferId` en el
reprice y en la creación. Sin eso, la unidad reservada no cuenta como
disponible y la venta falla por stock. Si el pedido se cobró al pedir, el
reprice devuelve `advanceApplied` y `amountDue`: **cobrá `amountDue`**, no
`total` ([13](13-prepaid-branch-requests.md) §6).

### 3. Crear la orden
```
POST /orders/in-store
{ "items": "<token>", "payment_type": "cash", "billing": {...}, "branchTransferId?": <pedido> }
→ Order { id, status: "pending", totalPrice, ... }
```

### 4. Confirmar el pago

**Efectivo/datáfono** — el cajero cobra y confirma a mano:
```
POST /orders/confirm/:id
→ Order { status: "sent" }   (stock recién se descuenta acá)
```
Solo funciona si la orden está `PENDING`, es `IN_STORE`, y `payment_type`
es `cash` o `card` (no `qr`). Si la orden es de otra sucursal, `404`.

**QR**:
```
POST /payments/generate-qr { "orderId": 1 }
→ mostrar QR al cliente, pollear /payments/verify/:id
```
La confirmación la hace el webhook de BNB solo — no hay paso manual.

### 5. Facturar (opcional, manual)
```
POST /orders/:orderId/facturar
{ branchId se resuelve solo — no lo mandes ...tipoFacturaDocumento, codigoDocumentoSector, codigoMoneda, tipoCambio, etc. }
```
Confirmar el shape exacto en Swagger (`FacturarOrderDto`) — trae bastantes
campos de catálogo SIAT (tipo de documento, moneda, tipo de cambio). Si la
orden ya tiene factura, o no es de la sucursal del usuario, falla — **salvo
que la factura actual esté ANULADA o RECHAZADA**: ahí el mismo endpoint
**refactura**, con los datos del cliente corregidos en el body si hace falta
(ver [07-branches-daily-cash-billing.md](07-branches-daily-cash-billing.md)).
**La factura PDF no vuelve en esta respuesta** — al cliente se le manda por
email si se indicó uno. No hay endpoint para reimprimir desde el POS
(decisión deliberada: si tu flujo necesita reimpresión física, avisá antes
de asumir que existe).

### 6. Cancelar una venta (si hace falta)
```
POST /orders/cancel/:id      → CANCELLED, restaura stock y reserva
```
Cualquier estado (`PENDING`, `PAID`, `SENT`) menos ya cancelada/completada.
Guarda quién y cuándo (`cancelledBy`, `cancelledAt`). Si la venta retiraba
un pedido entre sucursales, ese pedido vuelve a "esperando al cliente". Si
además el pedido se cobró al pedir, al cliente se le devuelve solo lo que
cobró esta venta (`totalPrice − advanceApplied`); el anticipo sigue en el
pedido. Para **corregir** una venta de retiro de un pedido cobrado usá
**editar** (paso 7), no cancelar: si el plazo ya venció, una venta nueva no
se puede enlazar y el cliente pierde el anticipo.

### 7. Editar una venta ya cerrada
```
POST /orders/cancel-for-edit/:id     → orden vieja pasa a CANCELLED_FOR_EDIT
PATCH /orders/:id
{ "items": "<jwt del carrito nuevo, ya repriceado>" }
→ se crea una Order NUEVA con los items nuevos, confirmada automáticamente
  (fuerza CASH+SENT), la vieja pasa a COMPLETED_EDITION
```
Dos pasos separados y obligatorios en ese orden — no hay un PATCH directo
sin pasar por `cancel-for-edit` primero. Los pedidos online con envío FedEx
**no se pueden editar**: `cancel-for-edit` los rechaza de entrada con
`400 Order N cannot be edited: it cannot be recreated for its type (e.g. FedEx shipping orders)`,
sin tocar la orden (antes fallaba recién en el `PATCH`, con la orden ya
trabada). Ocultá "editar" para esos pedidos.

### Despachar un pedido online (PAID → SENT)
```
PUT /orders/change-status/:id
{ "trackingCode?": "..." }
```
Marca como despachado un pedido online `PAID` de tu sucursal. Nacional: sin
body. FedEx: el `trackingCode` ya se generó solo al crear la orden, así que
tampoco hace falta mandarlo; si se manda, reemplaza al existente (corrección
manual). Guarda quién y cuándo (`sentBy`, `sentAt`). Hasta el 30/09/2026 este
endpoint fallaba siempre con `500`; ya funciona.

**FedEx con la guía cancelada** (`fedexShipmentCancelled: true` en una orden `paid`):
pasa si un pago con tarjeta llegó tarde, FedEx ya había cancelado el envío y no se
pudo crear otro. El `trackingCode` guardado no sirve. Sin un código distinto, este
endpoint responde `400 The FedEx shipment of this order was cancelled: a new tracking
code is required`. En la pantalla de despacho, mostrá una alerta ("Guía cancelada:
generar otra en FedEx") y pedí el código nuevo antes de despachar. Al guardarlo,
`fedexShipmentCancelled` vuelve a `false`.

**Qué buscar y dónde**: una venta web sale primero del depósito de la sucursal y
lo que falte, del piso. En `GET /orders` y `GET /orders/:id`, cada línea trae
`fromWarehouse` y `fromSalesFloor` ya resueltos. En la pantalla de despacho, por
línea: "Sacar `fromWarehouse` del depósito y `fromSalesFloor` del piso". Es lo
mismo que en un pedido entre tiendas; el cliente no recibe estos campos.

**`missingQuantity`** (casi siempre `0`): un pago con tarjeta que llegó con la orden
vencida se confirma aunque ya no haya stock. Esas unidades van dentro de
`fromSalesFloor` y dejan el piso en negativo, pero no están. Mostrá una alerta por
línea: "Faltan `missingQuantity`: conseguir con un pedido a otra tienda o a la
central". El piso vuelve a cuadrar cuando entra esa prenda; el campo no cambia
después, queda como registro. Si la prenda no existe en ningún lado, la devolución
y la anulación de la factura se hacen a mano.

### 8. Cerrar caja
```
GET /dailyCash/current                 → summary: totales en vivo por medio de pago
                                         + expenses: gastos y retiros de la caja
POST /dailyCash/:id/expenses           (opcional: gastos/retiros que falten)
POST /dailyCash/:id/close
{ "closingAmount": "1090.00", "closingNote?": "..." }   // solo el efectivo contado
```
Pantalla de cierre: mostrar del `summary` de `GET /dailyCash/current` el
total en **efectivo**, **tarjeta** y **QR**, los **gastos** y **retiros**
(`expenses`, `withdrawals`) y el **efectivo esperado en el cajón**
(`expectedCash`, ya descontados los gastos y retiros); dejar agregar los
gastos/retiros que falten antes de contar. El cajero cuenta solo el efectivo
y lo manda como `closingAmount`. La respuesta del cierre trae lo mismo
guardado (`cashAmount`, `cardAmount`, `qrAmount`, `expensesAmount`,
`withdrawalsAmount`, `expectedCashAmount`); sobrante/faltante =
`closingAmount − expectedCashAmount`.

**Gastos y retiros durante el turno**: cuando el cajero paga algo con la
plata del cajón (taxi, limpieza…) o la saca (depósito, entrega al
encargado), se registra en el momento con `POST /dailyCash/:id/expenses`
(gasto con categoría, retiro sin categoría). Detalle en
[07-branches-daily-cash-billing.md](07-branches-daily-cash-billing.md)
§Gastos y retiros.

Solo la caja propia. El `expectedAmount` (cuánto debería haber) se
**recalcula en vivo** al cerrar con lo que entró en **esa** caja, no es un
contador que se va incrementando — así que no hace falta que el frontend lo
vaya llevando. Es **apertura + ventas + anticipos de pedidos −
devoluciones − gastos − retiros**, con el desglose en `salesAmount`,
`advancesAmount`, `refundsAmount`, `expensesAmount` y `withdrawalsAmount`. Da `409` si queda algo a medio cobrar (ventas pendientes,
un QR de anticipo vivo); a la medianoche la caja se
cierra sola y queda el conteo pendiente (ver
[07-branches-daily-cash-billing.md](07-branches-daily-cash-billing.md)).

Confirmar a mano (`POST /orders/confirm/:id`) pasa la venta a la caja de
**quien confirma**, que también necesita la suya abierta.

## Consultar órdenes (MANAGER, CASHIER, ADMIN y SUPERVISOR)

```
GET /orders?limit=&page=&status=&type=&paymentType=&startDate=&endDate=&ci=&name=&orderId=
GET /orders/:id
GET /orders/export/exel        (A, S, M — genera un Excel, no JSON)
```
`ci`/`name`/`orderId` buscan por datos de facturación o por id (incluye
`inherited_id`, o sea encuentra también la orden nueva de una edición).
ADMIN y SUPERVISOR pueden ver cualquier sucursal (con `?branchId=`);
MANAGER/CASHIER solo la suya, sin poder elegir otra.

### Quién hizo qué (detalle de la orden)

`GET /orders/:id` (staff) trae, además de la orden:

| Campo | Qué es |
|---|---|
| `createdBy` | quién la creó (en tienda, el que cobra) |
| `editedBy` | quién la editó |
| `cancelledBy` | quién la canceló (`null` si la canceló el sistema o el cliente web) |
| `sentBy` | quién la marcó despachada (online) |
| `paidAt` | cuándo se pagó (confirmación manual en tienda, QR o tarjeta) |
| `cancelledAt` | cuándo se canceló (`CANCELLED` o `CANCELLED_FOR_EDIT`) |
| `sentAt` | cuándo pasó a `SENT` vía `change-status` |
| `facturasAnteriores` | facturas reemplazadas al refacturar (ver [07](07-branches-daily-cash-billing.md)) |

Los actores vienen como `{ id, name }` o `null`.

## Pagos por devolver (pagos en revisión)

> ⚠️ **Retirado el 31/10: esto no existe en el backend.** No construyas esta
> pantalla. Tarjeta ya tiene otra regla ([04](04-cart-checkout-payments.md)); el QR
> tardío sigue sin definir. Ver [14](14-changelog-2026-10.md).

A veces entra un pago que no se puede aplicar a su orden (QR o tarjeta). El dinero
se cobró, así que queda registrado para **devolverlo a mano**: la orden conserva
su estado, no descuenta stock ni se factura.

Un pago tardío sobre una orden online vencida **con stock** no llega acá: la orden
se confirma normal.

| `paymentReviewReason` | Qué pasó |
|---|---|
| `no_stock` | La orden online venció y ya no hay stock en la sucursal |
| `cancelled` | La orden se había cancelado antes del pago |
| `fedex_expired` | Orden FedEx vencida: su envío se cancela solo |
| `in_store_expired` | Venta en tienda vencida: el cajero ya la resolvió de otra forma |
| `amount_mismatch` | Tarjeta: se cobró un monto distinto al de la orden |

```
GET  /orders/payment-reviews?status=pending|resolved&branchId=&page=&limit=
GET  /orders/payment-reviews/:id
POST /orders/payment-reviews/:id/resolve   { "note": "Reembolso BNB, operación 123456" }
```

- **La lista** trae por defecto las pendientes, de la más nueva a la más vieja, con
  `meta.total` para un badge. Cada una trae `payment`, `billing`, `branch`,
  `customer`, `name_phone`, `email`, `paymentReviewAt`, `paymentReviewReason`,
  `paymentReviewResolvedAt`, `paymentReviewNote` y `paymentReviewResolvedBy`
  (`{ id, name }`). El detalle suma los `items`. Incluye órdenes que `GET /orders`
  no muestra, como vencidas y canceladas: usá estos endpoints, no `GET /orders/:id`
  (da `404` para una cancelada).
- **`resolve`** (solo ADMIN y SUPERVISOR) **no mueve dinero**: registra un
  reembolso ya hecho. La nota es obligatoria (vacía → `400`). Ya marcado → `409`;
  sin pago en revisión → `404`. Deshabilitá el botón mientras dure la request.
- **Pantalla sugerida**: lista "Pagos por devolver" con cliente, monto, medio de
  pago, motivo y botón "Marcar como devuelto" con nota. MANAGER y CASHIER la ven
  sin el botón, para poder responderle al cliente.

## Lado del cliente (storefront)

```
GET  /web-page/customers/order/:id                (ver una orden propia)
POST /web-page/customers/cancel/order/:id          (cancelar — solo si sigue PENDING)
```
Ver [08-customer-account.md](08-customer-account.md).
