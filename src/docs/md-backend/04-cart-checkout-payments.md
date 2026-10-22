# Carrito, checkout y pagos

## La idea central: el carrito es un JWT

No hay una tabla "cart" en la DB. El "carrito" es un **JWT firmado que
contiene la lista de `{ variantId, quantity }`**. El frontend lo guarda
(localStorage/state) y lo va mandando de un endpoint a otro. El backend
**nunca confía en precios que mande el cliente** — todo precio/descuento/
stock se recalcula server-side en cada paso contra la DB actual.

```
POST /cart?type=in_store|online
{ "items": [{ "variantId": 2, "quantity": 3 }], "token": "<jwt anterior, opcional>" }

→ 200 {
  "cart": [ { "variantId": 2, "quantity": 3, "variant": {...producto con precio/descuento/stock...} } ],
  "token": "<jwt nuevo>"
}
```

- Si mandás `token` (carrito previo), el backend **fusiona** cantidades por
  `variantId` (suma) y devuelve un token nuevo con el carrito combinado — no
  hace falta armar la fusión en el frontend.
- `type` decide qué descuento se muestra (`appliesOnline` vs
  `appliesInStore`). **`type` default es `in_store`** por un hotfix
  temporal — mandalo siempre explícito, no confíes en el default.
- Esto es público, sin auth.

## Reprice — recalcular antes de pagar

```
POST /orders/reprice
{ "items": "<jwt del carrito>", "type": "in_store" | "online", "branchId?": 1, "branchTransferId?": 15 }

→ 200 {
  "items": [ { "variantId": 2, "quantity": 3, "unit_price": 150, "discountValue": 10, "totalPrice": "405.00" } ],
  "total": "405.00",
  "advanceApplied": "0.00",   // anticipo ya pagado (solo venta de retiro de un pedido cobrado)
  "amountDue": "405.00",      // lo que se cobra: total − advanceApplied
  "errorsStock": []
}
```

- `type` es **obligatorio** acá (a diferencia de `/cart`, no tiene default).
- `branchId` opcional: sin él, valida stock contra **todas** las sucursales
  sumadas; con él, contra una sola (lo usa el POS). El checkout online no lo
  manda.
- Si algún item no tiene stock suficiente, tira `400` con
  `errorsStock: [variantId, ...]` — mostrá qué producto falló, no un error
  genérico.
- **Pedidos entre sucursales (solo POS)**: lo reservado para un pedido que
  espera a su cliente no cuenta como disponible. Si la venta es la del
  cliente de ese pedido, mandá `branchTransferId` (junto con `branchId`) y
  esa unidad cuenta. Sin `branchId`, `branchTransferId` se ignora. Si falta
  stock porque la unidad está reservada, el mensaje lo dice (solo con
  `type: "in_store"`; al cliente web nunca se le nombran pedidos):
  `Insufficient stock for variants: [10] (variante 10 reservada para el pedido #15)`.
  Ver [11-central-warehouse-and-branch-transfers.md](11-central-warehouse-and-branch-transfers.md) §5.4.
- **Pedido cobrado al pedir**: con su `branchTransferId`, las prendas pagadas
  vuelven al precio congelado, `advanceApplied` trae el anticipo y
  `amountDue` lo que falta cobrar. **Mostrá siempre `amountDue` como "a
  cobrar"** (sin pedido cobrado es igual a `total`). Ver
  [13-prepaid-branch-requests.md](13-prepaid-branch-requests.md) §6.
- Usalo para la pantalla de "revisar carrito" antes de confirmar la compra —
  el precio final real es este, no el de `/cart`.
- `items` acepta también el `fedexShippingToken` (ver envío FedEx abajo): trae
  el carrito adentro.

## Envío internacional (FedEx) — cotizar

Para pedidos al exterior no se usa `shipment` (catálogo estático de envíos
nacionales): se cotiza en vivo contra FedEx.

```
POST /shipping/rates                 # público
{
  "items": "<jwt del carrito>",
  "recipient": {
    "personName": "John Doe", "emailAddress": "john@example.com", "phoneNumber": "15551234567",
    "address": {
      "streetLines": ["123 Main Street"], "cityName": "New York",
      "stateOrProvinceCode": "NY", "postalCode": "10007", "countryCode": "US",
      "residential": true
    }
  }
}

→ 200 {
  "success": true,
  "fedexShippingToken": "<jwt, vence en 30 min>",
  "services": [ { "serviceType": "FEDEX_INTERNATIONAL_PRIORITY", "serviceName": "...", "description": "...", "amountUSD": 80.5, "amountBOB": 556.26, "currency": "BOB" } ],
  "debugMetadata": { ... }
}
```
- El precio a cobrar es `amountBOB` (convertido con el tipo de cambio oficial
  del BCB).
- El `fedexShippingToken` **reemplaza al token del carrito** de ahí en
  adelante: se manda como `items` al crear la orden, junto con el
  `serviceType` elegido. Si vence (30 min), hay que volver a cotizar.

## Crear la orden

El `token` del carrito (repriceado o no — la creación repricea igual
internamente) se manda como `items` en el body de creación de orden. **El
stock recién se reserva acá** (no antes) — con lock pesimista, con una
ventana de expiración (`RESERVATION_EXPIRE_MINUTES`, ~25 min default). Si no
se confirma el pago en ese tiempo, la reserva expira y el stock se libera
solo (sin cronjob — se limpia perezosamente en la siguiente operación sobre
esa variante).

### Venta en tienda (POS) — requiere login MANAGER/CASHIER

```
POST /orders/in-store
Authorization: Bearer <token staff>
{
  "items": "<jwt del carrito>",
  "payment_type": "cash" | "card" | "qr",
  "billing": { "ci": "12345678", "codigoTipoDocumentoIdentidad": 1, "name?": "...", "email?": "...", "phone?": "...", "complemento?": "..." },
  "branchTransferId?": 15
}
```
No lleva `branchId` en el body — se resuelve por `@GetBranchId()` (la
sucursal del cajero/manager logueado). Ver
[02-roles-and-permissions.md](02-roles-and-permissions.md).

`branchTransferId` (opcional): el cliente retira con esta venta un **pedido
entre sucursales** que llegó a esta tienda. El backend lo marca retirado y
usa la unidad reservada para él. Errores y detalle en
[11-central-warehouse-and-branch-transfers.md](11-central-warehouse-and-branch-transfers.md) §5.4.
Si el pedido se cobró al pedir, la orden guarda `advanceApplied`: se factura
`totalPrice` y se cobra `totalPrice − advanceApplied`
([13](13-prepaid-branch-requests.md) §6).

Queda en estado `PENDING`. Según `payment_type`:
- **`cash` / `card`** (pago en el momento, confirmado a mano) → el
  cajero/manager llama después `POST /orders/confirm/:id` para pasarla a
  `SENT` y recién ahí se descuenta el stock real (no en la creación).
- **`qr`** → se genera un QR (ver más abajo) y la confirmación llega por
  webhook de BNB, sin que el POS tenga que llamar nada más.

### Venta online — requiere login customer (o guest)

```
POST /web-page/orders/online
Authorization: Bearer <token customer o guest>
{
  "items": "<jwt del carrito>",
  "name": "...", "phone": "...",
  "shipment": 1,        // id del método de envío nacional — OMITIR para FedEx
  "selectedServiceType?": "FEDEX_INTERNATIONAL_PRIORITY", // solo FedEx (requerido si no hay shipment)
  "address": 1,         // id de la dirección del customer (fiscal; para FedEx el destino real va en el token)
  "branchId": 1,         // sucursal elegida para facturar/despachar — SÍ va en el body acá
  "email?": "...",
  "payment_type?": "qr" | "card_online",   // default qr
  "billing": { ...igual que arriba... }
}
```
Queda `PENDING`. El pago (QR o Cybersource) la mueve a `PAID` vía webhook, y
al confirmarse **se factura sola** contra SIAT (fire-and-forget, no bloquea
la respuesta del webhook).

**Pedido FedEx** (sin `shipment`, con `items` = `fedexShippingToken` +
`selectedServiceType`): `shipment_price` es el `amountBOB` del servicio
elegido. Al crear la orden el backend **genera el envío real en FedEx** y la
orden ya vuelve con `trackingCode`. Si FedEx falla, la orden se cancela y la
respuesta es `400` ("No se pudo generar el envío FedEx...") — hay que
reintentar el checkout. Si la orden después se cancela o vence sin pagar, el
envío en FedEx se cancela solo. El correo de confirmación de pago muestra la
dirección de destino de FedEx y un botón de rastreo.

## Pago QR (BNB)

```
POST /payments/generate-qr          # público
{ "orderId": 1, "gloss?": "PAGO TIENDA MONERO" }
→ imagen/datos del QR para mostrar

POST /payments/qr/callback          # webhook de BNB, el frontend NO lo llama
GET  /payments/verify/:id           # público — pollear para saber si ya se pagó
```
El frontend genera el QR, lo muestra, y **pollea `GET /payments/verify/:id`**
(o similar) para detectar el pago — no hay push al cliente. El callback de
BNB no está autenticado (BNB no firma el payload); es un riesgo aceptado a
propósito, no un bug a reportar.

- **Venta de retiro de un pedido cobrado**: el QR va **solo por el saldo**
  (`totalPrice − advanceApplied`). Si el saldo es 0, la venta ni siquiera se
  crea con `qr` (`400 La venta no tiene saldo por cobrar…: créala en efectivo`):
  usá `cash` y `POST /orders/confirm/:id`.
- **Anticipo de un pedido entre sucursales** (no es una orden): se usa
  `POST /payments/generate-qr/request/:id` (MANAGER/CASHIER) y el pago se
  detecta polleando `GET /branch-transfers/:id`. Ver
  [13-prepaid-branch-requests.md](13-prepaid-branch-requests.md) §4.

## Pago con tarjeta (Cybersource / Linkser) — solo online

```
POST /payments/card/checkout-params     # público
{ "orderId": 1, "deviceFingerprintId": "...", "billing": {...datos exigidos por Cybersource...}, "cardFirst4?": "4111" }
→ parámetros para inicializar el widget/formulario de Cybersource
```
- El **monto y la moneda los calcula el backend** desde `order.totalPrice` —
  el frontend nunca los manda (evita pagar de menos).
- `cardFirst4` es opcional, solo para que la factura SIAT muestre los
  primeros 4 dígitos; no es dato sensible completo.
- Después de pagar en el widget de Cybersource, el navegador del cliente es
  redirigido a `POST /payments/card/callback` (Cybersource lo llama
  directamente, no el frontend) y de ahí el backend redirige al frontend a
  `.../checkout/order-confirmed?orderId=...` o a home si algo falló. **El
  frontend debe tener esa ruta lista para recibir el redirect.**
- Hay también un webhook servidor-a-servidor (`/payments/card/webhook`) que
  hace lo mismo de forma idempotente — no lo llama el frontend.

## Resumen del flujo online

```
GET /web-page/products, /web-page/discounts   (navegar catálogo)
        ↓
POST /cart (?type=online)                     (armar carrito → token)
        ↓
POST /orders/reprice { items, type: online }   (revisar totales antes de pagar)
        ↓
[internacional] POST /shipping/rates → fedexShippingToken + servicios
        ↓
POST /web-page/orders/online                   (crear orden PENDING, reserva stock)
        ↓
QR: generate-qr + poll verify/:id   |   Card: checkout-params + widget + redirect callback
        ↓
orden PAID → factura automática a SIAT (fire-and-forget)
```

## Resumen del flujo POS (in-store)

```
POST /auth/login                               (cajero/manager)
        ↓
POST /dailyCash/open                           (abrir caja, una vez por turno)
        ↓
GET /billing/:ci                               (buscar cliente por CI, opcional)
        ↓
POST /cart (?type=in_store) → reprice           (armar venta)
        ↓
GET /branch-transfers?awaitingPickup=true&variantIds=...
                                               (¿alguna prenda es de un pedido que espera?
                                                si el cajero confirma → branchTransferId
                                                en reprice y en la venta)
        ↓
POST /orders/in-store                          (crear orden PENDING)
        ↓
cash/card: POST /orders/confirm/:id             (confirma pago → SENT, descuenta stock)
qr:        generate-qr, el cliente escanea, webhook confirma solo
        ↓
POST /orders/:orderId/facturar (opcional/manual)
        ↓
POST /dailyCash/:id/close                       (cerrar caja al final del turno)
```
Ver el detalle de cada paso y los estados en
[05-orders-lifecycle-and-pos.md](05-orders-lifecycle-and-pos.md).
