# Roles y permisos

## Los 4 roles de staff

`ADMIN | SUPERVISOR | MANAGER | CASHIER` — **planos, no jerárquicos**. Un
endpoint que solo lista `MANAGER` rechaza a un ADMIN, aunque "en teoría" el
admin pueda todo. Cada endpoint declara explícitamente qué roles entran. Si el
frontend oculta un botón/sección por rol, tiene que reflejar exactamente esta
tabla, no asumir jerarquía.

| Rol | Quién es | Sucursal |
|---|---|---|
| `admin` | Super administrador (dueño) | Ninguna fija: elige con `?branchId=` |
| `supervisor` | Persona de confianza, por debajo del admin | Ninguna fija: elige con `?branchId=` |
| `manager` | Encargado de sucursal | La suya |
| `cashier` | Cajero | La suya |

**SUPERVISOR = ADMIN, salvo usuarios.** Está listado junto a ADMIN en
**todos** los endpoints del admin, excepto crear y editar usuarios
(`POST /users/admin`, `POST /users/staff`, `PATCH /users/:id`), que siguen
siendo solo ADMIN. Puede ver usuarios, pero por lo mismo **no resetea
passwords, no deshabilita a nadie ni cambia de sucursal a un empleado**
(todo eso es `PATCH /users/:id`). En las tablas de estos docs, donde dice
**A** o ADMIN, entra también SUPERVISOR salvo en esos tres endpoints.

## La política de fondo

- **Catálogo / configuración** (productos, categorías, descuentos, marcas,
  colores, tallas, sucursales, clientes admin, SIAT, archivos) → **ADMIN +
  SUPERVISOR**. Usuarios: ver ADMIN + SUPERVISOR, crear/editar solo ADMIN.
- **Ventas** (crear/confirmar/cancelar/editar órdenes, caja diaria,
  buscar/crear billing) → **MANAGER + CASHIER**. **ADMIN y SUPERVISOR no
  operan ventas, solo consultan** (listas, detalle, exports). Es la inversión
  respecto al resto del sistema. **Excepción: facturar una venta** — ADMIN y
  SUPERVISOR sí pueden (cualquier venta, desde la sucursal de la venta).
- **Inventario de lectura** (catálogo de variantes, stock, movimientos,
  disponibilidad por sucursal) → todos los roles (el cajero lo necesita para
  armar el carrito del POS).
- **Ingresos de stock** (`addstock`, alta de variantes) → **ADMIN +
  SUPERVISOR**, y siempre a la **bodega principal**. El MANAGER ya no carga
  stock: le llega por envíos desde la bodega.
- **Bajas** (`subtractstock`) → **solo ADMIN + SUPERVISOR** (desde el 26/10 el MANAGER ya no; el CASHIER nunca).
  **Ajuste positivo** (sobrante de conteo en una tienda) → ADMIN + SUPERVISOR.
- **Traspasos depósito ↔ piso** (`/stock-transfers`) → todos.
- **Traslados entre sucursales** (`/branch-transfers`): la bodega envía
  (ADMIN + SUPERVISOR); las tiendas piden, despachan y reciben (MANAGER +
  CASHIER); faltantes y pérdidas los resuelven ADMIN + SUPERVISOR. Ver
  [11-central-warehouse-and-branch-transfers.md](11-central-warehouse-and-branch-transfers.md).
- **Storefront público** (`web-page/*`, `searchs`, `cart`, `auth`,
  `payments/*`) → sin rol, o `@Auth()` (cualquier customer autenticado).

## Cómo se resuelve la sucursal — `@GetBranchId()`

Casi todo lo operativo (ventas, caja, inventario) es **por sucursal**. La
sucursal nunca se manda "a mano" en el body salvo excepciones puntuales —
el backend la resuelve así:

1. Si el usuario logueado tiene una sucursal fija (`user.branch`, o sea
   MANAGER/CASHIER) → usa esa. **No hace falta ni se puede mandar otra.**
2. Si no tiene sucursal fija (ADMIN/SUPERVISOR) → toma `?branchId=` de la
   query string.
3. Si no hay ninguna de las dos → `403 La sucursal no pudo ser determinada`.

Consecuencia práctica: **ADMIN y SUPERVISOR necesitan `?branchId=` en la
query** para casi cualquier endpoint de lectura por sucursal (`GET /orders`,
`GET /variants`, `GET /dailyCash`, etc.). Un MANAGER/CASHIER nunca lo manda —
siempre ve/opera su propia sucursal, y no puede forzar otra (el backend lo
ignora o directamente el endpoint no le da la opción).

**La bodega principal no es una sucursal para estos endpoints**: con
`?branchId=<id de la bodega>` responden
`403 La bodega principal no opera como sucursal: esta acción no está disponible para ella`.
Solo la aceptan los de stock marcados con 🏭 en la matriz de abajo.

**Las sucursales "solo facturación"** (`type: "billing_only"`, ver
[07](07-branches-daily-cash-billing.md)) tampoco operan como sucursal: su
staff (y un admin con `?branchId=` de una de ellas) recibe
`403 Esta sucursal es solo de facturación: esta acción no está disponible para ella`
en todo lo de stock, ventas, caja y traslados. Solo usan los endpoints SIAT
(`GET /facturacion/facturacion` sí las acepta).

Para las acciones de venta por `:id` (confirmar, cancelar, editar una orden,
cerrar caja, facturar), el backend además **valida que ese recurso pertenezca
a la sucursal del usuario** — si un cajero intenta operar sobre una orden de
otra sucursal, recibe `404`.

## Matriz completa

A = ADMIN, S = SUPERVISOR, M = MANAGER, C = CASHIER.

### Ventas (`/orders`, `/dailyCash`)

| Endpoint | Roles | Nota |
|---|---|---|
| `POST /orders/in-store` | M, C | crear venta en tienda (acepta `branchTransferId?` para retirar un pedido) |
| `POST /orders/confirm/:id` | M, C | confirmar pago CASH/CARD manual |
| `POST /orders/cancel/:id` | M, C | anular venta |
| `POST /orders/cancel-for-edit/:id` | M, C | paso 1 de editar una venta |
| `PATCH /orders/:id` | M, C | paso 2 de editar (nuevos items) |
| `PUT /orders/change-status/:id` | M, C | cambiar estado PAID → SENT (envío online) |
| `GET /orders` | A, S, M, C | lista |
| `GET /orders/:id` | A, S, M, C | detalle — A/S ven cualquiera, M/C solo la suya |
| `GET /orders/export/exel` | A, S, M | reporte Excel |
| `POST /orders/reprice` | público | sin `@Auth`, a propósito (checkout guest) |
| `POST /orders/:orderId/facturar` | A, S, M, C | facturación manual (y refacturar ANULADA/RECHAZADA). M/C solo ventas de su sucursal; A/S cualquiera, sin `?branchId=` (factura desde la sucursal de la venta) |
| `POST /orders/:orderId/facturar-contingencia` | A, S, M, C | ídem, modo contingencia SIAT |
| `POST /dailyCash/open` | M, C | abrir caja |
| `POST /dailyCash/:id/close` | M, C | cerrar caja |
| `GET /dailyCash/current` | A, S, M, C | caja abierta actual |
| `GET /dailyCash` | A, S, M | historial |

### Inventario (`/variants`, `/stock-transfers`)

🏭 = acepta `?branchId=<bodega principal>`.

| Endpoint | Roles | Nota |
|---|---|---|
| `POST /variants` | A, S | alta de catálogo (color+tallas), stock inicial → bodega principal |
| `PATCH /variants/:id` | A, S | editar variante (tallas nuevas → bodega principal) |
| `GET /variants` 🏭 | A, S, M, C | listar (con stock), paginado por color (POS) |
| `GET /variants/products` 🏭 | A, S, M, C | listar (con stock), paginado por producto (bodega principal) |
| `GET /variants/:id` 🏭 | A, S, M, C | detalle con stock |
| `GET /variants/stock/:id` 🏭 | A, S, M, C | solo el número de stock vendible |
| `GET /variants/:id/movements` 🏭 | A, S, M, C | kardex de una variante |
| `GET /variants/branch-stock/:variantId` | A, S, M, C | disponibilidad en cada tienda (para pedir); `?branchId=` opcional = solo esa tienda, cualquier rol puede pasar cualquiera |
| `GET /variants/branch-stock/product-color/:id` | A, S, M, C | ídem, todas las tallas |
| `POST /variants/addstock` | A, S | ingresa stock **al depósito de la bodega principal** (sin sucursal) |
| `POST /variants/subtractstock` 🏭 | A, S | baja de stock (con `?branchId=`) |
| `POST /variants/subtractstock/bulk` 🏭 | A, S | baja de varias variantes a la vez, solo del depósito de la bodega (sin `?branchId=`) |
| `POST /variants/positive-adjustment` | A, S | sobrante de conteo en una tienda (nota obligatoria) |
| `GET /variants/dashboard/bestsellers` | A, S, M | |
| `GET /variants/dashboard/lowStock` 🏭 | A, S, M | |
| `GET /variants/export/exel` 🏭, `/export/stock-critico` 🏭, `/export/transactions/exel` 🏭 | A, S, M | Excel |
| `GET /variants/export/total-sales/exel` | A, S, M | Excel |
| `POST /stock-transfers` | A, S, M, C | mover stock depósito ↔ piso dentro de una tienda |
| `GET /stock-transfers` | A, S, M, C | historial de traspasos |

### Bodega principal y traslados entre sucursales

| Endpoint | Roles | Nota |
|---|---|---|
| `GET /central-warehouse` | A, S | `{ id, name }` de la bodega |
| `PATCH /central-warehouse` | A, S | renombrar |
| `POST /branch-transfers/central-dispatch` | A, S | envío bodega → tienda |
| `POST /branch-transfers/replenishments` | M, C | pedir variantes a la bodega (reposición; agrega a la abierta de la tienda) |
| `DELETE /branch-transfers/replenishments/:id/items/:itemId` | M, C | quitar una variante de la reposición pendiente de su tienda |
| `POST /branch-transfers/replenishments/:id/dispatch` | A, S | atender (elegir cantidades) o rechazar (todo en 0) una reposición |
| `POST /branch-transfers/returns` | M, C | devolver stock de mi tienda a la bodega (depósito o piso, nace en camino — ver [16](16-central-returns.md)) |
| `POST /branch-transfers/returns/:id/receive` | A, S | la central recibe una devolución (entra al depósito de la bodega) |
| `POST /branch-transfers/requests` | M, C | pedido de mi tienda a otra (con o sin cobro) |
| `POST /branch-transfers/requests/quote` | M, C | cotizar un pedido cobrado (no guarda nada) |
| `POST /branch-transfers/requests/:id/refund` | M, C | devolver al cliente lo pendiente del anticipo (caja abierta) |
| `POST /payments/generate-qr/request/:id` | M, C | QR del anticipo de un pedido de mi tienda |
| `POST /branch-transfers/dispatch/:id` | M, C | la tienda origen despacha un pedido |
| `POST /branch-transfers/receive/:id` | M, C | la tienda destino recibe (las devoluciones a la bodega, no: `returns/:id/receive`) |
| `POST /branch-transfers/cancel/:id` | A, S, M, C | M/C: solo pedidos de su tienda antes del despacho, su reposición pendiente o su devolución en camino |
| `POST /branch-transfers/mark-lost/:id` | A, S | no llegó nada |
| `POST /branch-transfers/review/:id` | A, S | resolver faltantes |
| `POST /branch-transfers/pickup/:id` | M, C | retiro manual / "no retirado" |
| `GET /branch-transfers` | A, S, M, C | M/C ven solo los de su tienda |
| `GET /branch-transfers/:id` | A, S, M, C | M/C solo si su tienda es origen o destino |
| `GET /branch-transfers/pending-count` | A, S, M, C | badges |
| `GET /branch-transfers/pickup-stats` | A, S | estadística de retiro |

Detalle en [11-central-warehouse-and-branch-transfers.md](11-central-warehouse-and-branch-transfers.md),
para el cobro [13-prepaid-branch-requests.md](13-prepaid-branch-requests.md) y,
para reposiciones, [15-replenishments-and-transfer-stages.md](15-replenishments-and-transfer-stages.md).
Cada traslado trae `allowedActions`: las acciones que **ese usuario** puede
hacer ahora (ya filtradas por rol y sucursal).

### Configuración del sistema (`/settings`)

| Endpoint | Roles | Notas |
|---|---|---|
| `GET /settings` | A, S, M, C | plazos de los pedidos entre sucursales |
| `PATCH /settings` | A, S | editarlos (aplican a los pedidos que se reciban desde ahora) |

### Billing / facturación

| Endpoint | Roles | Nota |
|---|---|---|
| `GET /billing/:ci` | M, C | lookup por CI para autocompletar en el POS |
| `POST /billing` | M, C | crear/actualizar registro de facturación |
| SIAT de facturas (`/facturacion`, `/paquetes`) | A, S, M, C | M/C solo su sucursal SIAT (ver abajo) |
| `/catalogos` (todo: `sincronizacion`, `parametricas`, `listas`, `fecha-hora`) | A, S, M, C | para armar la factura; sin límite por sucursal (los catálogos son de todo el NIT) |
| `POST /codigos/verificar-nit` | A, S, M, C | validar el NIT del cliente; sin límite por sucursal |
| `GET /cafc`, `GET /cafc/:id` | A, S, M, C | elegir el `cafc` al facturar en contingencia; sin límite por sucursal (los CAFC son de toda la empresa) |
| `/operaciones/evento-significativo` (registrar, listar, consultar) | A, S, M, C | contingencia; M/C solo su sucursal SIAT |
| `POST /cafc`, `PATCH /cafc/:id`, resto de `/codigos` (CUIS/CUFD), `/operaciones/punto-venta*` | A, S | |

### Catálogo / configuración — ADMIN + SUPERVISOR

`products`, `categories`, `subcategories`, `sizes`, `colors`, `brands`,
`discounts`, `outfits`, `places`, `sliders`, `banners` (escritura),
`branches`, `customers` (admin), `files` (`/multimedia`).
Endpoint por endpoint, con roles y notas: ver
[09-admin-catalog-crud.md](09-admin-catalog-crud.md).

**Usuarios** (`/users`):
| Endpoint | Roles |
|---|---|
| `POST /users/admin` (crea ADMIN o SUPERVISOR) | A |
| `POST /users/staff` (crea MANAGER o CASHIER) | A |
| `PATCH /users/:id` | A |
| `GET /users`, `GET /users/:id` | A, S |
| `PATCH /users/me/password` | cualquier staff logueado |

Excepciones dentro de ese bloque que **no** son de admin:
- `PATCH /users/me/password` — `@Auth()` sin roles, cualquier staff logueado
  cambia su propia password.
- `GET /banners`, `GET /banners/:id`, `GET /sliders`, `GET /sliders/:id`,
  `GET /advertisements`, `GET /shipments`, `GET /multimedia/upload/:file` —
  público, sin `@Auth`.

### SIAT de bajo nivel

Los endpoints directos contra el SIN (no `/orders/:id/facturar`). Ver
[10-siat-low-level.md](10-siat-low-level.md).

- **En todo SIAT la sucursal se elige por `branchId`**, con la misma regla que
  el resto del sistema: MANAGER/CASHIER usan siempre la suya; ADMIN/SUPERVISOR
  mandan `?branchId=` (sin él → `403`). El `codigoSucursal` SIAT lo saca el
  backend de los datos SIAT de la sucursal (sin datos SIAT → `403`); ya no se
  manda. `codigoPuntoVenta` es opcional (por defecto `0`).
- `facturacion`, `paquetes` → **todos los roles**. MANAGER/CASHIER quedan
  limitados a su sucursal: una factura / paquete / evento de otra sucursal da
  `404`.
- `catalogos` (incluida `sincronizacion`) y `POST /codigos/verificar-nit` →
  **todos los roles** (los catálogos del SIN son los mismos para todo el NIT;
  se sincronizan con el CUIS de la sucursal del usuario).
- `GET /cafc` y `GET /cafc/:id` → **todos los roles** (leer el `cafc` para
  facturar en contingencia).
- `operaciones/evento-significativo` (registrar, listar, consultar) →
  **todos los roles**, M/C limitados a su sucursal SIAT como `facturacion`.
- Crear/editar CAFC, el resto de `codigos` (CUIS/CUFD) y los puntos de venta
  de `operaciones` → **ADMIN + SUPERVISOR**.

### Storefront público (sin rol)

`web-page/*` (products, categories, subcategories, discounts, sizes,
outfits, places, branches, customers* — este último es `@Auth()` customer),
`searchs`, `cart`, `auth/*`, `payments/qr/*`, `payments/card/*`,
`advertisements` (GET), `shipments` (GET), `orders/reprice`, `shipping/rates`.

### Solo customer autenticado (`@Auth()`)

`addresses/*`, `web-page/customers/*`, `web-page/orders/online`.
