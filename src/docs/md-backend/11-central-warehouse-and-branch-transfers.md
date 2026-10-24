# Bodega principal, envíos a tiendas y pedidos entre sucursales

Tres piezas nuevas que trabajan juntas (más una cuarta, del 23/10: las
**devoluciones** de una tienda a la bodega, `central_return`, ver
[16-central-returns.md](16-central-returns.md)):

1. **Bodega principal**: por donde entra **todo** el stock nuevo.
2. **Envíos desde la bodega** (`central_dispatch`): la bodega le manda
   mercadería a una tienda — por su cuenta, o porque la tienda se la
   **pidió** (reposición, `replenishment: true`: ver
   [15-replenishments-and-transfer-stages.md](15-replenishments-and-transfer-stages.md)).
3. **Pedidos entre sucursales** (`branch_request`): la tienda A le pide a la
   tienda B una prenda para un cliente que está en A. El cliente la **paga al
   retirarla**, con una venta normal en A — o **por adelantado al pedir**
   (anticipo, opcional): eso está en
   [13-prepaid-branch-requests.md](13-prepaid-branch-requests.md).

Los envíos y los pedidos son el mismo recurso: `/branch-transfers` (un
"traslado"). **No confundir** con `/stock-transfers`, que mueve stock
depósito ↔ piso **dentro** de una misma sucursal (ver
[06-inventory-and-warehouse.md](06-inventory-and-warehouse.md)).

Todas las rutas van bajo `/api` (omitido acá). Confirmá los shapes exactos en
Swagger (`/api/docs`, tags *Branch Transfers* y *Central Warehouse*).

---

## 1. Bodega principal

### Qué es

Internamente es una `Branch` especial (`type: "central_warehouse"`). El backend
la crea sola al arrancar (vacía, con el nombre "Bodega principal"). Hay
**exactamente una**.

- **Solo tiene depósito** (`warehouse`), nunca piso de venta.
- **No vende**, no abre caja, no tiene usuarios asignados, no factura.
- **No aparece** en `GET /branches`, `GET /web-page/branches` ni en la
  disponibilidad por sucursal. `GET /branches/:id` con su id da `404`.
- No se borra ni se desactiva. Lo único editable es el nombre.

### Endpoints

```
GET   /central-warehouse                  (ADMIN, SUPERVISOR) → { id, name }
PATCH /central-warehouse { "name": "..." } (ADMIN, SUPERVISOR) → { id, name }
```

El front pide el `id` una vez (por ejemplo al entrar al panel) y lo usa como
`?branchId=` en los endpoints de stock que la aceptan:

| Endpoint | Con `?branchId=<bodega>` |
|---|---|
| `GET /variants`, `GET /variants/products`, `GET /variants/:id`, `GET /variants/stock/:id` | ✅ ver su stock (`/variants/products` pagina por producto: es el listado de la bodega) |
| `GET /variants/:id/movements` | ✅ kardex de la bodega |
| `POST /variants/subtractstock` | ✅ baja en la bodega (solo `location: "warehouse"`, o sin `location`) |
| `GET /variants/dashboard/lowStock`, `GET /variants/export/exel`, `/export/stock-critico`, `/export/transactions/exel` | ✅ |
| `GET /branch-transfers`, `GET /branch-transfers/pending-count` | ✅ envíos que salen de la bodega |
| **Cualquier otro endpoint con `?branchId=`** (órdenes, caja, `/stock-transfers`, `positive-adjustment`, bestsellers, total-sales…) | ❌ `403 "La bodega principal no opera como sucursal: esta acción no está disponible para ella"` |

En la bodega, `availableStock` (vendible) es **siempre 0**: su stock es
`warehouseStock`.

Todas las vistas de stock por variante (`/variants`, `/products/:id`,
`/outfits/:id`) traen el stock de la bodega en `centralWarehouseStock`,
filtren o no por sucursal. En la vista general sin sucursal
(`/products/:id`, `/outfits/:id`), `warehouseStock` es solo el de los
depósitos de las tiendas (ver [06](06-inventory-and-warehouse.md) "Vista
general").

### Cómo entra el stock ahora

**Todo ingreso va al depósito de la bodega principal**, sin excepción:

```
POST /variants                (ADMIN, SUPERVISOR)  stock inicial de las tallas → bodega principal
PATCH /variants/:id            (ADMIN, SUPERVISOR)  tallas nuevas → bodega principal
POST /variants/addstock        (ADMIN, SUPERVISOR)  { variantId, quantity } → bodega principal
```

- El `branchId` del body de `POST /variants` quedó **deprecado e ignorado**
  (se acepta para no romper, pero no hace nada).
- `addstock` **ya no admite MANAGER** (`403`) y **ignora `?branchId=`**.
- Para que una tienda tenga stock: ingreso a la bodega → **envío** a la
  tienda (sección 2) → la tienda lo **recibe** en su depósito → lo pasa al
  piso con `/stock-transfers`.

**Única excepción — sobrante en una tienda** (un conteo encontró más de lo
que figura):

```
POST /variants/positive-adjustment?branchId=<tienda>   (ADMIN, SUPERVISOR)
{ "variantId": 1, "quantity": 2, "location": "sales_floor" | "warehouse", "note": "Sobrante conteo fin de mes" }
```

`note` obligatoria (un texto de solo espacios da `400`). Con la bodega como
`branchId` → `403` (ahí se usa `addstock`). En el kardex sale como `ajuste`
con cantidad positiva.

---

## 2. Envíos de la bodega a una tienda (`central_dispatch`)

### Flujo

```
ADMIN/SUPERVISOR                      TIENDA DESTINO (MANAGER/CASHIER)
POST /branch-transfers/central-dispatch
  → status "in_transit"
  → sale del depósito de la bodega
                                       ve "por recibir" en pending-count
                                       POST /branch-transfers/receive/:id
                                         → status "received"
                                         → entra a SU DEPÓSITO (por defecto)
                                           o directo al PISO con "location": "sales_floor"
                                       POST /stock-transfers (warehouse_to_floor) si entró al depósito
```

Mientras está `in_transit` el stock **no está en ninguna sucursal** (la tienda
lo ve como `inTransitStock` / `inTransit`).

Esto es el envío que la central manda **por su cuenta**. Si la tienda lo
**pide** (reposición), nace `pending_dispatch` sin cantidades y la central lo
atiende después: ver [15](15-replenishments-and-transfer-stages.md) §1.

### Crear el envío

```
POST /branch-transfers/central-dispatch          (ADMIN, SUPERVISOR)
{
  "destinationBranchId": 2,
  "items": [ { "variantId": 10, "quantity": 5 }, { "variantId": 11, "quantity": 3 } ],
  "note?": "Reposición de temporada"
}
→ 201 BranchTransfer (status "in_transit")
```

Errores:
- `404 Sucursal destino ID N no encontrada o inactiva` (incluye mandar la bodega como destino).
- `400 Stock insuficiente en la bodega principal para la variante N: disponible D, solicitado Q` — no se hace parcial.
- `400 La variante N está repetida: va una sola vez con la cantidad total`.

### Crear el envío con un Excel (ADMIN, SUPERVISOR)

Una tienda por archivo. El resultado es el **mismo envío** que el de arriba:
nace `in_transit`, la tienda lo recibe con `receive` y los faltantes van a
revisión. El Excel solo arma las líneas.

```
GET  /branch-transfers/central-dispatch/import/template?destinationBranchId=2
→ plantilla-envio-stock.xlsx: una fila por variante
  | ID variante | Producto | Color | Talla | Stock bodega principal | Stock <tienda> | En camino a <tienda> | Pedido por la tienda | Cantidad a enviar |
  "Stock bodega principal" = lo que se puede enviar (depósito físico de la central)
  "Stock <tienda>"         = depósito + piso de la tienda destino
  "En camino a <tienda>"   = ya despachado hacia la tienda y sin recibir (cualquier traslado in_transit)
  "Pedido por la tienda"   = "Sí" si la variante está en una reposición de la tienda sin atender
                             (mejor atender la reposición: POST /branch-transfers/replenishments/:id/dispatch, doc 15 §1)
  Las cuatro son referencia, para no mandar dos veces lo mismo.
  Encabezado en la fila 1 y en bloques, igual que la plantilla de ingreso: franja por categoría › subcategoría, título por
  producto y sus variantes por color y talla. Franjas y títulos no tienen ID: se ignoran al subir.

POST /branch-transfers/central-dispatch/import?destinationBranchId=2&dryRun=true|false
multipart/form-data: file (.xlsx, máx. 5 MB), note? (texto)
```

- Mismas reglas que el ingreso por Excel ([06](06-inventory-and-warehouse.md),
  "Ingreso masivo por Excel"): se leen `ID variante` y **`Cantidad a enviar`**
  por encabezado, vacía o 0 = no va, las filas repetidas se suman (aviso en
  `warnings`), **todo o nada**.
- Una plantilla de **ingreso** (columna "Cantidad a ingresar") subida acá se
  rechaza (`400`), y al revés también: no se puede mover stock con el archivo
  equivocado.
- **Además** se valida el stock de la bodega para **todas** las líneas a la
  vez: el `400` lista todas las que no alcanzan (el envío manual corta en la
  primera).
- `dryRun=true`: vista previa, no crea nada. Con `dryRun=false` (u omitido)
  crea el envío; sin `note` queda `"Envío importado desde Excel"`.
- ⚠️ `dryRun` acepta **solo `true` o `false`**: otro valor (`1`, `TRUE`,
  vacío…) es un `400`, nunca un envío real. `?branchId=` se ignora (el
  destino es siempre `destinationBranchId`).
- **Máximo 300 variantes con cantidad por archivo** (mientras se crea el envío
  esas variantes quedan bloqueadas y ninguna tienda puede venderlas; un envío
  más grande se divide en varios archivos).
- ⚠️ Subir dos veces el mismo archivo (o un doble clic en "Confirmar") crea
  **dos envíos**: el backend no detecta archivos repetidos. En el front:
  deshabilitar "Confirmar" mientras la request está en curso y, tras crear el
  envío, ir directo a su detalle (`transfer.id`) en vez de dejar la pantalla
  de subida lista para reenviar. Si se mandó de más, se anula el envío en
  camino (`POST /branch-transfers/cancel/:id`).
- Si entre la vista previa y la confirmación alguien despachó y ya no
  alcanza, la confirmación da el `400 Stock insuficiente…` normal (de una
  línea).

Respuesta `201`:

```json
{
  "dryRun": false,
  "destination": { "id": 2, "name": "Zarga" },
  "totalUnits": 7,
  "lines": [
    { "rows": [2], "variantId": 10, "product": "Polera", "color": "Azul", "size": "M", "quantity": 4, "available": 5 },
    { "rows": [3], "variantId": 11, "product": "Polera", "color": "Azul", "size": "L", "quantity": 3, "available": 20 }
  ],
  "warnings": [],
  "transfer": { "id": 45, "status": "in_transit", "...": "el BranchTransfer completo, como POST /central-dispatch" }
}
```

Con `dryRun=true`, `transfer` es `null`. `available` = stock de la bodega al
validar.

Errores (`400` salvo indicación):

| Caso | Respuesta |
|---|---|
| Filas con errores o sin stock | `{ "statusCode": 400, "message": "El archivo tiene errores: no se envió nada", "errors": [{ "row": 2, "message": "Stock insuficiente en la bodega principal para la variante 10 (filas 2, 4): disponible 5, solicitado 6" }, { "row": 7, "message": "La variante 999 no existe" }] }` |
| Tienda inválida o inactiva | `404 Sucursal destino ID N no encontrada o inactiva` (también en la plantilla) |
| Sin archivo / no es `.xlsx` / faltan encabezados | Igual que el ingreso por Excel (el encabezado esperado es "Cantidad a enviar") |
| Ninguna cantidad | `El archivo no tiene cantidades para enviar` |
| Más de 300 variantes | `El archivo tiene N variantes con cantidad: el máximo por envío es 300. Divídelo en varios archivos` |
| `dryRun` distinto de `true`/`false` | `400` de validación (`dryRun must be a boolean value`) |

### Anular un envío en camino

```
POST /branch-transfers/cancel/:id  { "note?": "Sucursal equivocada" }   (ADMIN, SUPERVISOR)
```
Solo mientras está `in_transit`. Vuelve al depósito de la bodega todo lo
**despachado** (`dispatchedQuantity`). Una tienda que intenta anular un envío
de la bodega recibe `403` (excepción: su propia reposición **pendiente**, ver
[15](15-replenishments-and-transfer-stages.md) §1.5).

### Marcar perdido (no llegó nada)

```
POST /branch-transfers/mark-lost/:id  { "note": "El paquete no llegó" }   (ADMIN, SUPERVISOR)
```
Solo `in_transit`, nota obligatoria. Pasa a `lost`: lo despachado queda como
pérdida (no vuelve a ningún lado). Si después aparece, se registra con un
ingreso o un ajuste positivo.

---

## 3. Recibir (común a envíos y pedidos)

```
POST /branch-transfers/receive/:id                 (MANAGER, CASHIER de la tienda destino)
{
  "items": [ { "transferItemId": 31, "quantity": 5 }, { "transferItemId": 32, "quantity": 2 } ],
  "note?": "Vino una menos",
  "location?": "warehouse" | "sales_floor"     // solo envíos de la bodega (ver abajo)
}
```

- `transferItemId` es el `id` de cada línea (`items[].id` del traslado), **no**
  el `variantId`.
- Hay que mandar **todas las líneas que salieron** (`dispatchedQuantity > 0`),
  una vez cada una. Faltante → `400 Faltan las líneas: 31, 32`.
- `quantity` va de `0` a lo despachado. Más → `400 Línea N: se recibieron X pero se despacharon Y`.
- Si llegó menos de lo despachado: **nota obligatoria**
  (`400 Llegó menos de lo despachado: la nota es obligatoria`) y el traslado
  queda **"por revisar"** (`discrepancyStatus: "pending_review"`).
- Se recibe **una sola vez**. Otra vez → `409 No se puede recibir: el traslado #N ya fue recibido`.
- A dónde entra:
  - envío de la bodega (incluida la reposición) → lo elige la tienda con
    `location`, **todo junto a un mismo lugar**: sin `location` (o
    `"warehouse"`) al **depósito**; con `"sales_floor"` directo al **piso**,
    vendible en el acto. Para repartir (parte al piso, parte al depósito),
    recibí todo en un lugar y mové el resto con `/stock-transfers`. El
    traslado guarda `receivedLocation`.
  - pedido entre sucursales → siempre al **piso** de la tienda (queda listo
    para venderle al cliente). Mandar `location` → `400 Un pedido entre sucursales entra siempre al piso: no se elige la ubicación`.
- Otra sucursal que intente recibirlo → `404`.

---

## 4. Faltantes: revisión (ADMIN, SUPERVISOR)

Un traslado queda `discrepancyStatus: "pending_review"` cuando:
- la tienda recibió menos de lo despachado, o
- en un pedido, la tienda origen no encontró todo lo pedido (ver 5.3).

Se revisa **recién cuando el traslado está cerrado** (`received`, `not_found`
o `lost`). Antes → `409 El traslado #N todavía está en curso: los faltantes se revisan cuando se recibe`.
El contador `pendingReview` y el filtro `discrepancyStatus=pending_review`
**ya solo muestran los revisables**.

```
POST /branch-transfers/review/:id
{
  "items": [ { "transferItemId": 31, "outcome": "lost" | "found_at_destination" | "found_at_origin" } ],
  "note": "Apareció en el depósito de la tienda"
}
```

| `outcome` | Qué pasa con el faltante de esa línea |
|---|---|
| `lost` | Queda como pérdida. No mueve stock. |
| `found_at_destination` | Suma en la tienda destino, **donde se recibió**: un pedido, en el **piso**; un envío, en `receivedLocation` (envíos viejos: el **depósito**). No se permite si la línea tiene unidades que **nunca salieron** del origen (`400 ... nunca salieron del origen, no pueden aparecer en el destino`). |
| `found_at_origin` | Vuelve a donde salió: depósito de la bodega (envío); en un pedido, a la tienda origen — primero a su **depósito** (hasta `fromWarehouse`) y el resto a su **piso**. |

- Cada línea se revisa **una sola vez**. Podés revisar algunas ahora y otras
  después; cuando no queda ninguna, el traslado pasa a `reviewed`.
- `note` obligatoria.
- Sin faltantes pendientes → `409 El traslado #N no tiene faltantes por revisar`.
- En un traslado `lost`, lo despachado ya se dio por perdido: solo queda por
  revisar lo que no se encontró (si hubo).
- **Pedido que todavía espera a su cliente** (`received`, dentro de
  `pickupDeadline`, sin venta de retiro vigente ni "no retirado"):
  `found_at_destination` **devuelve la prenda al pedido** — sube
  `receivedQuantity` de la línea, queda **apartada** para el cliente y el
  pedido vuelve a "pedidos recibidos" (aunque hubiera llegado con 0). Si es
  **cobrado**, baja `refundOwed` y en la venta de retiro sale al precio
  congelado (ver 13 §5.1). Excepción: si al cliente **ya se le devolvió** la
  plata de esa prenda, queda como stock de la tienda. Si el pedido ya no
  espera (retirado, vencido, "no retirado"), también queda como stock de la
  tienda.
  ⚠️ Esa línea deja de mostrar el faltante (`receivedQuantity` ya lo
  incluye): queda `reviewOutcome: "found_at_destination"`.

---

## 5. Pedidos entre sucursales (`branch_request`)

### 5.1 La idea

La tienda A no tiene la prenda; la tienda B sí. A **pide** en nombre de un
cliente → B **despacha** → A **recibe** → el cliente viene y A le hace una
**venta normal** (su caja, su factura), enlazada al pedido.

- El pedido **no es una venta** ni tiene factura propia: la factura sale de
  la venta de retiro.
- **Cobrar al pedir es opcional.** Sin cobro (lo que describe este doc), no
  hay plata de por medio hasta el retiro. Con cobro (anticipo, devoluciones,
  QR, plazo con pérdida del anticipo) ver
  [13-prepaid-branch-requests.md](13-prepaid-branch-requests.md).
- Se le pide a B **lo que tiene en depósito y en piso**: el pedido saca
  **primero del depósito** de B y lo que falta, de su piso (así el piso
  queda para las ventas de B). Cada línea dice cuánto sale de cada lugar
  (`items[].warehouseQuantity` = del depósito; el resto, del piso).
- Desde que A pide, la prenda **deja de estar disponible en B** (sale en el
  momento; con cobro por QR, queda apartada — en el depósito y/o el piso —
  mientras se paga).
- Cuando llega a A queda **reservada para ese cliente** unos días (ver 5.5):
  no se le puede vender a otro.

### 5.2 Ver dónde hay stock (para pedir)

```
GET /variants/branch-stock/:variantId              (ADMIN, SUPERVISOR, MANAGER, CASHIER)
→ [
    {
      "branch": { "id": 3, "name": "Tienda Sur" },
      "salesFloor": 7,          // piso (físico)
      "warehouse": 2,           // depósito (físico)
      "reserved": 1,            // apartado en el piso por ventas en curso
      "heldForRequests": 0,     // apartado en el piso por pedidos: los que esperan a su cliente
                                //   acá, y la parte del piso de pedidos a esta tienda que esperan el pago QR
      "heldInWarehouse": 0,     // apartado en el depósito: la parte del depósito de pedidos a
                                //   esta tienda que esperan el pago QR
      "availableSalesFloor": 6, // piso − reserved − heldForRequests
      "availableWarehouse": 2,  // depósito − heldInWarehouse
      "availableToRequest": 8,  // lo que se puede pedir: availableWarehouse + availableSalesFloor
      "inTransit": 0            // en camino hacia esa tienda
    }, ...
  ]

GET /variants/branch-stock/product-color/:id       (mismos roles) — todas las tallas de un color
→ [ { "variantId": 10, "size": { "id", "name" }, "branches": [ ...igual que arriba ] }, ... ]
```

Lista todas las **tiendas activas** (sin la bodega), **incluida la propia**:
ocultala en la UI de "pedir a otra sucursal". Se puede pedir hasta
`availableToRequest` (depósito + piso disponibles de B, el mismo cálculo
que valida el backend al crear el pedido). **No** sumes `salesFloor +
warehouse`: eso incluye lo reservado por ventas en curso y pedidos.

Con `?branchId=` (opcional, ambos endpoints) devuelve solo esa tienda, en la
misma forma de lista (un elemento, o `[]` si no es una tienda activa).
Cualquier rol puede pasar cualquier tienda — no se fuerza la propia.

### 5.3 Flujo completo

```
TIENDA A (pide)                          TIENDA B (origen)
POST /branch-transfers/requests
  → "pending_dispatch"
  → sale de B (depósito primero, después piso)
                                          ve "por despachar" (toDispatch)
                                          POST /branch-transfers/dispatch/:id
                                            → "in_transit"   (salió algo)
                                            → "not_found"    (no encontró nada)
ve "por recibir" (toReceive)
POST /branch-transfers/receive/:id
  → "received", entra al PISO de A,
    reservado para el cliente
ve "pedidos recibidos" (awaitingPickup)
avisa al cliente
el cliente viene → venta normal en A
  con branchTransferId → "retirado"
```

**Pedir** (MANAGER, CASHIER de A — la tienda que pide es la del usuario):
```
POST /branch-transfers/requests
{
  "sourceBranchId": 3,
  "items": [ { "variantId": 10, "quantity": 1 } ],
  "customerName?": "María Pérez",
  "customerPhone?": "70012345",
  "customerCi?": "1234567",
  "note?": "Pasa a retirar el sábado",
  "paymentType?": "cash" | "card" | "qr",   // solo pedido cobrado → ver 13
  "expectedTotal?": 850                      // solo pedido cobrado → ver 13
}
→ 201 BranchTransfer (status "pending_dispatch"; "pending_payment" si se cobra por QR)
```
- Sin cobro, los datos del cliente son **opcionales** (si los mandás, no
  pueden venir vacíos). Con cobro son obligatorios.
- Puede llevar **varias prendas** y varias unidades de cada una, todas de la
  misma tienda B.

Errores: `400 No se puede pedir a la propia sucursal` ·
`404 Sucursal ID N no encontrada o inactiva` (incluye la bodega) ·
`400 Stock insuficiente en <B> (depósito + piso) para la variante N: disponible D, solicitado Q` ·
`400` variante repetida · `400 customerName should not be empty` (vacío o solo espacios).

**Despachar** (MANAGER, CASHIER de B). B **acepta el pedido al despacharlo**:
```
POST /branch-transfers/dispatch/:id
{}                                                   → sale todo lo pedido
{ "items": [ { "transferItemId": 40, "quantity": 0 } ], "note": "No estaba en el piso" }
                                                     → parcial / nada
```
- Una línea que no mandás en `items` sale completa.
- `quantity` de `0` a lo pedido.
- Si falta algo: **nota obligatoria**; queda como faltante de B "por revisar".
- Si no sale nada: `status: "not_found"` → A tiene que avisarle al cliente.
- **No mueve stock** (el stock ya salió de B al pedir).
- **Qué buscar y dónde**: cada línea trae `fromWarehouse` y
  `fromSalesFloor` ya resueltos. En la pantalla de B, por línea: "Sacar
  `fromWarehouse` del depósito y `fromSalesFloor` del piso" (un pedido de
  antes del cambio viene con todo en `fromSalesFloor`). No los calcules con
  `warehouseQuantity`. En envíos de la central vienen `null`.
- Si A lo anuló mientras tanto → `409 No se puede despachar: el traslado #N fue anulado`.
  **Proceso**: B marca "despachado" en el sistema **antes** de entregar la
  prenda al transporte; si da 409, no la manda.
- Otra tienda que intente despacharlo → `404 Pedido #N no encontrado`.

**Recibir**: igual que en la sección 3 (entra al **piso** de A).

**Anular** (solo **antes** del despacho: `pending_payment` o `pending_dispatch`):
```
POST /branch-transfers/cancel/:id  { "note?": "El cliente ya no lo quiere" }
```
- MANAGER/CASHIER: solo la **tienda que pidió** (A). B no anula: si no la
  encuentra, la marca al despachar (`403` si lo intenta).
- ADMIN/SUPERVISOR: cualquiera.
- La prenda vuelve a B, a donde salió (depósito y/o piso). Ya despachado → `409 ... ya fue despachado`:
  una vez despachado, llega a A igual.
- Si el pedido se cobró, al anularlo **se debe devolver todo** (ver 13 §5).

### 5.4 Vender el pedido (retiro) — integración con el POS

Cuando el cliente viene a buscarlo, A le hace una **venta normal** y le avisa
al backend qué pedido se lleva:

1. **Detectar** que el carrito tiene una prenda de un pedido que espera:
   ```
   GET /branch-transfers?awaitingPickup=true&variantIds=10,15
   ```
   (con las `variantId` del carrito). Si devuelve algo, preguntá
   **"¿Es el pedido #N de <customerName>?"**.
2. Si confirma, mandá `branchTransferId` en **el reprice y en la venta**:
   ```
   POST /orders/reprice   { "items": "<jwt>", "type": "in_store", "branchId": <A>, "branchTransferId": 15 }
   POST /orders/in-store  { "items": "<jwt>", "payment_type": "cash", "billing": {...}, "branchTransferId": 15 }
   ```
   El resto del flujo de venta (confirmar, facturar, caja) no cambia.
3. El backend marca el pedido `pickupStatus: "picked_up"` con
   `pickupOrderId` = la venta, y usa la unidad reservada.

**Por qué importa**: la unidad reservada **no cuenta como disponible**. Si el
cajero no enlaza el pedido, el reprice y la venta fallan por falta de stock.
Como respaldo, el error lo dice:
`400 Insufficient stock for variants: [10] (variante 10 reservada para el pedido #15)`.
Mostrá ese mensaje tal cual: le indica al cajero qué pedido enlazar.

**Requisito de UX**: el POS tiene que dejar agregar al carrito una prenda con
disponible 0 **cuando hay un pedido esperándola** (si no, el cajero nunca
llega al paso de enlazarlo).

Errores al enlazar (`POST /orders/in-store` con `branchTransferId`):
| Error | Cuándo |
|---|---|
| `404 Pedido #N no encontrado en esta sucursal` | no existe, no es un pedido, o no llegó a esta tienda |
| `409 El pedido #N no está recibido en esta sucursal` | todavía no se recibió |
| `409 El pedido #N ya se retiró con la venta #M` | ya está enlazado a una venta vigente |
| `409 El pedido #N ya se marcó como no retirado` | se marcó "no retirado" (no se puede re-enlazar) |
| `400 La venta no incluye ninguna prenda del pedido #N` | el carrito no tiene ninguna de sus prendas |

- Un pedido **sin cobro** vencido (pasó el plazo de retiro) **igual se puede
  enlazar**: el cliente pudo venir tarde. Uno **cobrado** vencido no: el
  anticipo se perdió (`409`, ver 13 §7).
- Pedido **cobrado**: la venta va con el precio congelado, descuenta el
  anticipo y tiene que llevar todas las prendas pagadas (ver 13 §6).
- **Retiro parcial no existe**: enlazar marca el pedido entero como retirado.
- "Retirado" vale **mientras la venta siga vigente**. Si esa venta se cancela
  o vence sin pagar, el pedido **vuelve a "esperando"** (y a su reserva, si
  sigue en plazo) y se puede enlazar a otra venta. Ojo: en ese caso
  `pickupStatus` sigue diciendo `"picked_up"`; para saber si está vigente,
  mirá el estado de la venta `pickupOrderId` o si aparece en
  `awaitingPickup=true`.
- Editar la venta (`cancel-for-edit` + `PATCH`) **no** libera el pedido: la
  edición cuenta como la misma venta. En un pedido cobrado, el anticipo pasa a
  la venta nueva.

**Respaldo manual** (MANAGER, CASHIER de A):
```
POST /branch-transfers/pickup/:id
{ "status": "not_picked_up", "note?": "Avisó que ya no lo quiere" }     → libera la reserva
{ "status": "picked_up", "orderId": 120, "note?": "..." }                → se olvidaron de enlazarlo en la venta
```
- `picked_up` exige `orderId`: una venta **de esta tienda**, vigente, que
  incluya alguna prenda del pedido (mismos errores que arriba, más
  `404 Venta #N no encontrada en esta sucursal` y
  `409 La venta #N no está vigente (<status>)`). No sirve para pedidos
  cobrados (`409`, ver 13 §6.4).
- `not_picked_up` en un pedido cobrado = el cliente **pierde el anticipo**.
- No mueve stock.

### 5.5 Plazos: reserva y retiro

Dos valores de **configuración** que edita ADMIN/SUPERVISOR desde el admin
(`GET/PATCH /settings`, ver
[13-prepaid-branch-requests.md](13-prepaid-branch-requests.md) §2). Ya **no**
son variables de entorno.

| Configuración | Controla | En la respuesta |
|---|---|---|
| `branchRequestHoldDays` | Cuánto tiempo la prenda queda **reservada** para el cliente desde que A la recibe. Con `0` no hay reserva (se puede vender a cualquiera al llegar). Un pedido **cobrado** la reserva todo el plazo de retiro. | `holdUntil` (fecha, o `null` si no hay reserva o no se recibió) |
| `branchRequestPickupDays` | Cuánto tiempo el pedido figura en **"pedidos recibidos"** esperando al cliente. Pasado ese plazo sin retiro cuenta como **no retirado** (y, si se cobró, el cliente pierde el anticipo). | `pickupDeadline` (fecha, o `null`) |

- Las fechas se **fijan en el pedido al recibirlo**: cambiar la configuración
  solo afecta a los pedidos que se reciban después.
- Vencen al **fin del día en Bolivia** (23:59), contando el día de recepción
  como día 0: recibido el lunes con 3 días → vence el jueves a las 23:59.
- `holdUntil` ≤ `pickupDeadline` siempre.
- **No calcules los plazos en el front**: usá `holdUntil` y `pickupDeadline`
  de la respuesta.
- Entre `holdUntil` y `pickupDeadline` el pedido sigue en la lista, pero la
  prenda **ya se puede vender a otro**.

Estado del pedido para mostrar (con `status: "received"`):
| Condición | Mostrar |
|---|---|
| `pickupStatus: null` y ahora < `pickupDeadline` | Esperando al cliente (reservado hasta `holdUntil`) |
| `pickupStatus: null` y ahora ≥ `pickupDeadline` | No retirado (venció el plazo) |
| `pickupStatus: "picked_up"` | Retirado con la venta `#pickupOrderId` (ver la salvedad de 5.4) |
| `pickupStatus: "not_picked_up"` | No retirado (marcado) |

### 5.6 Estadística de retiro (ADMIN, SUPERVISOR)

Sirve para decidir si en algunas sucursales conviene cobrar al pedir.

```
GET /branch-transfers/pickup-stats?from=2026-10-01&to=2026-10-31     (fechas de recepción, ambas incluidas)
→ [
    {
      "sourceBranch": { "id": 3, "name": "Tienda Sur" },
      "destinationBranch": { "id": 2, "name": "Tienda Norte" },
      "received": 12,
      "pickedUp": 9,
      "notPickedUp": 2,          // = notPickedUpMarked + notPickedUpExpired
      "notPickedUpMarked": 1,
      "notPickedUpExpired": 1,
      "waiting": 1               // todavía dentro del plazo
    }, ...
  ]
```

---

## 6. Consultar traslados

### Listado

```
GET /branch-transfers?page=1&limit=10
  &direction=incoming|outgoing
  &status=pending_payment|pending_dispatch|in_transit|not_found|received|lost|cancelled
  &type=central_dispatch|branch_request|central_return   (central_return = devolución a la bodega, ver 16)
  &discrepancyStatus=pending_review|reviewed
  &awaitingPickup=true
  &pendingRefund=true                         (pedidos cobrados con devolución pendiente, ver 13 §5)
  &replenishment=true|false                   (solo reposiciones / sin reposiciones, ver 15 §3)
  &variantIds=10,15
  &branchId=<solo ADMIN/SUPERVISOR>
→ { data: BranchTransfer[], meta: {...} }     (más nuevos primero)
```

- MANAGER/CASHIER ven solo los traslados donde su tienda es origen o destino.
- ADMIN/SUPERVISOR: sin `branchId` ven todos; con `branchId` (la bodega
  incluida), los de esa sucursal.
- `direction` solo aplica con una sucursal: `outgoing` = sale de ella,
  `incoming` = llega a ella.
- `awaitingPickup=true` = pedidos recibidos **en esta tienda** que esperan a
  su cliente dentro del plazo (con al menos una prenda recibida).
- Un pedido en `pending_payment` (cobro QR sin pagar) **solo lo ve la tienda
  que lo hizo**: la tienda origen no lo lista y su detalle le da `404`.

Listas típicas de la tienda:
| Pantalla | Query |
|---|---|
| Por despachar | `direction=outgoing&status=pending_dispatch` |
| Por recibir | `direction=incoming&status=in_transit` |
| Pedidos recibidos | `awaitingPickup=true` |
| Mis pedidos (seguimiento) | `direction=incoming&type=branch_request` |

Listas típicas de ADMIN/SUPERVISOR:
| Pantalla | Query |
|---|---|
| Faltantes por revisar | `discrepancyStatus=pending_review` |
| Reposiciones por atender | `replenishment=true&status=pending_dispatch` |
| Envíos en camino | `type=central_dispatch&status=in_transit` |
| Historial de la bodega | `branchId=<bodega>&direction=outgoing` |

### Detalle

```
GET /branch-transfers/:id
```
MANAGER/CASHIER: `404` si su tienda no es origen ni destino.

### Forma de un traslado (detalle y cada ítem del listado)

```jsonc
{
  "id": 15,
  "type": "branch_request",                 // o "central_dispatch" | "central_return"
  "replenishment": false,                   // true = reposición (central_dispatch que pidió la tienda, ver 15)
  "status": "received",
  "discrepancyStatus": null,                // "pending_review" | "reviewed" | null
  "note": "Pasa a retirar el sábado",

  // cómo lo ve quien consulta — usá esto para la etiqueta y los botones (ver 15 §4)
  "stage": "awaiting_customer",
  "stageLabel": "Esperando al cliente",
  "allowedActions": ["pickupInPos", "markNotPickedUp", "linkPickupSale"],
  "pendingReview": false,

  "customerName": "María Pérez",            // solo pedidos
  "customerPhone": "70012345",
  "customerCi": "1234567",
  // + campos del cobro (advanceAmount, advancePaidAt, refundOwed, qrIds,
  //   qrExpiresAt, payments, pickupOrder, paymentExpired, refunded,
  //   refundPending, advanceForfeited, y precio congelado en cada ítem):
  //   ver 13 §9
  "sourceBranchId": 3,      "sourceBranch": { "id": 3, "name": "Tienda Sur" },
  "destinationBranchId": 2, "destinationBranch": { "id": 2, "name": "Tienda Norte" },

  // quién y cuándo (actores: { id, name } o null)
  "requestedBy": { "id": 7, "name": "cajeroA" },  "requestedAt": "...",
  "dispatchedBy": {...},  "dispatchedAt": "...",
  "notFoundBy": null,     "notFoundAt": null,  "notFoundNote": null,
  "receivedBy": {...},    "receivedAt": "...", "receiveNote": null,
  "cancelledBy": null,    "cancelledAt": null, "cancelNote": null,
  "lostBy": null,         "lostAt": null,      "lostNote": null,
  "reviewedBy": null,     "reviewedAt": null,

  // retiro (solo pedidos)
  "pickupStatus": null,                     // "picked_up" | "not_picked_up" | null
  "pickupOrderId": null,
  "pickupMarkedBy": null, "pickupMarkedAt": null, "pickupNote": null,
  "pickupDeadline": "...",                  // fijado al recibir (5.5)
  "holdUntil": "...",                       // fijado al recibir (5.5)

  "items": [
    {
      "id": 40,                             // ← transferItemId para dispatch/receive/review
      "variantId": 10,
      "variant": {
        "id": 10,
        "size": { "id": 2, "name": "M" },
        "productColor": { "id": 5, "product": { "id": 1, "name": "Camisa" }, "color": { "id": 3, "name": "Azul", "code": "#00f" } }
      },
      "quantity": 1,                        // pedido / enviado — ⚠️ null en una reposición
      "dispatchedQuantity": 1,              // salió del origen (null = todavía no)
      "receivedQuantity": 1,                // llegó (null = todavía no)
      "reviewOutcome": null, "reviewNote": null, "reviewedBy": null, "reviewedAt": null
    }
  ]
}
```

Faltante de una línea = no encontrado (`quantity − dispatchedQuantity`, solo
en pedidos) + perdido en el camino (`dispatchedQuantity − receivedQuantity`).
En un envío de la central (incluida la reposición) no hay "no encontrado":
lo que la central no mandó nunca salió de la bodega.

### Contador de pendientes (badges)

```
GET /branch-transfers/pending-count?branchId=<solo ADMIN/SUPERVISOR>
→ { "toDispatch": 1, "replenishmentsPending": 0, "toReceive": 2, "inTransit": 0, "pendingReview": 1, "awaitingPickup": 3, "pendingRefunds": 0 }
```

| Campo | Significa (para la sucursal consultada) |
|---|---|
| `toDispatch` | pedidos que **tengo que despachar** (nunca reposiciones) |
| `replenishmentsPending` | reposiciones sin atender: tienda `0`/`1` (la suya); central = cuántas tiendas esperan (ver 15 §3) |
| `toReceive` | traslados en camino **hacia mí** |
| `inTransit` | traslados que **salieron de mí** y siguen en camino |
| `pendingReview` | traslados cerrados con faltantes sin revisar |
| `awaitingPickup` | pedidos recibidos **en mi tienda** esperando a su cliente |
| `pendingRefunds` | pedidos cobrados **de mi tienda** con plata por devolver al cliente (ver 13 §5) |

No hay websockets: **consultalo cada ~30 segundos** y mostralo como badges.
ADMIN/SUPERVISOR sin `branchId` ven los totales de todas las sucursales.
Qué sumar en el badge de cada rol: [15](15-replenishments-and-transfer-stages.md) §3.

---

## 7. Estados

```
central_dispatch:   in_transit ──receive──▶ received
                        │ ├──cancel──▶ cancelled   (vuelve a la bodega lo despachado)
                        │ └──mark-lost─▶ lost

reposición:         pending_dispatch ──attend (algo > 0)──▶ in_transit ──▶ (igual que central_dispatch)
(central_dispatch +     │  └──attend (todo en 0)──▶ not_found   ("Rechazada")
 replenishment)         └──cancel / quitar la última variante──▶ cancelled   (no se movió nada)
branch_request:     pending_dispatch ──dispatch──▶ in_transit ──receive──▶ received
                        │                  │            └──mark-lost──▶ lost
                        │                  └─(nada)──▶ not_found
                        └──cancel──▶ cancelled   (vuelve al piso de B)

con cobro por QR:   pending_payment ──pago QR──▶ pending_dispatch ──▶ (igual que arriba)
                        ├──cancel──▶ cancelled   (no se pagó: nada que devolver)
                        └──pago tardío sin la prenda en B──▶ cancelled   (se devuelve todo)

central_return:     in_transit ──returns/:id/receive──▶ received   (al depósito de la bodega)
(tienda → bodega)       │ ├──cancel──▶ cancelled   (vuelve a la tienda, a donde salió)
                        │ └──mark-lost─▶ lost
```

Actuar en un estado que no corresponde → `409 No se puede <acción>: el traslado #N <ya fue recibido | fue anulado | ...>`.

Para mostrar el estado **no traduzcas `status` a mano**: usá `stageLabel` y
`allowedActions` (dependen también de quién mira, de los plazos y de la
plata). Tablas completas en [15](15-replenishments-and-transfer-stages.md) §4.

---

## 8. Kardex y Excel

Las filas de traslados aparecen en `GET /variants/:id/movements` con estos
`type` (además de `ingreso`, `venta`, `ajuste`, `traspaso`):

| `type` | Dónde aparece | Cantidad |
|---|---|---|
| `envio_bodega` | bodega (salida de un envío) | − |
| `salida_pedido` | tienda B (sale por un pedido) | − |
| `devolucion_bodega` | tienda (sale por una devolución a la bodega, ver [16](16-central-returns.md)) | − |
| `envio_anulado` / `pedido_anulado` / `devolucion_anulada` | origen (vuelve al anular) | + |
| `recepcion` | destino (al recibir) | + |
| `aparecio_en_destino` | destino (revisión) | + |
| `aparecio_en_origen` | origen (revisión) | + |

Esas filas traen además `branchTransferId` (número de traslado) y
`counterpartBranch: { id, name }` (la otra sucursal). `ajuste` ahora puede ser
negativo (baja) o positivo (ajuste positivo): distinguilo por el signo de
`quantity`. En el Excel de movimientos las etiquetas son "Envío desde bodega",
"Salida por pedido", "Devolución a bodega", "Envío anulado", "Pedido anulado",
"Devolución anulada", "Recepción",
"Apareció en destino", "Apareció en origen", "Baja" y "Ajuste positivo".

---

## 9. Pantallas sugeridas

**ADMIN / SUPERVISOR**
- **Bodega principal**: stock (`GET /variants/products?branchId=<bodega>`,
  paginado por producto), ingresos
  (`addstock`), bajas, renombrar.
- **Nuevo envío**: elegir tienda + prendas con stock de depósito en la bodega
  → `central-dispatch`.
- **Traslados**: listado con filtros; acciones anular / marcar perdido sobre
  los `in_transit`.
- **Faltantes por revisar**: `discrepancyStatus=pending_review` → pantalla de
  revisión por línea.
- **Estadística de retiro**: `pickup-stats` por rango de fechas.
- **Ajuste positivo** en una tienda (sobrante de conteo).

**MANAGER / CASHIER**
- **Badges** con `pending-count` cada 30 s.
- **Por recibir**: contar lo que llegó por línea → `receive` (nota si falta).
- **Por despachar**: pedidos de otras tiendas → `dispatch` (todo, parcial o
  nada con nota).
- **Pedidos recibidos**: nombre y teléfono del cliente, `pickupDeadline`,
  botón "no retirado".
- **POS**: botón "buscar en otras sucursales" (`branch-stock`) → formulario de
  pedido (cliente + teléfono); aviso "¿es el pedido #N?" al armar el carrito;
  `branchTransferId` en reprice y venta.
- **Pedidos cobrados, QR, devoluciones y configuración**: pantallas en
  [13-prepaid-branch-requests.md](13-prepaid-branch-requests.md) §10.

**Reposiciones** y la organización sugerida en dos menús ("Movimientos de
stock" y "Pedidos entre sucursales"): [15](15-replenishments-and-transfer-stages.md) §5.
