# Carrito, checkout y pagos

## La idea central: el carrito es un JWT

No hay una tabla "cart" en la DB. El "carrito" es un **JWT firmado que
contiene la lista de `{ variantId, quantity }`**. El frontend lo guarda
(localStorage/state) y lo va mandando de un endpoint a otro. El backend
**nunca confía en precios que mande el cliente** — todo precio/descuento/
stock se recalcula server-side en cada paso contra la DB actual.

```
POST /cart?type=in_store|online
{ "items": [{ "variantId": 2, "quantity": 3 }], "token": "<jwt anterior, opcional>", "branchId": 1 }

→ 200 {
  "cart": [ { "variantId": 2, "quantity": 3, "variant": {...variante con talla, producto y descuento...} } ],
  "token": "<jwt nuevo>"
}
```

- La respuesta **no trae stock** y `/cart` no lo valida: el stock se revisa en
  el reprice y al crear la orden.

- Si mandás `token` (carrito previo), el backend **fusiona** cantidades por
  `variantId` (suma) y devuelve un token nuevo con el carrito combinado — no
  hace falta armar la fusión en el frontend.
- `type` y `branchId` deciden qué descuento se muestra: el que aplica en la
  web (`online`) o en la tienda física (`in_store`) **de esa sucursal**
  (descuentos por sucursal, ver [09](09-admin-catalog-crud.md) §Descuentos).
  `branchId` = la sucursal elegida en la web, o la del cajero en el POS. Es
  opcional, pero sin él se muestra el descuento si aplica en ese canal de
  *alguna* sucursal. **`type` default es `in_store`** por un hotfix
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
- `branchId` es **obligatorio con `type: online`** (sin él → `400`): la sucursal
  elegida por el cliente, y valida contra su **piso + depósito**. Una sucursal que
  no vende por la web (no está en `GET /web-page/branches`) cuenta como sin stock:
  `400 Insufficient stock…`, también en la cotización FedEx. Con `in_store`
  el POS manda la suya y valida contra su piso.
- Si algún item no tiene stock suficiente, tira `400` con el mensaje
  `Insufficient stock for variants: [10,12]`. Los ids vienen **dentro del
  texto**, no en un campo aparte (`errorsStock` de la respuesta `200` siempre
  viene vacío): mostrá qué producto falló, no un error genérico.
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
  "branchId": 1,                     // sucursal elegida, obligatorio
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
  "services": [ {
    "serviceType": "FEDEX_INTERNATIONAL_PRIORITY", "serviceName": "...", "description": "...",
    "amountUSD": 80.5, "amountBOB": 556.26, "currency": "BOB",
    "commit": { "dateDetail": { "dayOfWeek": "...", "dayFormat": "..." } }   // o null
  } ],
  "debugMetadata": { ... }
}
```
- El precio a cobrar es `amountBOB` (convertido con el tipo de cambio oficial
  del BCB).
- El stock se revisa solo en la sucursal de `branchId`, piso + depósito. Si no
  alcanza → `400 Insufficient stock for variants: [10,12]`, sin cotizar con FedEx. Si el
  cliente cambia de sucursal, hay que volver a cotizar y mandar el mismo
  `branchId` al crear la orden.
- `commit` es la **fecha estimada de entrega**, tal como la manda FedEx. Es
  solo informativa y puede venir `null`: la pantalla tiene que funcionar sin
  ella. `dayOfWeek` y `dayFormat` son textos de FedEx: verificá su formato con
  una cotización real antes de parsearlos.
- Si un producto del carrito no tiene peso o empaque cargados, la cotización da
  `400 El producto "<nombre>" no tiene configurado weightGrams|unitsPerBox, no
  se puede cotizar el envío` (se cargan en el panel, ver
  [09](09-admin-catalog-crud.md)).
- El `fedexShippingToken` **reemplaza al token del carrito** de ahí en
  adelante: se manda como `items` al crear la orden, junto con el
  `serviceType` elegido. Si vence (30 min), hay que volver a cotizar.

## Crear la orden

El `token` del carrito (repriceado o no — la creación repricea igual
internamente) se manda como `items` en el body de creación de orden. **El
stock recién se reserva acá** (no antes) — con lock pesimista, con una
ventana de expiración (`RESERVATION_EXPIRE_MINUTES`, 10 minutos en producción;
usá `expiresAt` de la orden, no un número fijo). Con tarjeta se renueva al pedir
`checkout-params`. Si no
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
la respuesta del webhook), desde la sucursal del `branchId`.

- **La sucursal la elige el cliente al entrar a la web** (hay una por defecto,
  ver [03](03-storefront-catalog.md) "Sucursales") y es la misma en todo el
  flujo: se manda en el reprice y aquí como `branchId`. De esa sucursal sale la
  factura y de su **depósito y piso** se valida y descuenta el stock: primero el
  depósito y lo que falte, del piso. El cliente no ve ese reparto; el staff sí
  ([05](05-orders-lifecycle-and-pos.md) "Despachar un pedido online").
- El detalle del catálogo muestra el stock de esa sucursal si le mandás
  `?branchId=` ([03](03-storefront-catalog.md)). Aun así, la creación puede
  responder `400 Insufficient stock for variant ID: N` si otro cliente se llevó
  la última unidad: manejá ese error.
- Si el cliente **cambia de sucursal con productos en el carrito**, volvé a
  llamar al reprice con la nueva: lo que no haya ahí da `400`.
- Con un cliente con cuenta, `name` y `phone` **actualizan su perfil** al crear
  la orden. Con un guest no se guardan en el cliente.
- `address` es **obligatorio también para un guest**: creá la dirección antes
  con `POST /addresses` usando **el mismo token** con el que creás la orden, y
  mandá ese `id`. Una dirección que no existe o que no es del comprador (o de esa
  sesión de invitado) da `404 Address not found`, sin crear la orden. Para un
  guest, mandá también `email`: el correo de confirmación de pago va ahí.
- `shipment` tiene que **corresponder al `place` de la dirección**: ofrecé solo
  los `shipments` de ese lugar (`GET /web-page/places`). Si es de otro lugar, o
  la dirección no tiene `place`, da `400 El envío <nombre> no corresponde al
  lugar de la dirección`. Deshabilitado → `400`; inexistente → `404`. Un envío
  sin lugar se acepta con cualquier dirección. No aplica a FedEx (sin `shipment`).

**Pedido FedEx** (sin `shipment`, con `items` = `fedexShippingToken` +
`selectedServiceType`): `shipment_price` es el `amountBOB` del servicio
elegido. Al crear la orden el backend **genera el envío real en FedEx** y la
orden ya vuelve con `trackingCode`. Si FedEx falla, la orden se cancela y la
respuesta es `400` ("No se pudo generar el envío FedEx...") — hay que
reintentar el checkout. Si la orden después se cancela o vence sin pagar, el
envío en FedEx se cancela solo; si aun así llega un pago con tarjeta, el backend
crea otro envío (el `trackingCode` cambia). El correo de confirmación de pago muestra la
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
(`:id` = id de la orden) para detectar el pago — no hay push al cliente.
`verify` responde `true` si ya se pagó y `false` si todavía no; una orden
vencida, cancelada o que no es QR da `404`: dejá de pollear, dejá de mostrar el QR
y avisá: "La orden venció. Si ya pagaste, contactanos". **El QR vence 1 minuto antes
que la orden** y, al cancelar una orden sin pagar, el backend lo anula en BNB. Si
aun así entra un pago sobre una orden vencida (lo cobró el banco justo al límite o
la anulación falló), la compra **no se confirma ni queda registrada**: se resuelve a
mano.
`generate-qr` también da `404` si la orden no está `PENDING`, le queda 1 minuto o
menos, o no es QR. El callback de
BNB es público (BNB no firma el payload), pero el backend no le cree a
ciegas: solo confirma el pago si el `QRId` es uno generado para esa orden
(o pedido) con `generate-qr` y BNB lo informa como pagado al consultarlo.
Un callback armado a mano no confirma nada. Nada que hacer en el front.

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
→ { access_key, profile_id, transaction_uuid, signed_field_names, unsigned_field_names,
    signed_date_time, amount, currency, reference_number, ..., signature }
```
- **Qué hacer con la respuesta:** enviá por `POST` todos esos campos sin cambiarlos,
  más los de la tarjeta (`card_number`, `card_expiry_date`, `card_cvn`, `card_type`),
  directo a la URL de pago de Cybersource. Esa URL **no** viene en la respuesta. Los
  datos de la tarjeta nunca pasan por el backend. Cambiar un campo firmado invalida
  la firma.
- **Pedilos al hacer clic en "Pagar" y enviá el formulario a Cybersource enseguida**,
  no al entrar a la pantalla de pago. Cybersource no tiene un vencimiento como el
  del QR: este llamado es lo último que controla el backend antes del cobro. Por eso
  deja a la orden y su reserva al menos 10 minutos más, con un tope de 2 veces la
  vida de la orden. No reutilices parámetros de un intento anterior.
- `409`: por ese tope quedan menos de 5 minutos, no se firma. Mostrá "Se agotó el
  tiempo para pagar" y volvé a armar la compra. `404`: la orden venció o ya no está
  `PENDING`.
- El **monto y la moneda los calcula el backend** desde `order.totalPrice` —
  el frontend nunca los manda (evita pagar de menos).
- `cardFirst4` es opcional, solo para que la factura SIAT muestre los
  primeros 4 dígitos; no es dato sensible completo.
- Después de pagar en Cybersource, el navegador del cliente es
  redirigido a `POST /payments/card/callback` (Cybersource lo llama
  directamente, no el frontend) y de ahí el backend redirige al frontend a
  `<FRONTEND_URL>/w/checkout/order-confirmed?orderId=...&paymentStatus=...`, o a
  home si no se pudo validar el retorno. **El frontend debe tener esa ruta (con el
  prefijo `/w`) y leer `paymentStatus`**: la ruta es la misma en los tres casos.

  | `paymentStatus` | Qué pasó | Qué mostrar |
  |---|---|---|
  | `confirmed` | Pago aplicado a la orden | Compra confirmada |
  | `rejected` | El banco no aprobó el pago | No se cobró; volver a intentar mientras la orden no venza |
  | `review` | Se cobró, pero la orden no se confirmó (estaba cancelada o el monto no coincide) | "Recibimos tu pago, pero no pudimos confirmar la compra. Contactanos con tu número de orden" |

  El parámetro es solo para elegir el mensaje, porque cualquiera puede escribir
  esa URL: para mostrar los datos de la compra, consultá la orden.
- **Un pago aprobado que llega con la orden vencida se confirma igual** (`confirmed`,
  la orden pasa de `expired` a `paid`), aunque no quede stock: el dinero ya se cobró.
  El staff consigue la prenda ([05](05-orders-lifecycle-and-pos.md) "Despachar un
  pedido online"). El cliente no ve ninguna diferencia.
- Hay también un webhook servidor-a-servidor (`/payments/card/webhook`) que
  hace lo mismo de forma idempotente — no lo llama el frontend.

## Resumen del flujo online

```
GET /web-page/branches                        (elegir sucursal; hay una por defecto)
        ↓
GET /web-page/products, /web-page/discounts   (navegar catálogo)
        ↓
POST /cart (?type=online)                     (armar carrito → token)
        ↓
POST /orders/reprice { items, type: online, branchId }   (revisar totales antes de pagar)
        ↓
[internacional] POST /shipping/rates → fedexShippingToken + servicios
        ↓
POST /web-page/orders/online { ..., branchId } (crear orden PENDING, reserva stock)
        ↓
QR: generate-qr + poll verify/:id   |   Card: checkout-params + POST a Cybersource + redirect callback
        ↓
orden PAID → factura automática a SIAT (fire-and-forget)
```

## Resumen del flujo POS (in-store)

```
POST /auth/login                               (cajero/manager)
        ↓
GET /dailyCash/pending-count                   (¿conteo pendiente de una caja que se cerró sola?
                                                → gastos/retiros olvidados con
                                                  POST /dailyCash/:id/expenses, luego
                                                  POST /dailyCash/:id/count antes de seguir)
        ↓
GET /dailyCash/current → 404 → POST /dailyCash/open
                                               (abrir SU caja: una por cajero; sin caja abierta
                                                vender y confirmar dan 409)
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
cash/card: POST /orders/confirm/:id             (confirma pago → SENT, descuenta stock;
                                                la venta pasa a la caja de quien confirma)
qr:        generate-qr, el cliente escanea, webhook confirma solo
        ↓
POST /orders/:orderId/facturar (opcional/manual)
        ↓
POST /dailyCash/:id/close                       (cerrar SU caja al final del turno; si se
                                                olvida, se cierra sola a las 00:00)
```
Ver el detalle de cada paso y los estados en
[05-orders-lifecycle-and-pos.md](05-orders-lifecycle-and-pos.md).
