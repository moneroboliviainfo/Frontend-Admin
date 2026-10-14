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

Determina qué descuentos aplican (`appliesInStore`/`appliesOnline`), el
`payment_type` permitido, y varía el flujo de confirmación.

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
Una caja abierta por sucursal a la vez — si ya hay una abierta,
`409 Conflict`. `GET /dailyCash/current` para saber si ya hay una abierta
antes de intentar abrir otra.

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

### 8. Cerrar caja
```
POST /dailyCash/:id/close
{ "closingAmount": "1350.00", "closingNote?": "..." }
```
El `expectedAmount` (cuánto debería haber) se **recalcula en vivo** al
cerrar, no es un contador que se va incrementando — así que no hace falta
que el frontend lo vaya llevando. Es **apertura + ventas + anticipos de
pedidos − devoluciones**, con el desglose en `salesAmount`,
`advancesAmount` y `refundsAmount` (ver
[07-branches-daily-cash-billing.md](07-branches-daily-cash-billing.md)).

## Consultar órdenes (cualquier rol de ventas, y ADMIN)

```
GET /orders?limit=&page=&status=&type=&paymentType=&startDate=&endDate=&ci=&name=&orderId=
GET /orders/:id
GET /orders/export/exel        (A, M — genera un Excel, no JSON)
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

## Lado del cliente (storefront)

```
GET  /web-page/customers/order/:id                (ver una orden propia)
POST /web-page/customers/cancel/order/:id          (cancelar — solo si sigue PENDING)
```
Ver [08-customer-account.md](08-customer-account.md).
