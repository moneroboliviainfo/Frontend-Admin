# Productos y variantes: qué es global y qué es por sucursal

## La regla, en una frase

**El producto es global. La variante (color+talla) es global. El stock de
esa variante es por sucursal.** No hay "variante de la sucursal Norte" — es
la misma fila de la DB para todas; lo que cambia según la sucursal es cuánto
stock tiene esa variante ahí (doc backend `06-inventory-and-warehouse.md`: el
stock es un ledger de `transactions`, no una columna).

## Mapa de endpoints del flujo completo (confirmado, no supuesto)

### Crear Producto — Paso 1 (datos)
| Cuándo | Endpoint |
|---|---|
| Montar el paso (selects género/categoría/subcategoría) | `GET /api/categories` — **sin query params**, filtro de género/enabled se hace en el cliente |
| Montar el paso (select marca) | `GET /api/brands` |
| Crear marca nueva | `POST /api/brands` |
| Enviar formulario | `POST /api/products` |

### Crear Producto — Paso 2 (variantes)
| Cuándo | Endpoint |
|---|---|
| Montar el paso (lista de variantes ya creadas) | `GET /api/products/:id` (lee `productColors[]`) |
| Montar el paso (select color) | `GET /api/colors` |
| Click en una variante para editarla (trae "Stock actual") | `GET /api/variants/:id` |
| Subir imágenes/PDFs (antes de crear/actualizar la variante) | `POST /api/multimedia` |
| Borrar un archivo ya subido | `DELETE /api/multimedia` |
| Guardar variante nueva | `POST /api/variants` |
| Guardar variante editada | `PATCH /api/variants/:id` |
| Confirmar "Agregar Stock" | `POST /api/variants/addstock` |
| Confirmar "Quitar Stock" | `POST /api/variants/subtractstock` |

### Editar Producto / Listar Productos
`GET /api/products/:id`, `PATCH /api/products/:id`,
`GET /api/products?limit=&page=&search=`, `DELETE /api/products/:id`.

## Qué NO cambia por sucursal (no tocar)

Todo lo de arriba **excepto** los 6 puntos de la sección siguiente. Crear/
editar producto, categorías, marcas, subir/borrar fotos — todo catálogo
global, sin `branchId`.

## Qué SÍ necesita `branchId` (confirmado con Swagger real, no supuesto)

Ninguno de estos cambia de método ni de path — solo se le agrega `branchId`,
y en **body o query según el endpoint** (no es uniforme, ojo):

| # | Endpoint | `branchId` va en | Archivo actual | ¿Se usa hoy? |
|---|---|---|---|---|
| 1 | `GET /api/variants/{id}` | Query | `variantService.getVariantById` | Sí — al hacer click en una variante para editarla, trae el "Stock actual" |
| 2 | `GET /api/variants` | Query (también acepta `search`, `page`, `limit`) | `variantService.getAllVariants` | Sí, pero en otra pantalla (listado paginado de variantes) |
| 3 | `POST /api/variants/addstock` | Query | `variantService.addStock` | Sí — modal "Agregar Stock" |
| 4 | `POST /api/variants/subtractstock` | Query | `variantService.subtractStock` | Sí — modal "Quitar Stock" |
| 5 | `POST /api/variants` | **Body** | `variantService.createVariant` | Sí — guardar variante nueva (color+talla) |
| 6 | `PATCH /api/variants/{id}` | **Body** | `variantService.updateVariant` | Sí — guardar variante editada |

Confirmado con la respuesta real de `GET /variants?branchId=1` y
`GET /variants/{id}?branchId=1`: cada variante trae `variants[].availableStock`
y `variants[].warehouseStock` **resueltos para la sucursal pedida**.

**Estado actual del código**: `variantService.ts` **no manda `branchId` en
ninguno** de los 6. Es el gap real a cerrar cuando se aborde la Fase 3/5 del
plan. Ver también punto 5 de
[05-pendientes-y-bugs-conocidos.md](05-pendientes-y-bugs-conocidos.md).

### Un endpoint más, confirmado pero sin construir todavía

`GET /api/variants/{id}/movements?branchId=&page=&limit=` — el kardex de una
variante (doc backend 06: `quantity`, `location`, `type`
`ingreso|venta|ajuste|traspaso`, `user`, `orderId`, `stockTransferId`,
`reason`). **No hay ningún service/hook/pantalla que lo llame** — es parte de
la Fase 5 (Pantalla de Inventario), no construida todavía. No es un bug, es
trabajo nuevo.

## El hallazgo importante: `GET /products/:id` NO es lo mismo

Este endpoint (el que ya usa `getVariantsByProduct` para listar variantes de
un producto) **también** devuelve `productColors[].variants[].availableStock`
`/warehouseStock` con números reales — pero:

- El Swagger confirma que **no acepta `branchId`** como parámetro (solo
  `id` en el path).
- Un mismo producto (id 77) devolvió stock ≠ 0 en varias tallas sin que se
  pidiera ninguna sucursal.

Conclusión (no 100% confirmada con el equipo de backend, pero es la
explicación más probable): este endpoint calcula el stock de una forma vieja
/agregada, de antes de que existiera el modelo de sucursales — probablemente
sumando todo, sin filtrar por sucursal. Mientras el negocio tenga una sola
sucursal con stock real, este número "por casualidad" coincide con lo que
devolvería `/variants?branchId=X` de esa sucursal — pero en cuanto haya una
segunda sucursal con stock distinto, va a mostrar un número que no representa
ninguna sucursal en particular.

**Regla práctica**: para cualquier decisión o visualización de stock por
sucursal, la fuente de verdad es `GET /variants` o `GET /variants/:id` con
`branchId`. El stock embebido en `GET /products/:id` no se debe usar para
eso — si se necesita, primero preguntarle al equipo de backend qué calcula
exactamente ese campo ahí.

## Plan para cuando se implemente (no hecho todavía)

1. Agregar `branchId` opcional a los tipos `CreateVariantDto`/`UpdateVariantDto`
   (body) y a `AddStockRequest`/la llamada de `subtractStock` (query), y
   pasarlo en los 6 endpoints de la tabla de arriba — mandarlo solo si el rol
   es ADMIN, usando `useBranchContext().selectedBranchId`.
2. Mostrar `availableStock`/`warehouseStock` en `VariantsList.tsx` (hoy no
   muestra nada de stock).
3. El selector de sucursal para esto **no hace falta crearlo** — ya existe
   global en la navbar (`BranchSwitcher`), solo hay que leer
   `useBranchContext()` en el Paso 2 del flujo de producto.
