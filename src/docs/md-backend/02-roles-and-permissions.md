# Roles y permisos

## Los 3 roles de staff

`ADMIN | MANAGER | CASHIER` — **planos, no jerárquicos**. Un endpoint que
solo lista `MANAGER` rechaza a un ADMIN, aunque "en teoría" el admin pueda
todo. Cada endpoint declara explícitamente qué roles entran. Si el frontend
oculta un botón/sección por rol, tiene que reflejar exactamente esta tabla,
no asumir jerarquía.

## La política de fondo

- **Catálogo / configuración** (productos, categorías, descuentos, marcas,
  colores, tallas, sucursales, usuarios, clientes admin, SIAT, archivos) →
  **ADMIN**.
- **Ventas** (crear/confirmar/cancelar/editar órdenes, caja diaria, facturar
  a mano, buscar/crear billing) → **MANAGER + CASHIER**. **El ADMIN no opera
  ventas, solo consulta** (listas, detalle, exports). Es la inversión
  respecto al resto del sistema.
- **Inventario de lectura** (catálogo de variantes, stock, movimientos) →
  ADMIN + MANAGER + CASHIER (el cajero lo necesita para armar el carrito del
  POS).
- **Inventario de escritura** (altas/bajas de stock) → ADMIN + MANAGER (el
  cajero no ajusta inventario, solo lo mueve entre bodega y tienda —
  siguiente punto).
- **Traspasos bodega↔tienda** → ADMIN + MANAGER + CASHIER.
- **Storefront público** (`web-page/*`, `searchs`, `cart`, `auth`,
  `payments/*`) → sin rol, o `@Auth()` (cualquier customer autenticado).

## Cómo se resuelve la sucursal — `@GetBranchId()`

Casi todo lo operativo (ventas, caja, inventario) es **por sucursal**. La
sucursal nunca se manda "a mano" en el body salvo excepciones puntuales —
el backend la resuelve así:

1. Si el usuario logueado tiene una sucursal fija (`user.branch`, o sea
   MANAGER/CASHIER) → usa esa. **No hace falta ni se puede mandar otra.**
2. Si no tiene sucursal fija (ADMIN) → toma `?branchId=` de la query string.
3. Si no hay ninguna de las dos → `403 Forbidden`.

Consecuencia práctica: **un ADMIN necesita `?branchId=` en la query** para
casi cualquier endpoint de lectura por sucursal (`GET /orders`,
`GET /variants`, `GET /dailyCash`, etc.). Un MANAGER/CASHIER nunca lo manda —
siempre ve/opera su propia sucursal, y no puede forzar otra (el backend lo
ignora o directamente el endpoint no le da la opción).

Para las acciones de venta por `:id` (confirmar, cancelar, editar una orden,
cerrar caja, facturar), el backend además **valida que ese recurso pertenezca
a la sucursal del usuario** — si un cajero intenta operar sobre una orden de
otra sucursal, recibe `404`.

## Matriz completa

### Ventas (`/orders`, `/dailyCash`)

| Endpoint | Roles | Nota |
|---|---|---|
| `POST /orders/in-store` | M, C | crear venta en tienda |
| `POST /orders/confirm/:id` | M, C | confirmar pago CASH/CARD manual |
| `POST /orders/cancel/:id` | M, C | anular venta |
| `POST /orders/cancel-for-edit/:id` | M, C | paso 1 de editar una venta |
| `PATCH /orders/:id` | M, C | paso 2 de editar (nuevos items) |
| `PUT /orders/:id` | M, C | cambiar estado (envío online) |
| `GET /orders` | A, M, C | lista |
| `GET /orders/:id` | A, M, C | detalle — ADMIN ve cualquiera, M/C solo la suya |
| `GET /orders/export/exel` | A, M | reporte Excel |
| `POST /orders/reprice/:token` | público | sin `@Auth`, a propósito (checkout guest) |
| `POST /orders/:orderId/facturar` | M, C | facturación manual |
| `POST /orders/:orderId/facturar-contingencia` | M, C | ídem, modo contingencia SIAT |
| `POST /dailyCash/open` | M, C | abrir caja |
| `POST /dailyCash/:id/close` | M, C | cerrar caja |
| `GET /dailyCash/current` | A, M, C | caja abierta actual |
| `GET /dailyCash` | A, M | historial |

### Inventario (`/variants`, `/stock-transfers`)

| Endpoint | Roles | Nota |
|---|---|---|
| `POST /variants` | A | alta de catálogo (color+tallas) |
| `PATCH /variants/:id` | A | editar variante |
| `GET /variants` | A, M, C | listar (con stock) |
| `GET /variants/:id` | A, M, C | detalle con stock |
| `GET /variants/stock/:id` | A, M, C | solo el número de stock vendible |
| `GET /variants/:id/movements` | A, M, C | kardex de una variante |
| `POST /variants/addstock` | A, M | ingresa stock **a bodega** |
| `POST /variants/subtractstock` | A, M | baja/ajuste de stock |
| `GET /variants/dashboard/bestsellers` | A, M | |
| `GET /variants/dashboard/lowStock` | A, M | |
| `GET /variants/export/*` | A, M | Excel |
| `POST /stock-transfers` | A, M, C | mover stock bodega↔tienda |
| `GET /stock-transfers` | A, M, C | historial de traspasos |

### Billing / facturación

| Endpoint | Roles | Nota |
|---|---|---|
| `GET /billing/:ci` | M, C | lookup por CI para autocompletar en el POS |
| `POST /billing` | M, C | crear/actualizar registro de facturación |
| SIAT (`/facturacion`, `/cafc`, `/catalogos`, `/codigos`, `/paquetes`, `/operaciones`) | A | todo lo de bajo nivel SIAT es admin-only |

### Catálogo / configuración — todo ADMIN

`products`, `categories`, `subcategories`, `sizes`, `colors`, `brands`,
`discounts`, `outfits`, `places`, `sliders`, `banners` (escritura),
`branches`, `users`, `customers` (admin), `files` (`/multimedia`).
Endpoint por endpoint, con roles y notas: ver
[09-admin-catalog-crud.md](09-admin-catalog-crud.md).

Excepciones dentro de ese bloque que **no** son ADMIN-only:
- `PATCH /users/me/password` — `@Auth()` sin roles, cualquier staff logueado
  cambia su propia password.
- `GET /banners`, `GET /banners/:id`, `GET /sliders`, `GET /sliders/:id`,
  `GET /advertisements`, `GET /shipments`, `GET /multimedia/upload/:file` —
  público, sin `@Auth`.

### SIAT de bajo nivel — todo ADMIN

`catalogos`, `codigos`, `operaciones`, `paquetes`, `cafc`, `facturacion`
(los endpoints directos contra el SIN, no `/orders/:id/facturar`). Ver
[10-siat-low-level.md](10-siat-low-level.md).

### Storefront público (sin rol)

`web-page/*` (products, categories, subcategories, discounts, sizes,
outfits, places, branches, customers* — este último es `@Auth()` customer),
`searchs`, `cart`, `auth/*`, `payments/qr/*`, `payments/card/*`,
`advertisements` (GET), `shipments` (GET), `orders/reprice/:token`.

### Solo customer autenticado (`@Auth()`)

`addresses/*`, `web-page/customers/*`, `web-page/orders/online`.
