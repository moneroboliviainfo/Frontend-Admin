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
POST /branch-transfers/receive/:id             → depósito de la tienda
POST /stock-transfers (warehouse_to_floor)     → piso de la tienda (recién ahí se vende)
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
GET   /variants          (A,S,M,C) listar (con stock)
GET   /variants/:id      (A,S,M,C) detalle
PATCH /variants/:id      (A,S)     editar (tallas nuevas → también a la bodega principal)
```
(A = ADMIN, S = SUPERVISOR, M = MANAGER, C = CASHIER; ver [02](02-roles-and-permissions.md).)

El `branchId` del body de `POST /variants` está **deprecado e ignorado**: el
stock inicial entra siempre a la bodega principal.

Las respuestas de listado/detalle traen, por variante:
- `availableStock`: vendible (piso − reservas de venta − reservas de pedidos);
- `warehouseStock`: en depósito (todavía no vendible);
- `inTransitStock`: en camino hacia la sucursal;
- `centralWarehouseStock`: en la bodega principal (ver abajo).

Mostrá los que tu UI de inventario necesite; no asumas que
`availableStock` es "todo lo que hay". Con `?branchId=<bodega>`,
`availableStock` es siempre 0: su stock es `warehouseStock`.

**Vista general (sin sucursal)** — `GET /products/:id` y `GET /outfits/:id`
(admin) no filtran por sucursal: suman todas. Ahí los cuatro campos **no se
pisan** y sumados dan el total. Con `?branchId=X`, `centralWarehouseStock`
sigue mostrando la bodega principal (cuánto queda por despachar) — no lo
sumes al stock de X; con `X = bodega` es el mismo número que
`warehouseStock`.

| Campo | Vista general | Con `?branchId=X` (`/variants`) |
|---|---|---|
| `availableStock` | piso de todas las tiendas − reservas | piso de X − reservas |
| `warehouseStock` | depósitos de las **tiendas** (sin la bodega principal) | depósito de X (si X es la bodega: su stock) |
| `centralWarehouseStock` | **solo** la bodega principal | **igual**: la bodega principal (no depende de X) |
| `inTransitStock` | en camino hacia cualquier tienda | en camino hacia X |

## Consultar stock

```
GET /variants/stock/:id?branchId=                    (A,S,M,C) → número, solo lo vendible
GET /variants/:id/movements?branchId=                (A,S,M,C) → kardex paginado
GET /variants/branch-stock/:variantId                (A,S,M,C) → disponibilidad en cada tienda
GET /variants/branch-stock/product-color/:id         (A,S,M,C) → ídem, todas las tallas
```

**Kardex** — cada fila trae: `quantity`, `location`, `type`, `user` (nombre
de quién lo hizo, o `null`), `orderId`, `stockTransferId`, `branchTransferId`,
`counterpartBranch` (`{ id, name }`, la otra sucursal de un traslado),
`reason`.

| `type` | Qué es |
|---|---|
| `ingreso` | ingreso de stock (bodega principal) |
| `venta` | venta confirmada |
| `ajuste` | baja (cantidad negativa) o ajuste positivo (positiva), con `reason` |
| `traspaso` | depósito ↔ piso dentro de la tienda |
| `envio_bodega`, `salida_pedido`, `envio_anulado`, `pedido_anulado`, `recepcion`, `aparecio_en_destino`, `aparecio_en_origen` | traslados entre sucursales (ver [11 §8](11-central-warehouse-and-branch-transfers.md)) |

**Disponibilidad por sucursal** (`branch-stock`) — una fila por tienda
activa (sin la bodega, **incluida la propia**): `salesFloor`, `warehouse`,
`reserved`, `heldForRequests`, `availableToRequest` (lo que se le puede pedir
a esa tienda) e `inTransit`. Es lo que usa el POS para "buscar en otras
sucursales".

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
