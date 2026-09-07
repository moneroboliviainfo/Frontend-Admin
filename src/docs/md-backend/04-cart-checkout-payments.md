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
POST /orders/reprice/:token?type=in_store|online&branchId=1(opcional)

→ 200 {
  "items": [ { "variantId": 2, "quantity": 3, "unit_price": 150, "discountValue": 10, "totalPrice": "405.00" } ],
  "total": "405.00",
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
- Usalo para la pantalla de "revisar carrito" antes de confirmar la compra —
  el precio final real es este, no el de `/cart`.

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
  "billing": { "ci": "12345678", "codigoTipoDocumentoIdentidad": 1, "name?": "...", "email?": "...", "phone?": "...", "complemento?": "..." }
}
```
No lleva `branchId` en el body — se resuelve por `@GetBranchId()` (la
sucursal del cajero/manager logueado). Ver
[02-roles-and-permissions.md](02-roles-and-permissions.md).

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
  "shipment": 1,        // id del método de envío
  "address": 1,         // id de la dirección del customer
  "branchId": 1,         // sucursal elegida para facturar/despachar — SÍ va en el body acá
  "email?": "...",
  "payment_type?": "qr" | "card_online",   // default qr
  "billing": { ...igual que arriba... }
}
```
Queda `PENDING`. El pago (QR o Cybersource) la mueve a `PAID` vía webhook, y
al confirmarse **se factura sola** contra SIAT (fire-and-forget, no bloquea
la respuesta del webhook).

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
POST /orders/reprice/:token?type=online        (revisar totales antes de pagar)
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
