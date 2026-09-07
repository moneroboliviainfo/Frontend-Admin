# Inventario: catálogo, stock, bodega y traspasos

## El modelo de stock

No hay una columna "stock" en la variante. El stock es un **ledger**: cada
movimiento (venta, ingreso, ajuste, traspaso) es una fila en `transactions`
con una `quantity` con signo (+ ingreso, − salida). El "stock disponible" se
calcula sumando.

```
stock_vendible(variante, sucursal) =
    SUM(transactions.quantity WHERE location = 'sales_floor')
  − SUM(reservas de stock pendientes y no vencidas)
```

- **Reservas**: al crear una orden (in-store u online) se reserva stock, no
  se descuenta. La reserva expira sola (~25 min) si no se confirma el pago.
- **El descuento real** (una `transaction` negativa) solo pasa al confirmar
  el pago (`SENT`/`PAID`).
- **Cancelar** una orden revierte sus `transactions` de venta (soft-delete),
  restaurando el stock.

## Bodega vs. tienda (piso de venta)

Cada sucursal tiene, conceptualmente, **una bodega**. No es una entidad
separada — es un campo `location` (`warehouse` | `sales_floor`) en cada
`transaction`. Regla física:

- **Todo stock nuevo entra a bodega**, no está a la venta.
- Para que sea vendible, alguien hace un **traspaso** bodega → tienda.
- El **stock vendible** (lo que usa el checkout, el reprice, el catálogo
  público) es **solo `sales_floor`**. El stock en bodega no se puede
  vender hasta que se traspasa.
- Las alertas de stock bajo (`dashboard/lowStock`) sí se calculan sobre el
  **total** (bodega + tienda) — no filtran por ubicación.

## Catálogo de variantes (admin)

```
POST  /variants         (A)      crear color+tallas de un producto, stock inicial → bodega
GET   /variants          (A,M,C)  listar (con stock vendible + stock en bodega)
GET   /variants/:id      (A,M,C)  detalle
PATCH /variants/:id      (A)      editar (agregar tallas nuevas → también entran a bodega)
```
Las respuestas de listado/detalle traen `availableStock` (vendible, en
tienda) **y** `warehouseStock` (en bodega) por variante — mostrá ambos si
tu UI de inventario los necesita, no asumas que `availableStock` es "todo lo
que hay".

## Consultar stock

```
GET /variants/stock/:id?branchId=          (A,M,C) → número, solo lo vendible
GET /variants/:id/movements?branchId=      (A,M,C) → kardex paginado
```
Cada fila del kardex trae: `quantity`, `location`, `type` (`ingreso` |
`venta` | `ajuste` | `traspaso`), `user` (quién lo hizo, o `null` si fue una
venta — ahí el "quién" es la orden), `orderId`, `stockTransferId`, `reason`.

## Ingresar / dar de baja stock (ADMIN + MANAGER, no CASHIER)

```
POST /variants/addstock
{ "variantId": 1, "quantity": 20 }
→ entra SIEMPRE a bodega (no hay forma de mandarlo directo a tienda)

POST /variants/subtractstock
{ "variantId": 1, "quantity": -3, "reason": "producto dañado", "location?": "warehouse" | "sales_floor" }
→ default: descuenta de bodega. Mandá location: "sales_floor" para dar de
  baja algo que ya estaba en tienda.
```
`branchId` **no va en el body** — se resuelve solo (sucursal del manager, o
`?branchId=` si sos ADMIN).

## Traspasos bodega ↔ tienda (ADMIN + MANAGER + CASHIER)

```
POST /stock-transfers
{
  "variantId": 1,
  "quantity": 15,
  "direction": "warehouse_to_floor" | "floor_to_warehouse",
  "reason?": "reposición de piso"
}
→ StockTransfer { id, direction, quantity, createdBy, createdAt, ... }

GET /stock-transfers?limit=&page=&branchId=(solo ADMIN)
```
- Si pedís más cantidad de la que hay disponible en el origen,
  `400 Bad Request` — no se hace parcial.
- `floor_to_warehouse` respeta las reservas pendientes: no te deja sacar de
  tienda stock que ya está reservado por una orden en curso.
- Todo traspaso queda auditado (`createdBy`), visible en `GET /stock-transfers`
  y en el kardex de la variante como tipo `traspaso`.

## Dashboards y exports (ADMIN + MANAGER)

```
GET /variants/dashboard/bestsellers?branchId=
GET /variants/dashboard/lowStock?branchId=        (sobre el TOTAL, bodega+tienda)
GET /variants/export/exel?branchId=               (Excel, stock vendible)
GET /variants/export/stock-critico?branchId=      (Excel, sobre el TOTAL)
GET /variants/export/transactions/exel?branchId=  (Excel, kardex completo con usuario y ubicación)
GET /variants/export/total-sales/exel?branchId=
```
Estos devuelven un archivo (`Content-Disposition: attachment`), no JSON —
si tu frontend los consume, es para disparar una descarga, no para pintar
una tabla.
