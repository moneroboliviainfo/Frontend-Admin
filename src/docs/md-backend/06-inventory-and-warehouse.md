# Inventario: catálogo, stock, depósito y traspasos

## El modelo de stock

No hay una columna "stock" en la variante. El stock es un **ledger**: cada
movimiento (venta, ingreso, ajuste, traspaso, envío) es una fila en
`transactions` con una `quantity` con signo (+ ingreso, − salida), una
sucursal y una ubicación. El stock se calcula sumando.

```
stock_vendible(variante, sucursal) =
    SUM(transactions.quantity WHERE location = 'sales_floor')
  − reservas de venta pendientes y no vencidas
  − unidades reservadas para pedidos entre sucursales que esperan a su cliente
```

- **Reservas de venta**: al crear una orden (in-store u online) se reserva
  stock, no se descuenta. La reserva expira sola (~25 min) si no se confirma
  el pago.
- **El descuento real** (una `transaction` negativa) solo pasa al confirmar
  el pago (`SENT`/`PAID`).
- **Cancelar** una orden revierte sus `transactions` de venta (soft-delete),
  restaurando el stock.
- **Reservas de pedidos**: una prenda que llegó a una tienda por un pedido
  entre sucursales queda apartada para ese cliente unos días (si el pedido
  se cobró, todo el plazo de retiro). Solo la venta que retira ese pedido
  (con `branchTransferId`) puede usarla. Un pedido cobrado por QR que espera
  el pago también aparta la prenda en la tienda a la que se pidió, unos
  minutos. Ver
  [11-central-warehouse-and-branch-transfers.md](11-central-warehouse-and-branch-transfers.md) §5
  y [13-prepaid-branch-requests.md](13-prepaid-branch-requests.md).

## Bodega principal, depósito y piso

Hay dos niveles:

1. **Bodega principal** (una sola, sucursal especial): por donde entra
   **todo** el stock nuevo. Solo tiene depósito, no vende. Desde ahí se
   **envía** a las tiendas. Ver
   [11-central-warehouse-and-branch-transfers.md](11-central-warehouse-and-branch-transfers.md).
2. **Cada tienda** tiene **depósito** (`warehouse`) y **piso de venta**
   (`sales_floor`). No son entidades: es el campo `location` de cada
   `transaction`.

Recorrido normal de una prenda nueva:

```
POST /variants/addstock                        → depósito de la bodega principal
POST /branch-transfers/central-dispatch        → en camino a la tienda
   (o la tienda la pide: POST /branch-transfers/replenishments → la central la atiende, ver 15)
POST /branch-transfers/receive/:id             → depósito de la tienda (o directo al piso con "location": "sales_floor")
POST /stock-transfers (warehouse_to_floor)     → piso de la tienda (recién ahí se vende) — no hace falta si se recibió al piso
```

- El **stock vendible** (lo que usa el checkout, el reprice, el catálogo
  público) es **solo `sales_floor`**, menos lo reservado.
- Las alertas de stock bajo (`dashboard/lowStock`) se calculan sobre el
  **total** (depósito + piso) — no filtran por ubicación.
- Lo que está **en camino** (despachado y todavía no recibido) no suma en
  ninguna sucursal: se ve aparte como `inTransitStock`.

## Catálogo de variantes (admin)

```
POST  /variants         (A,S)     crear color+tallas de un producto, stock inicial → bodega principal
GET   /variants          (A,S,M,C) listar (con stock), paginado por COLOR — POS
GET   /variants/products (A,S,M,C) listar (con stock), paginado por PRODUCTO — bodega principal
GET   /variants/:id      (A,S,M,C) detalle
PATCH /variants/:id      (A,S)     editar (tallas nuevas → también a la bodega principal)
```
(A = ADMIN, S = SUPERVISOR, M = MANAGER, C = CASHIER; ver [02](02-roles-and-permissions.md).)

**Dos listados, misma info, distinta página:**

| | `GET /variants` | `GET /variants/products` |
|---|---|---|
| Cada elemento de `data` | un **color** de un producto (`product`, `color`, `variants[]`) | un **producto** (`subcategory.category`, `discount`, `productColors[]` → `color`, `variants[]`) |
| `limit=10` | 10 colores (un producto con 4 colores ocupa 4) | 10 productos, cada uno con **todos** sus colores |
| `meta.total` | cantidad de colores | cantidad de productos |
| `search` | producto, color, talla, `<qr>id</qr>` | producto, subcategoría, categoría, color, talla, `<qr>id</qr>` |
| Con `<qr>id</qr>` | **solo ese color y solo esa variante** | el **producto completo** (todos sus colores y tallas): resaltar la variante buscada |
| Orden | colores por `id`; variantes sin orden fijo | productos, colores y variantes por `id` |
| Uso | POS (el cajero agrega un color) | listado de la bodega principal / inventario por producto |

Los dos aceptan `page`, `limit`, `search` y `?branchId=` (también la bodega
principal), ordenan por `id` y traen en cada variante los mismos campos de
stock (abajo). En `/variants/products` la búsqueda filtra **productos**:
buscar "rojo" trae el producto con todos sus colores, no solo el rojo. Solo
lista productos con al menos un color. `discount` viene `null` si no está
vigente.

Con `limit=10` llegan 10 productos, que pueden ser 10 filas o 40 según
cuántos colores tenga cada uno. Para reutilizar la tabla "una fila por color"
de `GET /variants`, basta con aplanar la respuesta (cada fila queda con la
misma forma que el `data` de `GET /variants`, más `subcategory.category`
dentro de `product`):

```ts
const rows = res.data.flatMap((product) =>
  product.productColors.map((productColor) => ({ ...productColor, product })),
);
```

El `branchId` del body de `POST /variants` está **deprecado e ignorado**: el
stock inicial entra siempre a la bodega principal.

Las respuestas de listado/detalle traen, por variante:
- `availableStock`: vendible (piso − reservas de venta − reservas de pedidos)
  — **neto**, no es lo que hay físicamente en el piso;
- `salesFloorStock`: piso **físico** (sin restar reservas ni apartados, que
  también están en el local) — para el conteo, ver "Conteo físico" abajo;
- `warehouseStock`: en depósito, físico (todavía no vendible);
- `heldInWarehouse`: de `warehouseStock`, lo apartado por pedidos QR sin
  pagar — no se puede pasar al piso. Lo que sí se puede mover =
  `warehouseStock − heldInWarehouse` (en este endpoint no viene
  `availableWarehouse`: ese campo es de `GET /variants/branch-stock/...`);
- `pendingDispatchWarehouse` / `pendingDispatchSalesFloor`: pedidos de otras
  tiendas que esta tiene que despachar — ya descontados de su stock, pero
  **físicamente todavía en el local** (salen primero del depósito);
- `pendingShipmentSalesFloor`: ventas **online pagadas** (`paid`) de esta
  tienda que todavía no se enviaron — se descontaron del piso al pagarse,
  pero la prenda sigue en el local hasta el envío (`sent`);
- `inTransitStock`: en camino hacia la sucursal;
- `centralWarehouseStock`: en la bodega principal (ver abajo);
- `pendingReplenishment` (sí/no): la sucursal ya la pidió a la bodega y la
  central todavía no la atendió — en la vista general, alguna tienda la
  pidió (ver [15](15-replenishments-and-transfer-stages.md) §2).

Mostrá los que tu UI de inventario necesite; no asumas que
`availableStock` es "todo lo que hay". Con `?branchId=<bodega>`,
`availableStock` es siempre 0: su stock es `warehouseStock`.

**Vista general (sin sucursal)** — `GET /products/:id` y `GET /outfits/:id`
(admin) no filtran por sucursal: suman todas. Ahí los cuatro campos **no se
pisan** (ninguna unidad aparece en dos), pero sumados **no** son el stock
físico total: `availableStock` ya viene neto de las ventas en curso y de lo
apartado para pedidos, y las unidades de un pedido entre sucursales que la
tienda origen todavía no despachó (`pending_dispatch`) no están en ninguno.
Con `?branchId=X`, `centralWarehouseStock`
sigue mostrando la bodega principal (cuánto queda por despachar) — no lo
sumes al stock de X; con `X = bodega` es el mismo número que
`warehouseStock`.

| Campo | Vista general | Con `?branchId=X` (`/variants`) |
|---|---|---|
| `availableStock` | piso de todas las tiendas − reservas | piso de X − reservas |
| `salesFloorStock` | piso físico de todas las tiendas | piso físico de X (bodega: 0) |
| `pendingShipmentSalesFloor` | ventas online pagadas sin enviar, todas las tiendas | las de X |
| `warehouseStock` | depósitos de las **tiendas** (sin la bodega principal) | depósito de X (si X es la bodega: su stock) |
| `centralWarehouseStock` | **solo** la bodega principal | **igual**: la bodega principal (no depende de X) |
| `inTransitStock` | en camino hacia cualquier sucursal (tiendas y, por devoluciones, la bodega) | en camino hacia X (bodega: devoluciones de las tiendas) |
| `pendingReplenishment` | alguna tienda la pidió y la central no la atendió | X la pidió y la central no la atendió |

### Conteo físico (inventario de una tienda)

Lo que **debería encontrar** quien cuenta, por ubicación, con
`GET /variants?branchId=X` (todo en la misma respuesta):

| Ubicación | Esperado en el conteo |
|---|---|
| Piso | `salesFloorStock + pendingDispatchSalesFloor + pendingShipmentSalesFloor` |
| Depósito | `warehouseStock + pendingDispatchWarehouse` |

- **Nunca** contar contra `availableStock`: ya resta las ventas en curso del
  POS y las prendas apartadas para pedidos (QR sin pagar, pedidos recibidos
  que esperan al cliente), que siguen en el local. Cada conteo contra ese
  número registraría un sobrante falso.
- Los dos `pending…` son prendas **ya descontadas que siguen en el local**:
  - `pendingDispatch…` = pedidos de otras tiendas que esta tiene que
    despachar;
  - `pendingShipmentSalesFloor` = ventas online pagadas que todavía no se
    enviaron.
  Mostrarlos aparte ("Piso: 9 (+3 por despachar, +1 por enviar)") y en el
  modal de ajuste avisar: "4 unidades ya vendidas o pedidas siguen en el
  local: deberías contar 13".
- Diferencia = contado − esperado. Positiva → `POST /variants/positive-adjustment`
  (solo ADMIN/SUPERVISOR); negativa → `POST /variants/subtractstock`.

## Consultar stock

```
GET /variants/stock/:id?branchId=                    (A,S,M,C) → número, solo lo vendible
GET /variants/:id/movements?branchId=                (A,S,M,C) → kardex paginado
GET /variants/branch-stock/:variantId?branchId=      (A,S,M,C) → disponibilidad en cada tienda (o solo en branchId)
GET /variants/branch-stock/product-color/:id?branchId= (A,S,M,C) → ídem, todas las tallas
```

**Kardex** — cada fila trae: `quantity`, `location`, `type`, `user` (nombre
de quién lo hizo — en una `venta`, quien creó la orden en tienda; `null` en
ventas web y acciones del sistema), `orderId`, `stockTransferId`, `branchTransferId`,
`counterpartBranch` (`{ id, name }`, la otra sucursal de un traslado),
`reason`.

| `type` | Qué es |
|---|---|
| `ingreso` | ingreso de stock (bodega principal) |
| `venta` | venta confirmada |
| `ajuste` | baja (cantidad negativa) o ajuste positivo (positiva), con `reason` |
| `traspaso` | depósito ↔ piso dentro de la tienda |
| `envio_bodega`, `salida_pedido`, `devolucion_bodega`, `envio_anulado`, `pedido_anulado`, `devolucion_anulada`, `recepcion`, `aparecio_en_destino`, `aparecio_en_origen` | traslados entre sucursales (ver [11 §8](11-central-warehouse-and-branch-transfers.md)) |

**Disponibilidad por sucursal** (`branch-stock`) — una fila por tienda
activa (sin la bodega, **incluida la propia**): `salesFloor`, `warehouse`,
`reserved`, `heldForRequests`, `availableToRequest` (lo que se le puede pedir
a esa tienda), `inTransit` y `pendingReplenishment` (esa tienda pidió la
variante a la bodega y la central no la atendió). Es lo que usa el POS para
"buscar en otras sucursales".

`?branchId=` (opcional) filtra a una sola tienda: misma lista, con un solo
elemento (`[]` si no es una tienda activa — p. ej. la bodega principal o una
inactiva). A diferencia del resto de endpoints, **no** se fuerza la sucursal
del usuario: un MANAGER/CASHIER puede consultar cualquier tienda. Sirve para
ver piso (`salesFloor`) y depósito (`warehouse`) de una variante en una
sucursal concreta.

## Ingresar / dar de baja / ajustar stock

```
POST /variants/addstock                                     (ADMIN, SUPERVISOR)
{ "variantId": 1, "quantity": 20 }
→ entra SIEMPRE al depósito de la bodega principal (?branchId= se ignora)

POST /variants/subtractstock?branchId=                      (ADMIN, SUPERVISOR, MANAGER)
{ "variantId": 1, "quantity": -3, "reason": "producto dañado", "location?": "warehouse" | "sales_floor" }
→ default: descuenta del depósito. location: "sales_floor" para dar de baja
  algo que ya estaba en el piso. Acepta la bodega principal como branchId
  (solo depósito: con "sales_floor" → 400).

POST /variants/positive-adjustment?branchId=<tienda>        (ADMIN, SUPERVISOR)
{ "variantId": 1, "quantity": 2, "location": "sales_floor" | "warehouse", "note": "Sobrante conteo" }
→ sobrante de un conteo en una tienda. note obligatoria. Con la bodega → 403.
```
- El **MANAGER ya no ingresa stock** (`addstock` → `403`): le llega por
  envíos desde la bodega.
- `branchId` **no va en el body** — se resuelve solo (sucursal del manager, o
  `?branchId=` si sos ADMIN/SUPERVISOR).

### Ingreso masivo por Excel (ADMIN, SUPERVISOR)

Mismo efecto que muchos `addstock` juntos: todo entra al **depósito de la
bodega principal** (en el kardex/Excel sale como "Ingreso").

```
GET  /variants/import-stock/template
→ plantilla-ingreso-stock.xlsx: una fila por variante
  fila 1: el encabezado (fija al hacer scroll)
  | ID variante | Producto | Color | Talla | Stock bodega principal | Cantidad a ingresar |
  (solo se llena la última; vacía o 0 = no se ingresa)
  en bloques: una franja por categoría › subcategoría (orden del catálogo,
  "Sin categoría" al final), un título por producto ("#12 · Polera básica") y
  sus variantes por color y talla (XXS…XXL; las numéricas al final), con una
  fila vacía entre productos. Franjas y títulos no tienen ID: se ignoran al subir
  "Stock bodega principal" = depósito físico de la central (igual que en la plantilla de envío)

POST /variants/import-stock?dryRun=true|false     multipart/form-data, campo "file" (.xlsx, máx. 5 MB)
```

- Se leen solo las columnas **`ID variante`** y **`Cantidad a ingresar`**,
  buscadas por su encabezado (en las primeras 10 filas: la plantilla lo
  tiene en la 1; las descargadas antes del 23/10, que traían buscador, en
  la 3 — se siguen pudiendo subir). Las demás se
  pueden borrar o reordenar. Se lee la primera hoja.
- **Todo o nada**: con un solo error no se graba nada.
- `dryRun=true` valida y devuelve el resumen **sin grabar** (vista previa).
  Para confirmar se reenvía el mismo archivo con `dryRun=false` (u omitido).
- ⚠️ `dryRun` acepta **solo `true` o `false`**: cualquier otro valor (`1`,
  `TRUE`, `yes`, vacío) es un `400` — así una vista previa mal armada nunca
  graba de verdad.
- `?branchId=` se **ignora** (como en `addstock`): no hace falta quitarlo si
  el front lo agrega con el selector de sucursal.
- Una variante repetida en varias filas se **suma** (y sale en `warnings`).
- ⚠️ Importar dos veces el mismo archivo **duplica** el stock: el backend no
  detecta archivos repetidos. En el front: **deshabilitar "Confirmar"**
  mientras la request está en curso (un doble clic son dos ingresos) y, tras
  un ingreso exitoso, **pedir confirmación** antes de volver a subir un
  archivo con el mismo nombre.

Respuesta `201`:

```json
{
  "dryRun": false,
  "totalUnits": 9,
  "lines": [
    { "rows": [2, 3], "variantId": 10, "product": "Polera", "color": "Azul", "size": "M", "quantity": 7 },
    { "rows": [4], "variantId": 11, "product": "Polera", "color": "Azul", "size": "L", "quantity": 2 }
  ],
  "warnings": ["La variante 10 está en las filas 2, 3: se suman (7)"]
}
```

Errores (`400`):

| Caso | Respuesta |
|---|---|
| Filas con errores | `{ "statusCode": 400, "message": "El archivo tiene errores: no se ingresó nada", "errors": [{ "row": 5, "message": "Falta el ID de variante" }, { "row": 7, "message": "Cantidad inválida: \"1.5\" (debe ser un número entero positivo)" }, { "row": 9, "message": "La variante 999 no existe" }] }` |
| Sin archivo | `Falta el archivo Excel (campo "file")` |
| No es un `.xlsx` | `El archivo no es un Excel (.xlsx) válido` |
| Faltan los encabezados | `La planilla debe tener un encabezado con las columnas "ID variante" y "Cantidad a ingresar" (usa la plantilla correspondiente)` (también si se sube acá una plantilla de envío) |
| Ninguna cantidad | `El archivo no tiene cantidades para ingresar` |
| `dryRun` distinto de `true`/`false` | `400` de validación (`dryRun must be a boolean value`) |

Un archivo de más de 5 MB devuelve `413`.

## Traspasos depósito ↔ piso (ADMIN, SUPERVISOR, MANAGER, CASHIER)

Dentro de **una** tienda. Para mover entre sucursales, ver
[11-central-warehouse-and-branch-transfers.md](11-central-warehouse-and-branch-transfers.md).

```
POST /stock-transfers
{
  "variantId": 1,
  "quantity": 15,
  "direction": "warehouse_to_floor" | "floor_to_warehouse",
  "reason?": "reposición de piso"
}
→ StockTransfer { id, direction, quantity, createdBy: { id, name }, createdAt, ... }

GET /stock-transfers?limit=&page=&branchId=(solo ADMIN/SUPERVISOR)
```
- Si pedís más cantidad de la que hay disponible en el origen,
  `400 Bad Request` — no se hace parcial.
- `floor_to_warehouse` respeta las reservas (de venta y de pedidos): no te
  deja sacar del piso stock que está apartado.
- No aplica a la bodega principal (`?branchId=<bodega>` → `403`).
- Todo traspaso queda auditado (`createdBy`, ahora `{ id, name }`), visible en
  `GET /stock-transfers` y en el kardex de la variante como tipo `traspaso`.

## Dashboards y exports (ADMIN, SUPERVISOR, MANAGER)

```
GET /variants/dashboard/bestsellers?branchId=
GET /variants/dashboard/lowStock?branchId=        (sobre el TOTAL, depósito+piso; acepta la bodega)
GET /variants/export/exel?branchId=               (Excel, stock vendible; en la bodega, su depósito)
GET /variants/export/stock-critico?branchId=      (Excel, sobre el TOTAL; acepta la bodega)
GET /variants/export/transactions/exel?branchId=  (Excel, kardex completo con usuario y ubicación; acepta la bodega)
GET /variants/export/total-sales/exel?branchId=
```
Estos devuelven un archivo (`Content-Disposition: attachment`), no JSON —
si tu frontend los consume, es para disparar una descarga, no para pintar
una tabla.
