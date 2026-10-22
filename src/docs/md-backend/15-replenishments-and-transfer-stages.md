# Reposiciones y etapas de los traslados

Dos cosas nuevas sobre `/branch-transfers` (ver
[11-central-warehouse-and-branch-transfers.md](11-central-warehouse-and-branch-transfers.md)):

1. **Reposiciones**: una tienda le **pide** mercadería a la bodega principal.
   Hasta ahora un envío solo nacía cuando la central decidía mandarlo.
2. **Etapa y acciones calculadas por el backend** (`stage`, `stageLabel`,
   `allowedActions`) en **todos** los traslados: el front ya no tiene que
   deducir qué mostrar ni qué botones habilitar a partir de `status`, plazos,
   plata y quién mira.

Todas las rutas van bajo `/api` (omitido acá). Confirmá los shapes en Swagger
(`/api/docs`, tag *Branch Transfers*).

---

## 1. Reposiciones

### 1.1 La idea

- La tienda pide **solo qué variantes** necesita, **sin cantidad**. Cuánto se
  manda de cada una lo decide la central al atenderla.
- **No hace falta que haya stock en la central** para pedir: la reposición
  queda esperando hasta que la central la atienda.
- Cada tienda tiene **una sola reposición abierta** a la vez. Pedir de nuevo
  **agrega** las variantes a la que ya está abierta (las que ya estaban se
  ignoran). Funciona como un "carrito de reposición".
- Internamente es un envío de la central (`type: "central_dispatch"`) con
  **`replenishment: true`**. Una vez atendida, sigue **exactamente** el
  flujo de un envío: recibir (entra al **depósito** de la tienda), marcar
  perdido, revisar faltantes.

```
TIENDA (MANAGER/CASHIER)                         CENTRAL (ADMIN/SUPERVISOR)
POST /branch-transfers/replenishments
  → status "pending_dispatch"  (no mueve stock)
  ↺ agregar variantes / quitar variantes
  ↺ anular                                       ve "Por atender" (replenishmentsPending)
                                                 POST /branch-transfers/replenishments/:id/dispatch
                                                   ├─ manda algo → "in_transit" (sale de la bodega ahora)
                                                   └─ todo en 0  → "not_found" (rechazada, nota obligatoria)
POST /branch-transfers/receive/:id   { ..., "location?": "sales_floor" }
  → "received", entra al DEPÓSITO de la tienda (por defecto)
    o directo al PISO con "location": "sales_floor" (vendible al instante)
POST /stock-transfers (warehouse_to_floor) solo si entró al depósito
```

### 1.2 Pedir (o agregar variantes)

```
POST /branch-transfers/replenishments                  (MANAGER, CASHIER)
{
  "variantIds": [12, 13, 40],
  "note?": "Se acabaron las M y L"
}
→ 201 BranchTransfer   (la reposición abierta de la tienda, con todas sus líneas)
```

- Si la tienda **no tiene** reposición abierta, se crea. Si **ya tiene**, se
  le agregan las variantes que no estén; las repetidas se ignoran (no es
  error).
- `note` se **agrega** a la nota existente en una línea nueva (no la
  reemplaza).
- Cada línea nueva tiene **`quantity: null`** (no hay cantidad pedida).
- `requestedBy` es quien **abrió** la reposición; si otro agrega variantes
  después, no queda registrado quién.

Errores:
- `400` si `variantIds` está vacío, trae repetidos o algo que no es un entero
  positivo.
- `404 Variante(s) no encontrada(s): 12, 99` (no existe o está borrada).
- `403` para ADMIN/SUPERVISOR: piden las tiendas, la central atiende.

Respuesta (la tienda la ve así mientras espera):

```jsonc
{
  "id": 57,
  "type": "central_dispatch",
  "replenishment": true,
  "status": "pending_dispatch",
  "stage": "awaiting_central",
  "stageLabel": "Esperando a la central",
  "allowedActions": ["addVariants", "removeVariant", "cancel"],
  "pendingReview": false,
  "note": "Se acabaron las M y L\nTambién el jean 32",   // las notas se suman, una por línea
  "sourceBranchId": 1,  "sourceBranch": { "id": 1, "name": "Bodega principal" },
  "destinationBranchId": 3, "destinationBranch": { "id": 3, "name": "Tienda Sur" },
  "requestedBy": { "id": 7, "name": "cajeroA" }, "requestedAt": "2026-10-19T14:02:11.000Z",
  "dispatchedBy": null, "dispatchedAt": null,
  "notFoundNote": null,
  "items": [
    {
      "id": 31, "variantId": 12,
      "variant": { "id": 12, "size": { "id": 2, "name": "M" },
                   "productColor": { "id": 5, "product": { "id": 1, "name": "Polera" },
                                     "color": { "id": 3, "name": "Negro", "code": "#000" } } },
      "quantity": null, "dispatchedQuantity": null, "receivedQuantity": null
    }
  ]
  // + el resto de los campos de un traslado (ver 11 §6), en null
}
```

La central ve **la misma** reposición con `stage: "to_attend"`,
`stageLabel: "Por atender"` y `allowedActions: ["attend"]` — la central no
la anula: si no la va a mandar, la **rechaza** al atenderla (todo en 0, ver
§1.4 y §1.5).

### 1.3 Quitar una variante

```
DELETE /branch-transfers/replenishments/:id/items/:itemId     (MANAGER, CASHIER)
→ 200 BranchTransfer
```

- `itemId` es el `id` de la línea (`items[].id`), **no** el `variantId`.
- Solo mientras está pendiente (`409 No se puede quitar variantes de la
  reposición: el traslado #N ya fue despachado`, etc.).
- Si era **la última**, la reposición queda **anulada** (`cancelled`, con
  `cancelNote: "Se quitó la última variante de la reposición"`), no vacía.
- Otra tienda, o un id que no es reposición → `404`.

### 1.4 Atender o rechazar (la central)

**Para armar la pantalla** la central necesita, por línea, cuánto hay en la
bodega. El detalle de la reposición **no** trae el stock: pedilo por color
de producto (cada línea trae `variant.productColor.id`) con
`GET /variants/:productColorId?branchId=<destinationBranchId>` — el
`branchId` es **obligatorio** para ADMIN/SUPERVISOR (sin él, `403`). Usá la
tienda destino: cada talla trae `centralWarehouseStock` (lo que hay en la
bodega, sea cual sea la sucursal) y además lo que la tienda ya tiene
(`availableStock`, `warehouseStock`), útil para decidir cuánto mandar.
Agrupá las líneas por `productColor.id` para hacer una llamada por color, no
por línea. Ofrecé como máximo de cada línea su `centralWarehouseStock`.

```
POST /branch-transfers/replenishments/:id/dispatch      (ADMIN, SUPERVISOR)
{
  "items": [
    { "transferItemId": 31, "quantity": 6 },
    { "transferItemId": 32, "quantity": 0 },
    { "transferItemId": 33, "quantity": 10 }
  ],
  "note?": "Las L no había"
}
→ 201 BranchTransfer   (ya en "in_transit" o "not_found", con la vista de la central)
```

- Hay que mandar **todas las líneas**, cada una con su cantidad (≥ 0).
  `0` = esa variante no se manda.
- **Alguna línea > 0** → `in_transit`. El stock sale del depósito de la
  bodega **en este momento** (al pedir no se movió nada). `note` es opcional.
- **Todas en 0** → **rechazada**: `status: "not_found"`, `note`
  **obligatoria**.
- La nota de la central queda en **`notFoundNote`** (en una reposición ese
  campo es "nota de la central", no "no encontrado"). `notFoundBy` /
  `notFoundAt` solo se llenan si la rechazó.
- Lo que no se manda **no es un faltante**: una reposición nunca queda
  "por revisar" por eso.

Errores:
- `400 Faltan las líneas: 34` — la tienda **agregó** una variante después de
  que abriste la pantalla. Recargá el detalle y volvé a mandar.
- `400 La línea 31 no es de este traslado...` — la tienda **quitó** esa
  variante. Recargá.
- `400 Stock insuficiente en la bodega principal para la variante 12: disponible 4, solicitado 6` — no se hace parcial: bajá esa cantidad.
- `400 No se manda nada (se rechaza la reposición): la nota es obligatoria`.
- `409 No se puede atender la reposición: el traslado #N fue anulado` — la
  tienda la anuló mientras tanto.
- `404 Reposición #N no encontrada` — el id es un envío normal o un pedido.
- `404 Variant ID N not found` — una variante se borró mientras la
  reposición esperaba: mandala en `0`.

### 1.5 Anular

`POST /branch-transfers/cancel/:id` (el mismo de siempre). Para reposiciones:

| Estado | La tienda que la pidió (M/C) | ADMIN / SUPERVISOR |
|---|---|---|
| `pending_dispatch` | ✅ (no mueve stock) | ❌ `409` — se **rechaza** al atenderla |
| `in_transit` | ❌ `409` | ✅ vuelve a la bodega **lo que se despachó** (nota obligatoria) |

Para **rechazar** una reposición, la central usa `dispatch` con todo en 0
(queda `not_found` = "Rechazada", nota obligatoria) — `cancel` sobre una
reposición pendiente da `409`. Así "la central la rechazó" y "la tienda la
anuló" nunca se confunden.

Si la tienda se **desactivó** mientras la reposición esperaba, atenderla
mandando algo da `409 ... está inactiva`: se rechaza (todo en 0).

### 1.6 Recibir, perdido, faltantes

Igual que un envío normal ([11 §3 y §4](11-central-warehouse-and-branch-transfers.md)):
se reciben **solo las líneas que salieron** (`dispatchedQuantity > 0`).
**Todo** entra a un mismo lugar, que elige la tienda con `location`: depósito
(por defecto) o directo al piso (`"sales_floor"`). Como la tienda suele pedir
reposición porque le falta en el piso, lo normal es ofrecer "Recibir al piso"
como opción principal. Para repartir, recibí todo en un lugar y mové el resto
con `/stock-transfers`.

En el kardex y el Excel, una reposición se ve igual que un envío: salida
`envio_bodega` ("Envío desde bodega") en la bodega al atenderla, `recepcion`
en la tienda al recibirla, `envio_anulado` si se anula en camino (ver
[11 §8](11-central-warehouse-and-branch-transfers.md)). Mientras está
pendiente o si se rechaza, no aparece en el kardex (no movió stock).

### 1.7 Una sola abierta: casos raros

- Dos cajeros piden a la vez → terminan en la **misma** reposición.
- La tienda agrega variantes **mientras** la central la está atendiendo →
  como ya no está pendiente, se crea una **reposición nueva** con esas
  variantes.

---

## 2. Marca "ya se pidió reposición" en las variantes

Todas las respuestas de stock del panel traen, por variante:

```jsonc
{ "id": 12, "availableStock": 0, "warehouseStock": 0, "centralWarehouseStock": 40,
  "inTransitStock": 0, "pendingReplenishment": true }
```

| Dónde | `pendingReplenishment` |
|---|---|
| `GET /variants`, `GET /variants/:id` (con la sucursal) | la variante está en la reposición **pendiente de esa sucursal** |
| `GET /products/:id`, `GET /outfits/:id` (vista general, sin sucursal) | está en la reposición pendiente de **alguna** tienda |
| `GET /variants/branch-stock/...` | un `pendingReplenishment` **por tienda** (para la central al armar un envío) |
| storefront (`web-page/*`) | **no viene** |

- Es un **sí/no**, no una cantidad (las reposiciones no tienen cantidad).
- Se calcula al consultar: **desaparece sola** cuando la reposición se
  atiende (pasa a `inTransitStock`), se rechaza o se anula.
- No se actualiza sola en pantalla: si otro cajero pidió hace un momento, la
  pantalla muestra lo viejo hasta recargar. Como pedir una variante repetida
  **no es error** (se ignora), eso no rompe nada.
- Para abrir la reposición: `GET /branch-transfers?replenishment=true&status=pending_dispatch`.

---

## 3. Consultas

### Filtro nuevo

```
GET /branch-transfers?replenishment=true|false
```

`true` = solo reposiciones; `false` = sin reposiciones; omitido = todo. Se
combina con los demás filtros:

| Pantalla | Query |
|---|---|
| Central: "Reposiciones por atender" | `replenishment=true&status=pending_dispatch` |
| Tienda: "Mi reposición abierta" | `replenishment=true&status=pending_dispatch` (0 o 1 resultado) |
| Tienda: historial de reposiciones | `replenishment=true` |
| Envíos que mandó la central por su cuenta | `type=central_dispatch&replenishment=false` |
| Todo lo que llega de la central | `type=central_dispatch` |

### `pending-count`

```
→ { "toDispatch": 1, "replenishmentsPending": 1, "toReceive": 2, "inTransit": 0,
    "pendingReview": 1, "awaitingPickup": 3, "pendingRefunds": 0 }
```

| Campo | Cambio |
|---|---|
| `replenishmentsPending` | **nuevo**. Tienda: `1` si tiene su reposición abierta, si no `0`. Central (sin `branchId`): cuántas tiendas esperan ser atendidas |
| `toDispatch` | ya **no** cuenta reposiciones (antes, sin `branchId`, contaba todo lo `pending_dispatch`). Para una tienda no cambia nada |
| `toReceive` | incluye las reposiciones atendidas en camino a la tienda (como los envíos) |
| `awaitingPickup` | ya no cuenta pedidos recibidos **sin ninguna prenda** (llegó todo en 0) |

**Contador de la tienda** (lo que requiere acción): `toDispatch + toReceive +
awaitingPickup + pendingRefunds`. **No** sumes `inTransit` (informativo) ni
`pendingReview` (solo lo resuelve la central). `replenishmentsPending` en la
tienda tampoco es una acción (espera a la central): mostralo como estado.

**Contador de la central**: `replenishmentsPending + pendingReview`.

### Forma: lo que cambia en cada traslado

```jsonc
{
  "replenishment": true,               // nuevo; false en envíos normales y pedidos
  "notFoundNote": "Las L no había",    // en una reposición = nota de la central
  "items": [
    { "id": 31, "variantId": 12,
      "quantity": null,                // ⚠️ null en reposiciones (no hay cantidad pedida)
      "dispatchedQuantity": 6,         // lo que mandó la central (null = no atendida)
      "receivedQuantity": null }
  ],
  // nuevos en TODOS los traslados (sección 4):
  "stage": "to_receive",
  "stageLabel": "Por recibir",
  "allowedActions": ["receive"],
  "pendingReview": false
}
```

En una reposición, para mostrar la línea usá `dispatchedQuantity` ("mandado"),
no `quantity`. No calcules "no encontrado" (`quantity − dispatchedQuantity`)
en reposiciones.

---

## 4. Etapa y acciones (`stage`, `stageLabel`, `allowedActions`)

Cada traslado — en `GET /branch-transfers`, `GET /branch-transfers/:id` **y en
la respuesta de cada acción** (crear, despachar, recibir, anular…) — trae:

| Campo | Qué es |
|---|---|
| `stage` | etapa estable (para lógica y colores) |
| `stageLabel` | el texto a mostrar, en español |
| `allowedActions` | los botones a mostrar **ahora**, para **quien mira** |
| `pendingReview` | faltantes por revisar ya revisables (badge "Por revisar") |

**Quien mira** = la sucursal del usuario (MANAGER/CASHIER) o la **central**
(ADMIN/SUPERVISOR). Un admin que filtra `?branchId=5` sigue viendo las
acciones de la central (no puede recibir ni despachar por la tienda 5).

**Regla para el front**: dibujá `stageLabel` y un botón por cada acción de
`allowedActions`. No calcules estados, plazos ni permisos por tu cuenta. El
backend igual valida cada acción (si la pantalla quedó vieja, responde
`409`/`400`: recargá).

### 4.1 Acciones → endpoint

| Acción | Endpoint / qué hace el front |
|---|---|
| `dispatch` | `POST /branch-transfers/dispatch/:id` |
| `attend` | `POST /branch-transfers/replenishments/:id/dispatch` (atender o rechazar) |
| `receive` | `POST /branch-transfers/receive/:id` |
| `cancel` | `POST /branch-transfers/cancel/:id` |
| `markLost` | `POST /branch-transfers/mark-lost/:id` |
| `review` | `POST /branch-transfers/review/:id` |
| `refund` | `POST /branch-transfers/requests/:id/refund` (caja abierta) |
| `generateQr` | `POST /payments/generate-qr/request/:id` |
| `pickupInPos` | abrir el POS con este `branchTransferId` (venta de retiro) |
| `markNotPickedUp` | `POST /branch-transfers/pickup/:id` con `status: "not_picked_up"` |
| `linkPickupSale` | `POST /branch-transfers/pickup/:id` con `status: "picked_up"` + `orderId` |
| `addVariants` | `POST /branch-transfers/replenishments` |
| `removeVariant` | `DELETE /branch-transfers/replenishments/:id/items/:itemId` (por línea) |

### 4.2 Envío de la central (`central_dispatch`, `replenishment: false`)

| `status` | Tienda destino | Central |
|---|---|---|
| `in_transit` | `to_receive` · Por recibir · `[receive]` | `in_transit` · En camino · `[cancel, markLost]` |
| `received` | `received` · Recibido | `received` · Recibido |
| `cancelled` | `cancelled` · Anulado | ídem |
| `lost` | `lost` · Perdido | ídem |

### 4.3 Reposición (`central_dispatch`, `replenishment: true`)

| `status` | Tienda que la pidió | Central |
|---|---|---|
| `pending_dispatch` | `awaiting_central` · Esperando a la central · `[addVariants, removeVariant, cancel]` | `to_attend` · Por atender · `[attend]` |
| `in_transit` | `to_receive` · Por recibir · `[receive]` | `in_transit` · En camino · `[cancel, markLost]` |
| `not_found` | `rejected` · Rechazada | ídem |
| `received` / `cancelled` / `lost` | como el envío | ídem |

### 4.4 Pedido entre sucursales (`branch_request`)

A = tienda que pidió (destino), B = tienda que despacha (origen).

| Situación | A | B | Central |
|---|---|---|---|
| `pending_payment`, QR vigente | `awaiting_payment` · Esperando pago QR · `[generateQr, cancel]` | (no lo ve) | `awaiting_payment` · `[cancel]` |
| `pending_payment`, QR vencido | `payment_expired` · QR vencido · `[generateQr, cancel]` | (no lo ve) | `payment_expired` · `[cancel]` |
| `pending_dispatch` | `awaiting_dispatch` · Esperando despacho · `[cancel]` | `to_dispatch` · Por despachar · `[dispatch]` | `awaiting_dispatch` · `[cancel]` |
| `in_transit` | `to_receive` · Por recibir · `[receive]` | `in_transit` · En camino | `in_transit` · `[markLost]` |
| `not_found` | `not_found` · No encontrado | ídem | ídem |
| `received`, esperando al cliente | `awaiting_customer` · Esperando al cliente · `[pickupInPos, markNotPickedUp, linkPickupSale*]` | `delivered` · Entregado | `awaiting_customer` |
| `received`, venta de retiro vigente | `picked_up` · Retirado | `delivered` | `picked_up` |
| `received`, marcado no retirado | `not_picked_up` · No retirado | `delivered` | `not_picked_up` |
| `received`, venció el plazo sin retiro | `pickup_expired` · Plazo vencido · sin cobro: `[pickupInPos, markNotPickedUp, linkPickupSale]`; cobrado: ninguna | `delivered` | `pickup_expired` |
| `received` sin ninguna prenda (llegó todo en 0) | `received` · Recibido | `delivered` | `received` |
| `cancelled` / `lost` | `cancelled` · Anulado / `lost` · Perdido | ídem | ídem |

\* `linkPickupSale` solo en pedidos **sin cobro**: un pedido cobrado se retira
únicamente con la venta enlazada en el POS (para descontar el anticipo).

**Plazo vencido**: un pedido **sin cobro** se puede seguir retirando (el
cliente pudo venir tarde), pero ya no aparece en `awaitingPickup` ni aparta
la prenda — puede que ya no esté. Uno **cobrado** vencido ya no se enlaza:
el anticipo se perdió; si el cliente igual quiere la prenda, se le vende sin
enlazar el pedido.

"Esperando al cliente" usa la misma regla que el filtro `awaitingPickup`: la
lista y la etiqueta nunca se contradicen.

### 4.5 Acciones que se suman a cualquier etapa

| Acción | Cuándo | Quién |
|---|---|---|
| `refund` | `refundPending > 0` (se le debe plata al cliente) | A |
| `review` | `pendingReview: true` | central |

Ej.: un pedido cobrado `not_found`, para A: "No encontrado" + badge
"Devolución pendiente Bs `refundPending`" + botón `refund`.

### 4.6 Plazos de un pedido recibido

En `awaiting_customer` mostrá **los dos** plazos, no uno:
- `holdUntil` → "Apartado hasta…": hasta cuándo la prenda está reservada
  para el cliente. En un pedido **sin cobro** puede terminar antes (o ser
  `null` = sin apartado): pasado ese momento la tienda puede venderla a otro
  aunque el pedido siga esperando.
- `pickupDeadline` → "Espera al cliente hasta…".

En un pedido cobrado los dos coinciden.

---

## 5. Pantallas sugeridas

Organizá por **propósito**, no por endpoint: dos menús.

**Menú "Movimientos de stock"** (inventario: sin cliente ni plata)

| Pestaña | Quién | Query |
|---|---|---|
| Reposición | Tienda | `replenishment=true&status=pending_dispatch` → editar su "carrito" (`addVariants`/`removeVariant`), anular; historial con `replenishment=true` |
| Envíos de la central | Tienda | `type=central_dispatch` (envíos + reposiciones atendidas) → `receive` |
| Bodega ↔ Tienda | Tienda | `/stock-transfers` (ver [06](06-inventory-and-warehouse.md)) |
| Por atender | Central | `replenishment=true&status=pending_dispatch` → pantalla de atención: por línea, variante + `centralWarehouseStock` + cantidad a mandar |
| Nuevo envío / En camino / Por revisar | Central | como en [11 §9](11-central-warehouse-and-branch-transfers.md) |

En el catálogo/inventario de la tienda: botón **"Pedir reposición"** por
variante (o selección múltiple), deshabilitado con la marca "Reposición
pedida" si `pendingReplenishment` es `true`.

**Menú "Pedidos entre sucursales"** (cliente, anticipo, retiro): "Que pedí"
(`type=branch_request&direction=incoming`) y "Que me pidieron"
(`type=branch_request&direction=outgoing`) — ver [11 §5](11-central-warehouse-and-branch-transfers.md)
y [13](13-prepaid-branch-requests.md).

**Detalle (una sola pantalla para los tres tipos)**: encabezado con
`stageLabel` (+ badges "Por revisar" si `pendingReview`, "Devolución
pendiente" si `refundPending > 0`), línea de tiempo con las fechas y actores
(`requestedAt/By`, `dispatchedAt/By`, `receivedAt/By`…), tabla de líneas y,
abajo, un botón por acción de `allowedActions`.
