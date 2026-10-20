# Docs para el frontend — índice

Estos documentos existen para que quien (o quien-IA) desarrolla el frontend
entienda los flujos del backend sin tener que leer el código NestJS. Son un
**mapa**, no la fuente de verdad — antes de integrar un endpoint, confirmá el
shape exacto de request/response en Swagger.

## Convenciones base

- **Prefijo global**: todas las rutas van bajo `/api`. Ej: `POST /api/auth/login`,
  `GET /api/orders`. En estos docs se omite el prefijo por brevedad — agregalo
  siempre.
- **Swagger vivo**: `GET /api/docs` — ahí están los DTOs y responses exactos
  generados desde el código. Usalo para confirmar campos, no adivines.
- **Auth**: header `Authorization: Bearer <token>` en todo endpoint que no sea
  explícitamente público. Ver [01-auth-and-sessions.md](01-auth-and-sessions.md).
- **Validación estricta**: `whitelist: true` + `forbidNonWhitelisted: true` — si
  mandás un campo que el DTO no declara, la request entera falla con 400. No
  mandes campos "por las dudas".
- **Paginación**: los endpoints que paginan devuelven
  `{ data: T[], meta: { total, page, lastPage, limit, offset, hasNextPage, hasPreviousPage } }`.
  Se pide con query params `?limit=10&page=1&search=texto`.
- **Errores**: excepciones HTTP estándar de Nest
  (`{ statusCode, message, error }`). Conflictos de unicidad/FK en DB se
  mapean a `409 Conflict`.

## ¿Qué cambió últimamente?

Empezá por [14-changelog-2026-10.md](14-changelog-2026-10.md): los cambios
del 9 y 10 de octubre de 2026 (pedidos entre sucursales cobrados al pedir,
cobro por QR, devoluciones, configuración de plazos, desglose del cierre de
caja), qué se rompe y el checklist del front; después, la actualización
del 18 de octubre (stock de la bodega principal separado en
`centralWarehouseStock`, storefront solo con `availableStock`) y la del
**19 de octubre** (reposiciones, `stage`/`allowedActions` en los traslados,
listado de facturas por sucursal). Los anteriores, del 28 al 30
de septiembre (rol supervisor, bodega principal, envíos y pedidos entre
sucursales, facturas), están en [12-changelog-2026-09.md](12-changelog-2026-09.md).

## Índice

| Archivo | Contenido |
|---|---|
| [01-auth-and-sessions.md](01-auth-and-sessions.md) | Login de staff, login/registro de customer (Google, guest, subscribe), sesión única, roles a alto nivel |
| [02-roles-and-permissions.md](02-roles-and-permissions.md) | Matriz completa de roles por endpoint, `@GetBranchId()`, cómo se resuelve la sucursal |
| [03-storefront-catalog.md](03-storefront-catalog.md) | Catálogo público (`web-page/*`): productos, categorías, descuentos, sucursales, banners |
| [04-cart-checkout-payments.md](04-cart-checkout-payments.md) | Carrito → reprice → crear orden (online/in-store), pagos QR y tarjeta |
| [05-orders-lifecycle-and-pos.md](05-orders-lifecycle-and-pos.md) | Máquina de estados de la orden, flujo completo del POS, confirmar/cancelar/editar |
| [06-inventory-and-warehouse.md](06-inventory-and-warehouse.md) | Modelo de stock, bodega vs tienda, traspasos, kardex, dashboards |
| [07-branches-daily-cash-billing.md](07-branches-daily-cash-billing.md) | Sucursales, caja diaria, datos de facturación, SIAT (nivel orden) |
| [08-customer-account.md](08-customer-account.md) | Cuenta del cliente en el storefront: direcciones, mis órdenes |
| [09-admin-catalog-crud.md](09-admin-catalog-crud.md) | CRUD administrativo completo: categories, subcategories, sizes, colors, brands, places, outfits, products, discounts, banners, sliders, shipments, files, users, customers |
| [10-siat-low-level.md](10-siat-low-level.md) | Integración SIAT de bajo nivel (catálogos, códigos CUIS/CUFD, operaciones, paquetes, cafc, facturación directa) — panel de soporte, no lo usa el flujo de venta normal |
| [11-central-warehouse-and-branch-transfers.md](11-central-warehouse-and-branch-transfers.md) | Bodega principal, envíos de la bodega a las tiendas, pedidos entre sucursales (reserva, retiro, integración con el POS), faltantes y revisión |
| [12-changelog-2026-09.md](12-changelog-2026-09.md) | Qué cambió (28–30/09/2026), qué rompe y checklist del front |
| [13-prepaid-branch-requests.md](13-prepaid-branch-requests.md) | Pedidos entre sucursales cobrados al pedir: configuración de plazos, cotizar y cobrar (efectivo, tarjeta, QR), devoluciones, venta de retiro con anticipo, anticipo perdido, caja |
| [14-changelog-2026-10.md](14-changelog-2026-10.md) | Qué cambió (9–10/10, 18/10 y 19/10/2026), qué rompe y checklist del front |
| [15-replenishments-and-transfer-stages.md](15-replenishments-and-transfer-stages.md) | Reposiciones (la tienda pide a la bodega, la central atiende), marca `pendingReplenishment`, y `stage`/`stageLabel`/`allowedActions` de todos los traslados; pantallas sugeridas en dos menús |

Este índice cubre **todos** los controllers del backend — si un endpoint no
aparece en ninguno de estos archivos, no existe (o es nuevo y este doc
quedó desactualizado: avisá).

## El negocio, en una frase

Retail de ropa boliviano con tienda **online** y **sucursales físicas (POS)**.
El mismo backend sirve ambos canales — muchos endpoints se comportan distinto
según `OrderType` (`in_store` | `online`). Hay facturación electrónica
obligatoria (SIAT) integrada al flujo de venta. Todo el stock nuevo entra a
una **bodega principal** y de ahí se envía a las sucursales; una sucursal
puede **pedirle** a otra una prenda para un cliente, cobrándole o no un
anticipo al pedir.
