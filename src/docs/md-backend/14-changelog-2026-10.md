# Cambios en `develop` — octubre de 2026

Secciones: 9–10 de octubre (abajo), [18 de octubre](#actualización-18-de-octubre--stock-de-la-bodega-principal-separado)
y [19 de octubre](#actualización-19-de-octubre--reposiciones-etapas-de-los-traslados-facturas-por-sucursal)
(al final).

## 9 y 10 de octubre

Qué cambió en el backend desde [12-changelog-2026-09.md](12-changelog-2026-09.md),
**qué se rompe** y **qué tiene que hacer el front**. El detalle está en los
docs enlazados (ya actualizados).

## Resumen

| # | Cambio | Impacto en el front | Detalle |
|---|---|---|---|
| 1 | **Pedidos cobrados al pedir** (anticipo, no se factura): efectivo, tarjeta o QR | Flujo nuevo en "nuevo pedido": cotizar → cobrar → crear | [13](13-prepaid-branch-requests.md) §3 |
| 2 | **Cobro del anticipo por QR**: estado nuevo `pending_payment` | Pantalla de espera del QR | [13](13-prepaid-branch-requests.md) §4 |
| 3 | **Devoluciones** del anticipo (efectivo, caja de la tienda que pidió) | Lista + botón "Devolver" + badge `pendingRefunds` | [13](13-prepaid-branch-requests.md) §5 |
| 4 | **Venta de retiro con anticipo**: reprice devuelve `advanceApplied` y `amountDue` | El POS cobra `amountDue`, no `total` | [13](13-prepaid-branch-requests.md) §6 |
| 5 | **Anticipo perdido** si el cliente no retira a tiempo | Mostrar `advanceForfeited`; nuevo `409` al enlazar | [13](13-prepaid-branch-requests.md) §7 |
| 6 | **Configuración** de los plazos (`/settings`), antes variables de entorno | Pantalla nueva (admin) | [13](13-prepaid-branch-requests.md) §2 |
| 7 | Los plazos **vencen a las 23:59** (hora de Bolivia) y se fijan al recibir | Nada si ya usabas `pickupDeadline`/`holdUntil` | [11](11-central-warehouse-and-branch-transfers.md) §5.5 |
| 8 | **Cierre de caja** con desglose (ventas, anticipos, devoluciones) | Mostrar el desglose | [07](07-branches-daily-cash-billing.md) |
| 9 | QR de una venta de retiro: **solo por el saldo** | Saldo 0 → confirmar en efectivo | [04](04-cart-checkout-payments.md) |
| 10 | Datos del cliente **opcionales** en pedidos sin cobro; CI nuevo | Formulario de pedido | [11](11-central-warehouse-and-branch-transfers.md) §5.3 |

---

## ⚠️ Lo que rompe (revisar sí o sí)

1. **Estado nuevo `pending_payment`** en los traslados. Un `switch` sobre
   `status` sin `default` va a romper; agregá la etiqueta "Esperando pago".
2. **El POS tiene que cobrar `amountDue`**, no `total`, en la venta de
   retiro de un pedido cobrado. Si cobra `total`, el cliente paga dos veces
   el anticipo. Sin pedido cobrado son iguales, así que usar siempre
   `amountDue` es seguro.
3. **`expectedAmount` del cierre de caja ahora incluye anticipos y resta
   devoluciones.** Si el front recalculaba o explicaba el esperado como
   "suma de ventas", ya no cuadra: usá el desglose (`salesAmount`,
   `advancesAmount`, `refundsAmount`).
4. **Un pedido `pending_payment` es invisible para la tienda origen** (no
   aparece en su listado; su detalle da `404`). No lo trates como error.
5. **Actores `null` del sistema**: un anticipo pagado por QR tiene
   `payments[].createdBy: null`, y la salida de stock que genera aparece en
   el kardex con `user: null`. Mostralo como "Sistema (pago QR)".
6. **Plazos al fin del día**: un pedido recibido hoy vence a las 23:59 del
   último día, no a la hora exacta de recepción. Si el front calculaba
   fechas a partir de `receivedAt`, dejá de hacerlo: usá `pickupDeadline` y
   `holdUntil`.

Cambios que **no** rompen pero conviene saber:
- `customerName`/`customerPhone` ya no son obligatorios en un pedido sin
  cobro (con cobro sí, más `customerCi`).
- `GET /branch-transfers/pending-count` trae `pendingRefunds`.
- El reprice trae siempre `advanceApplied` y `amountDue`.

---

## Checklist para el front

- [ ] **Configuración** (ADMIN/SUPERVISOR): plazo de retiro y días de apartado (`GET/PATCH /settings`), con la aclaración "aplica a los pedidos que se reciban desde ahora".
- [ ] **Nuevo pedido**: opción de cobro (sin cobro / efectivo / tarjeta / QR); **cotizar** (`requests/quote`) y mandar `expectedTotal`; nombre, teléfono y CI obligatorios con cobro; manejar el `409` de "el total cambió" (volver a cotizar).
- [ ] **Pantalla de espera del QR**: `generate-qr/request/:id`, pollear `GET /branch-transfers/:id`, estados de 13 §4.3, botones "Generar otro QR" y "Anular".
- [ ] Etiqueta del estado **`pending_payment`** en listados y detalle.
- [ ] **Devoluciones pendientes**: `?pendingRefund=true`, badge `pendingRefunds`, botón "Devolver Bs `refundPending`" (`requests/:id/refund`).
- [ ] **POS – venta de retiro**: mostrar anticipo y "a cobrar" (`advanceApplied` / `amountDue`); cobrar `amountDue`; con saldo 0, venta en efectivo.
- [ ] **POS – corregir venta de retiro**: ofrecer **editar**, no cancelar + nueva.
- [ ] Mostrar **anticipo perdido** (`advanceForfeited`) y avisar al marcar "no retirado" un pedido cobrado.
- [ ] Detalle del pedido: cobro (`advanceAmount`, `advancePaidAt`), movimientos (`payments`), precio congelado por línea.
- [ ] **Cierre de caja**: desglose ventas / anticipos / devoluciones.
- [ ] Kardex y movimientos: `user: null` → "Sistema".

---

## Actualización 18 de octubre — stock de la bodega principal separado

| Endpoint | Cambio |
|---|---|
| `GET /products/:id`, `GET /outfits/:id` (admin, vista general) | Campo nuevo **`centralWarehouseStock`** por variante (solo la bodega principal). ⚠️ **`warehouseStock` ya no incluye la bodega**: ahora son solo los depósitos de las tiendas. Los 4 campos no se pisan (ninguna unidad aparece en dos), pero sumados no son el stock físico total (ver 06). |
| `GET /variants`, `GET /variants/:id` (con `?branchId`) | `warehouseStock` sin cambios (depósito de esa sucursal). Campo nuevo **`centralWarehouseStock`**: lo que hay en la bodega principal, sea cual sea la sucursal — no sumarlo al stock de la sucursal. |
| `GET /web-page/products/:id`, `GET /web-page/outfits/:id` (público) | Cada variante trae **solo `availableStock`**: ya no vienen `warehouseStock` ni `inTransitStock`. |
| `GET /users` | Cada usuario trae **`branch: { id, name }`** (sucursal del cajero/encargado; `null` para admin/supervisor). Ya no viene `sessionId`. Ordenado por `id`. |

Detalle en [06](06-inventory-and-warehouse.md) "Vista general".

- [ ] Detalle de producto (admin): mostrar `centralWarehouseStock` ("Bodega principal") aparte de `warehouseStock` ("Depósitos de tiendas"); si se sumaba `warehouseStock` para un total, sumar también `centralWarehouseStock`.
- [ ] Storefront: no usar `warehouseStock`/`inTransitStock` (ya no vienen).
- [ ] (Opcional) Inventario de una tienda (`/variants?branchId=`): mostrar "En bodega principal: N" con `centralWarehouseStock`, sin sumarlo al stock de la tienda.

---

## Actualización 19 de octubre — reposiciones, etapas de los traslados, facturas por sucursal

| # | Cambio | Impacto en el front | Detalle |
|---|---|---|---|
| 1 | **Reposiciones**: la tienda pide variantes (sin cantidad) a la bodega principal; la central elige cuánto manda | Pantallas nuevas: "Reposición" (tienda) y "Por atender" (central) | [15](15-replenishments-and-transfer-stages.md) §1 |
| 2 | **`stage`, `stageLabel`, `allowedActions`, `pendingReview`** en todos los traslados | Dibujar etapa y botones desde la respuesta | [15](15-replenishments-and-transfer-stages.md) §4 |
| 3 | Marca **`pendingReplenishment`** por variante | "Reposición pedida" en el inventario | [15](15-replenishments-and-transfer-stages.md) §2 |
| 4 | `pending-count`: nuevo **`replenishmentsPending`**; `toDispatch` sin reposiciones | Badge nuevo | [15](15-replenishments-and-transfer-stages.md) §3 |
| 5 | Filtro **`?replenishment=true\|false`** en `GET /branch-transfers` | Listas nuevas | [15](15-replenishments-and-transfer-stages.md) §3 |
| 6 | **Listado de facturas por sucursal**: `GET /facturacion/facturacion` toma `?branchId` (el código SIAT sale de la sucursal) | Cambiar los query params | [10](10-siat-low-level.md) |
| 7 | **Recibir un envío de la bodega directo al piso**: `location` opcional en `receive` (todo junto; por defecto, depósito) | Opción "Recibir al piso" | [11](11-central-warehouse-and-branch-transfers.md) §3 |

### ⚠️ Lo que rompe

1. **`items[].quantity` puede ser `null`** (líneas de una reposición: no hay
   cantidad pedida). Cualquier pantalla de traslados que haga cuentas con
   `quantity` (por ejemplo "no encontrado" = `quantity − dispatchedQuantity`)
   tiene que contemplarlo; en reposiciones usá `dispatchedQuantity`.
2. **Un `central_dispatch` puede estar en `pending_dispatch`** (reposición
   sin atender) **o en `not_found`** (reposición rechazada). Antes un envío
   nacía siempre `in_transit`. Un `switch` sobre `status` que asumía eso va a
   mostrar mal estos casos: usá `stageLabel`.
3. **`toDispatch` de `pending-count` sin `branchId` (central) ya no cuenta las
   reposiciones**: van en `replenishmentsPending`.
4. **`GET /facturacion/facturacion` ya no acepta `codigoSucursal`** (mandarlo
   da `400` por la validación estricta). Se manda `?branchId=<sucursal>` y,
   opcional, `codigoPuntoVenta` (sin él: todos los puntos de venta de esa
   sucursal). Sucursal sin datos SIAT → `400`; inexistente → `404`.

No rompe, pero conviene saber:
- `awaitingPickup` (filtro y contador) ya no incluye pedidos recibidos sin
  ninguna prenda (llegó todo en 0): ahora se ven como "Recibido".
- Anular un envío en camino devuelve a la bodega lo **despachado** (en una
  reposición atendida a medias, no lo pedido).
- Las respuestas de cada acción (despachar, recibir, anular…) vienen con la
  etapa y las acciones **de quien la hizo**.
- `receive` sin `location` funciona igual que antes (envío → depósito,
  pedido → piso). Mandar `location` en un **pedido** entre sucursales da
  `400`.

### Checklist

- [ ] Traslados: reemplazar la lógica propia de etiquetas/botones por `stageLabel` + `allowedActions` (+ badges `pendingReview` y `refundPending`).
- [ ] Tolerar `items[].quantity: null` y los estados `pending_dispatch`/`not_found` en envíos de la central.
- [ ] **Tienda – Reposición**: "Pedir reposición" desde el inventario (`POST /branch-transfers/replenishments`), ver/editar la abierta (quitar líneas, anular), historial; marca "Reposición pedida" con `pendingReplenishment`.
- [ ] **Central – Por atender**: lista `?replenishment=true&status=pending_dispatch`, pantalla de atención por línea (cantidad 0..stock de la bodega), rechazo con nota; manejar `400 Faltan las líneas` (recargar).
- [ ] Badge `replenishmentsPending` (central: por atender; tienda: "reposición abierta").
- [ ] Contador de la tienda: sumar solo `toDispatch + toReceive + awaitingPickup + pendingRefunds`.
- [ ] Pedidos recibidos: mostrar `holdUntil` ("apartado hasta") y `pickupDeadline` ("espera hasta").
- [ ] Listado de facturas: `?branchId=` en vez de `codigoSucursal`.
- [ ] Recibir envíos/reposiciones: elegir "Depósito" o "Piso" (`location`) para todo lo recibido; no mostrar la opción en pedidos entre sucursales.
