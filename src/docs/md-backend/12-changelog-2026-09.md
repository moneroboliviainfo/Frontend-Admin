# Cambios en `develop` — 28 al 30 de septiembre de 2026

Qué cambió en el backend desde la última actualización de estos docs, **qué
se rompe** y **qué tiene que hacer el front**. El detalle de cada tema está en
los docs enlazados (ya actualizados).

## Resumen

| # | Cambio | Impacto en el front | Detalle |
|---|---|---|---|
| 1 | Rol nuevo **`supervisor`** | Manejar el rol nuevo en login, menús y guards | [02](02-roles-and-permissions.md) |
| 2 | **Bodega principal**: todo el stock nuevo entra ahí | **Rompe**: `addstock` cambia de roles y destino | [11](11-central-warehouse-and-branch-transfers.md) §1, [06](06-inventory-and-warehouse.md) |
| 3 | **Envíos** de la bodega a las tiendas (`/branch-transfers`) | Pantallas nuevas | [11](11-central-warehouse-and-branch-transfers.md) §2–4 |
| 4 | **Pedidos entre sucursales** (reservado para el cliente, se cobra al retirar) | Pantallas nuevas + cambio en el POS | [11](11-central-warehouse-and-branch-transfers.md) §5 |
| 5 | **Ajuste positivo** en una tienda | Pantalla nueva (admin) | [11](11-central-warehouse-and-branch-transfers.md) §1 |
| 6 | Disponibilidad **por sucursal** | Pantalla nueva (POS) | [11](11-central-warehouse-and-branch-transfers.md) §5.2 |
| 7 | **Quién y cuándo** en las ventas | Campos nuevos en el detalle de la orden | [05](05-orders-lifecycle-and-pos.md) |
| 8 | **Refacturar** facturas ANULADAS o RECHAZADAS + historial | Botón nuevo + lista en el detalle | [07](07-branches-daily-cash-billing.md) |
| 9 | Facturas **REVERTIDAS** cuentan como vigentes | Mostrar como válidas | [07](07-branches-daily-cash-billing.md) |
| 10 | `cancel-for-edit` rechaza los pedidos FedEx | Error en el paso 1 en vez del 2 | [05](05-orders-lifecycle-and-pos.md) |
| 11 | `PUT /orders/change-status/:id` **ya funciona** | Antes fallaba siempre con 500 | [05](05-orders-lifecycle-and-pos.md) |
| 12 | Validación de paquetes SIAT según el veredicto | `503` si SIAT no responde | [10](10-siat-low-level.md) |
| 13 | Bloqueos de stock corregidos | Nada (ya no se vende dos veces la última unidad) | — |

---

## ⚠️ Lo que rompe (revisar sí o sí)

1. **`POST /variants/addstock`**
   - Solo **ADMIN y SUPERVISOR**. El **MANAGER recibe `403`**: quitá la
     opción de su UI.
   - Entra **siempre a la bodega principal**; `?branchId=` se ignora. Ya no se
     puede cargar stock directo en una tienda: se carga en la bodega y se le
     **envía** a la tienda.
2. **`POST /variants` y `PATCH /variants/:id`**: el stock inicial de las
   tallas entra a la bodega principal. `branchId` del body quedó deprecado e
   ignorado (no lo mandes más; si lo mandás no falla).
3. **`?branchId=<id de la bodega>`** da `403` en todo endpoint de tienda
   (órdenes, caja, `/stock-transfers`, bestsellers, total-sales, ajuste
   positivo). Solo lo aceptan los de stock listados en
   [11 §1](11-central-warehouse-and-branch-transfers.md).
4. **La bodega no aparece como sucursal** en `GET /branches` ni en
   `GET /web-page/branches`; `GET /branches/:id` con su id da `404`. Para
   obtenerla: `GET /central-warehouse`.
5. **Kardex** (`GET /variants/:id/movements`): `type` tiene valores nuevos
   (`envio_bodega`, `salida_pedido`, `envio_anulado`, `pedido_anulado`,
   `recepcion`, `aparecio_en_destino`, `aparecio_en_origen`) y campos nuevos
   (`branchTransferId`, `counterpartBranch`). `ajuste` puede ser positivo.
   Un `switch` sobre `type` sin `default` va a romper.
6. **Stock disponible más bajo en tiendas con pedidos**: lo reservado para un
   pedido que espera a su cliente **no cuenta como disponible** (en
   `availableStock`, reprice, venta). El POS tiene que enlazar el pedido
   (ver [11 §5.4](11-central-warehouse-and-branch-transfers.md)).
7. **`/stock-transfers`**: `createdBy` ahora es `{ id, name }` (antes venía el
   usuario completo con email, rol, etc.).
8. **Textos obligatorios con solo espacios → `400`** (notas de perdido,
   revisión y ajuste positivo, nombre del cliente del pedido).
9. **El rol `supervisor` existe**: `POST /auth/login` puede devolver
   `"rol": "supervisor"`. Si el front tiene un mapa de roles o guards,
   agregalo (ver abajo).

---

## 1. Rol `supervisor`

"Persona de confianza", por debajo del admin.

- **Tiene los mismos permisos que ADMIN en todos los endpoints**, excepto
  crear y editar usuarios: `POST /users/admin`, `POST /users/staff` y
  `PATCH /users/:id` siguen siendo solo ADMIN. Sí puede **ver** usuarios
  (`GET /users`, `GET /users/:id`).
- Como el admin, **no tiene sucursal fija** (`branch: null`): usa
  `?branchId=` y **no vende** (los endpoints de venta y caja son solo
  MANAGER/CASHIER).
- Se crea con `POST /users/admin { name, email, password, "rol": "supervisor" }`
  (ADMIN). Sin `rol` se crea un admin, como antes. El rol no se puede cambiar
  después.
- Regla práctica para el front: **donde hoy mostrás algo para ADMIN, mostralo
  también para SUPERVISOR, salvo crear/editar usuarios**.

## 2–6. Bodega principal, envíos, pedidos, ajuste positivo y disponibilidad

Todo en [11-central-warehouse-and-branch-transfers.md](11-central-warehouse-and-branch-transfers.md).

Endpoints nuevos:

| Endpoint | Roles |
|---|---|
| `GET /central-warehouse` | A, S |
| `PATCH /central-warehouse` | A, S |
| `POST /variants/positive-adjustment?branchId=` | A, S |
| `GET /variants/branch-stock/:variantId` | A, S, M, C |
| `GET /variants/branch-stock/product-color/:id` | A, S, M, C |
| `POST /branch-transfers/central-dispatch` | A, S |
| `POST /branch-transfers/requests` | M, C |
| `POST /branch-transfers/dispatch/:id` | M, C |
| `POST /branch-transfers/receive/:id` | M, C |
| `POST /branch-transfers/cancel/:id` | A, S, M, C |
| `POST /branch-transfers/mark-lost/:id` | A, S |
| `POST /branch-transfers/review/:id` | A, S |
| `POST /branch-transfers/pickup/:id` | M, C |
| `GET /branch-transfers` | A, S, M, C |
| `GET /branch-transfers/:id` | A, S, M, C |
| `GET /branch-transfers/pending-count` | A, S, M, C |
| `GET /branch-transfers/pickup-stats` | A, S |

(A = ADMIN, S = SUPERVISOR, M = MANAGER, C = CASHIER)

Endpoints existentes que cambian:

| Endpoint | Cambio |
|---|---|
| `POST /orders/reprice` | Acepta `branchTransferId?` (pedido que se retira). Con `type: "in_store"`, el error de stock puede terminar en `(variante N reservada para el pedido #M)`; online nunca. |
| `POST /orders/in-store` | Acepta `branchTransferId?`: marca el pedido como retirado con esta venta. Errores nuevos: ver [11 §5.4](11-central-warehouse-and-branch-transfers.md). |
| `GET /variants`, `GET /variants/:id` | Cada variante trae además `inTransitStock` (en camino hacia la sucursal). `availableStock` descuenta lo reservado para pedidos. |
| `POST /variants/subtractstock` | Acepta `?branchId=<bodega>` (bajas en la bodega, solo de depósito: con `location: "sales_floor"` → `400`). |
| `PATCH /branches/:id` | No deja desactivar una sucursal con traslados en curso: `409 No se puede desactivar: tiene traslados en curso (ej. #N), recíbalos o anúlelos primero`. |
| `POST /users/staff`, `PATCH /users/:id` | Asignar la bodega como sucursal de un usuario → `404`. |
| Respuestas de `Branch` | Campo nuevo `type`: `"store"` (la bodega nunca aparece en esos listados). |

**Flujo nuevo del POS** (resumen): si el cliente quiere algo que no hay →
"buscar en otras sucursales" → crear pedido → la otra tienda despacha → mi
tienda recibe → cuando el cliente vuelve, el carrito detecta el pedido
("¿es el pedido #N?") → reprice y venta con `branchTransferId`.

## 7. Quién y cuándo en las ventas

`GET /orders/:id` (staff) devuelve además:

```jsonc
{
  "createdBy":   { "id": 7, "name": "cajeroA" },   // quién la creó (en tienda, quién cobró)
  "editedBy":    null,                              // quién la editó
  "cancelledBy": null,                              // quién la canceló (null si la canceló el sistema o el cliente web)
  "sentBy":      null,                              // quién la marcó despachada (online)
  "paidAt":      "...",                             // ahora también al confirmar en tienda (efectivo/tarjeta)
  "cancelledAt": null,                              // CANCELLED o CANCELLED_FOR_EDIT
  "sentAt":      null,                              // PAID → SENT vía change-status
  "facturasAnteriores": [ ... ]                     // ver punto 8
}
```

Los actores son siempre `{ id, name }` o `null`.

## 8–9. Facturas: refacturar, historial y REVERTIDA

- **Refacturar**: `POST /orders/:orderId/facturar` (y
  `/facturar-contingencia`) ahora también funciona cuando la factura actual de
  la orden está **ANULADA o RECHAZADA**. Se pueden corregir los datos del
  cliente en el body: `nombreRazonSocial`, `numeroDocumento`, `complemento`,
  `codigoTipoDocumentoIdentidad`, `numeroTarjeta`, `emails`. Con cualquier
  otro estado → `400 La order N ya tiene una factura generada (id X, estado E)`.
- **Historial**: `GET /orders/:id` (solo staff) trae `facturasAnteriores`: las
  facturas reemplazadas al refacturar (también las de la orden original si es
  una edición). Cada una: `{ id, numeroFactura, cuf, estado, fechaEmision,
  montoTotal, nombreRazonSocial, numeroDocumento, ordenOriginalId }`.
- **REVERTIDA = vigente**: una factura cuya anulación se revirtió vuelve a
  ser válida. Mostrala como vigente (igual que VALIDADA). Es **definitiva**:
  no se puede volver a anular, así que esa orden ya no se puede refacturar.
- **ANULADA → dos caminos excluyentes**: refacturar la orden **o** revertir la
  anulación (ADMIN/SUPERVISOR, `/facturacion/facturacion/reversion`). Una vez
  refacturada, la anulada ya no se puede revertir.
- **Anular** (`/facturacion/facturacion/anulacion`, ADMIN/SUPERVISOR): solo
  facturas VALIDADA. Otro estado → `400` con el motivo (antes era un `404`
  engañoso).
- **OBSERVADA** todavía no tiene salida (ni anular ni refacturar): es un
  pendiente conocido del backend.

## 10. `cancel-for-edit` y pedidos FedEx

Los pedidos online con envío FedEx no se pueden editar. Antes el error
llegaba en el paso 2 (`PATCH /orders/:id`), con la orden ya en
`CANCELLED_FOR_EDIT` y trabada. Ahora `POST /orders/cancel-for-edit/:id`
responde **`400 Order N cannot be edited: it cannot be recreated for its type
(e.g. FedEx shipping orders)`** sin tocar la orden. Mejor todavía: ocultá
"editar" para esos pedidos.

## 11. `PUT /orders/change-status/:id`

Fallaba siempre con `500` (un bloqueo inválido en la base). Ya funciona, y
guarda quién y cuándo (`sentBy`, `sentAt`).

## 12. Paquetes SIAT (panel de soporte)

`POST /paquetes/validacion/:id` toma el estado de cada factura del veredicto
de SIAT (VALIDADA, RECHAZADA u OBSERVADA). Si SIAT todavía no dio veredicto,
las facturas quedan `ENVIADA` (reintentá después). Si SIAT no responde →
`503`.

## 13. Bloqueos de stock

Dos ventas o pedidos simultáneos de la última unidad ya no pasan los dos: uno
recibe `400 Insufficient stock`. No cambia ningún endpoint.

---

## Checklist para el front

- [ ] Rol `supervisor`: login, menús y guards (= admin salvo crear/editar usuarios); opción "Supervisor" al crear usuarios sin sucursal.
- [ ] Quitar "agregar stock" al MANAGER; para ADMIN/SUPERVISOR, el ingreso va a la bodega (sin elegir sucursal).
- [ ] Sección **Bodega principal** (stock, ingresos, bajas, nombre).
- [ ] **Envíos** desde la bodega + listado + anular / marcar perdido.
- [ ] **Faltantes por revisar** (revisión por línea).
- [ ] **Ajuste positivo** en tiendas.
- [ ] Badges con `GET /branch-transfers/pending-count` cada ~30 s.
- [ ] Tienda: **por recibir**, **por despachar**, **pedidos recibidos**.
- [ ] POS: **buscar en otras sucursales** (`branch-stock`) y **crear pedido**.
- [ ] POS: aviso **"¿es el pedido #N?"** y `branchTransferId` en reprice y venta; permitir agregar al carrito una prenda con disponible 0 si hay un pedido esperándola.
- [ ] Kardex: tipos nuevos, contraparte y número de traslado.
- [ ] Detalle de orden: actores y fechas; historial `facturasAnteriores`; botón **refacturar** si la factura está ANULADA o RECHAZADA.
- [ ] Mostrar REVERTIDA como vigente.
- [ ] Ocultar "editar" en pedidos FedEx.
- [ ] Reporte de **estadística de retiro** (`pickup-stats`).
