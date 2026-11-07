# Cambios en `develop` — octubre de 2026

Secciones: 9–10 de octubre (abajo), [18 de octubre](#actualización-18-de-octubre--stock-de-la-bodega-principal-separado),
[19 de octubre](#actualización-19-de-octubre--reposiciones-etapas-de-los-traslados-facturas-por-sucursal)
, [20 de octubre](#actualización-20-de-octubre--reglas-de-traslados-bajas-y-caja),
[21 de octubre](#actualización-21-de-octubre--ingreso-de-stock-por-excel),
[23 de octubre](#actualización-23-de-octubre--editar-sucursal)
y [30 de octubre (storefront)](#actualización-30-de-octubre--storefront-lo-que-faltaba-documentar)
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

---

## Actualización 20 de octubre — reglas de traslados, bajas y caja

| # | Cambio | Impacto en el front | Detalle |
|---|---|---|---|
| 1 | **Bajas** (`POST /variants/subtractstock`): ya no pueden dejar el stock **físico** de la ubicación en negativo; `reason` obligatorio (no vacío) | Manejar el `400` y exigir el motivo | [06](06-inventory-and-warehouse.md) |
| 2 | **La central ya no anula una reposición pendiente**: la rechaza al atenderla (todo en 0, con nota). `to_attend` → `allowedActions: ["attend"]` | Quitar "Anular" en "Por atender" | [15](15-replenishments-and-transfer-stages.md) §1.5 |
| 3 | **ADMIN/SUPERVISOR anulan siempre con nota** (envío en camino, reposición en camino, pedido entre tiendas) | Nota obligatoria en el diálogo de anular de la central | [15](15-replenishments-and-transfer-stages.md) §1.5 |
| 4 | **"No retirado" en un pedido cobrado exige nota** (el cliente pierde el anticipo) | Diálogo de confirmación con nota obligatoria | [13](13-prepaid-branch-requests.md) §7 |
| 5 | **Cierre de caja**: anticipos y devoluciones se cuentan desde el **cierre anterior**, no desde la apertura | Nada (el desglose sigue igual); un QR pagado entre turnos aparece en el cierre siguiente | [07](07-branches-daily-cash-billing.md) |
| 6 | Atender una reposición mandando algo a una **tienda inactiva** → `409` | Mostrar el error; rechazarla | [15](15-replenishments-and-transfer-stages.md) §1.5 |
| 7 | `GET /branch-transfers/pickup-stats` ya no cuenta pedidos recibidos sin ninguna prenda | Nada (ahora cuadra con `awaitingPickup`) | — |
| 8 | **`branch-stock` acepta `?branchId=` opcional** (`GET /variants/branch-stock/:variantId` y `.../product-color/:id`): devuelve solo esa tienda, **en la misma lista** (un elemento; `[]` si no es una tienda activa, p. ej. la bodega principal). Cualquier rol puede consultar cualquier tienda (no se fuerza la propia) | Nada si no se usa (sin `branchId` responde igual que antes). Opcional: usarlo para ver piso/depósito de una sola sucursal | [06](06-inventory-and-warehouse.md), [11](11-central-warehouse-and-branch-transfers.md) §5.2 |
| 9 | **Venta de retiro sin saldo** (el anticipo cubre todo) ya **no se puede crear con `qr`**: antes quedaba `PENDING` sin forma de confirmarla (el QR la rechazaba y `confirm/:id` no confirma ventas QR) | Si `amountDue` es `"0.00"`, forzar `cash` en el POS | [13](13-prepaid-branch-requests.md) §6.2 |

### Errores nuevos

| Endpoint | Error |
|---|---|
| `POST /variants/subtractstock` | `400 Stock insuficiente en <bodega\|tienda\|la bodega principal> para la variante N: disponible X, solicitado Y` |
| `POST /branch-transfers/cancel/:id` (central) | `400 Al anular desde la central la nota es obligatoria…` · `409 La reposición #N está por atender: la central la rechaza al atenderla…` |
| `POST /branch-transfers/pickup/:id` (`not_picked_up`, pedido cobrado) | `400 … hace perder el anticipo, la nota es obligatoria` |
| `POST /branch-transfers/replenishments/:id/dispatch` | `409 La tienda de la reposición #N está inactiva…` |
| `POST /orders/in-store` (`qr`, venta de retiro sin saldo) | `400 La venta no tiene saldo por cobrar (ya se pagó con el anticipo del pedido): créala en efectivo` |

### Checklist

- [ ] Bajas: motivo obligatorio y mensaje del `400` de stock insuficiente.
- [ ] Central – "Por atender": sin botón "Anular" (solo atender/rechazar).
- [ ] Central – diálogo "Anular": nota obligatoria.
- [ ] Tienda – "No retirado" en pedido cobrado: confirmación "el cliente pierde Bs `advanceAmount`" + nota obligatoria.
- [ ] POS – venta de retiro con `amountDue` `"0.00"`: forzar `cash` (no ofrecer QR).
- [ ] (Opcional) Stock de una sola sucursal: `branch-stock/...?branchId=` y leer `[0]` (puede venir `[]`).

### Pedidos entre sucursales: también del depósito de B

| Cambio | Impacto en el front |
|---|---|
| Un pedido ahora puede salir del **depósito y del piso** de B: el backend saca **primero del depósito** y completa con el piso | "Pedir a otra sucursal": el máximo es `availableToRequest` (ahora depósito + piso disponibles) |
| `GET /variants/branch-stock/...`: campos nuevos `heldInWarehouse`, `availableSalesFloor`, `availableWarehouse`; ⚠️ **`availableToRequest` cambia de significado** (antes solo piso) | Mostrar "Depósito: N · Piso: M" si querés; no sumar `salesFloor + warehouse` a mano |
| Cada línea del pedido trae **`fromWarehouse`** y **`fromSalesFloor`** (cuánto saca B de su depósito y de su piso, ya resuelto; `null` en envíos de la central). También viene la columna cruda `warehouseQuantity`: no la uses para calcular | Pantalla de despacho de B: "Sacar `fromWarehouse` del depósito y `fromSalesFloor` del piso" |
| `POST /branch-transfers/requests/quote`: cada línea trae `availableWarehouse` y `availableSalesFloor`; `available` = la suma | Nada si ya usabas `available` |
| Error de stock al pedir: `400 Stock insuficiente en <B> (depósito + piso) para la variante N…` (antes "en el piso de <B>") | Si se parseaba el texto, actualizar |
| Anular / "apareció en el origen" devuelven la prenda a donde salió (primero al depósito de B, hasta lo que salió de ahí) | Nada |
| `POST /stock-transfers` (depósito → piso) respeta la parte del depósito apartada por un pedido que espera el pago QR | Puede dar `400 Stock insuficiente en bodega` aunque el físico alcance (está apartado) |

- [ ] Despacho de B: mostrar `fromWarehouse` / `fromSalesFloor` por línea.
- [ ] Pedir a otra sucursal: tope `availableToRequest`; opcional desglose `availableWarehouse` / `availableSalesFloor`.

#### Inventario de la tienda y revisión de faltantes

| Cambio | Impacto en el front |
|---|---|
| Variantes con stock por sucursal (inventario, `GET /products/:id`, etc.): campos nuevos **`heldInWarehouse`** (de `warehouseStock`, lo apartado por pedidos QR sin pagar — no se puede pasar al piso), **`pendingDispatchWarehouse`** y **`pendingDispatchSalesFloor`** (pedidos que la tienda tiene que despachar: ya descontados pero todavía físicamente en el local) | Inventario: "Depósito: N (M apartadas)"; en el **conteo físico**, esperado: piso = `salesFloorStock + pendingDispatchSalesFloor + pendingShipmentSalesFloor`, depósito = `warehouseStock + pendingDispatchWarehouse` (⚠️ corregido el 21/10: **no** usar `availableStock`, ver abajo) |
| Errores de stock insuficiente que restan apartados (`POST /stock-transfers`) nombran el pedido: `… (apartada para el pedido #N)` | Mostrar el mensaje tal cual |
| Revisión `found_at_destination` en un **pedido** suma en el **piso** de la tienda que pidió (antes, en su depósito) | Nada |
| Revisión `found_at_destination` en un **pedido que todavía espera al cliente**: la prenda **vuelve al pedido** (sube `receivedQuantity`, queda apartada, el pedido reaparece en "pedidos recibidos"); si es cobrado, **baja `refundOwed`** y en la venta sale a precio congelado. No aplica si esa plata ya se devolvió o si el pedido ya no espera (retirado, vencido, "no retirado") | Refrescar el pedido tras revisar; la línea ya no muestra faltante (`reviewOutcome` lo dice). Ver [11](11-central-warehouse-and-branch-transfers.md) §4 y [13](13-prepaid-branch-requests.md) §5.1 |

- [ ] Inventario de la tienda: mostrar `heldInWarehouse` y "por despachar" (`pendingDispatchWarehouse` / `pendingDispatchSalesFloor`).
- [ ] Pantalla de conteo / ajuste positivo: avisar si la variante tiene unidades "por despachar" en esa ubicación.
- [ ] Revisión de faltantes de un pedido: tras `found_at_destination`, releer el pedido (puede volver a "pedidos recibidos" y cambiar `refundOwed`).

## Actualización 21 de octubre — ingreso de stock por Excel

Nada se rompe: son endpoints nuevos (ADMIN, SUPERVISOR) y un campo nuevo.
Detalle en [06](06-inventory-and-warehouse.md) ("Ingreso masivo por Excel" y
"Conteo físico") y [11](11-central-warehouse-and-branch-transfers.md) §2
("Crear el envío con un Excel").

### ⚠️ Corrección: el esperado del conteo físico en el piso

La regla del 20/10 ("esperado = stock + `pendingDispatch…`") era ambigua en
el piso: el único stock de piso que traía `GET /variants` era
`availableStock`, que es **neto** (resta ventas en curso y prendas apartadas
para pedidos, que siguen en el local). Contar contra eso sigue registrando
sobrantes falsos.

| Cambio | Impacto en el front |
|---|---|
| Campo nuevo **`salesFloorStock`** en cada variante de `GET /variants`, `GET /variants/:id`, `GET /products/:id` (admin) y `GET /outfits/:id` (admin): piso **físico**, sin restar reservas ni apartados | Conteo físico: esperado piso = `salesFloorStock + pendingDispatchSalesFloor + pendingShipmentSalesFloor`; depósito = `warehouseStock + pendingDispatchWarehouse`. **Nunca** `availableStock` |
| Campo nuevo **`pendingShipmentSalesFloor`** (mismos endpoints): ventas **online pagadas** (`paid`) de la tienda que todavía no se enviaron — ya descontadas del piso, pero la prenda sigue en el local | Sumarlo al esperado del piso y mostrarlo aparte ("+N por enviar") |
| `pendingDispatch…` sale **primero del depósito** de la tienda que despacha | Mostrar el "+N por despachar" en la ubicación que corresponde, no siempre en el piso |
| En `GET /variants` **no** viene `availableWarehouse` (es de `GET /variants/branch-stock/...`) | Tope de "Pasar a tienda" = `warehouseStock − heldInWarehouse`; de "Pasar a bodega" = `availableStock` |

- [ ] Stock de sucursales / modal de ajuste: esperado con `salesFloorStock` (no `availableStock`) + `pendingDispatch…` por ubicación + `pendingShipmentSalesFloor` en el piso.

### Importaciones por Excel

| Cambio | Impacto en el front |
|---|---|
| `GET /variants/import-stock/template`: descarga la plantilla `.xlsx` (una fila por variante con `ID variante`, producto, color, talla, stock actual de la bodega principal y la columna a llenar `Cantidad a ingresar`) | Botón "Descargar plantilla" en la pantalla de ingreso de stock |
| `POST /variants/import-stock` (`multipart/form-data`, campo `file`): ingresa todo al **depósito de la bodega principal**, como `addstock`. **Todo o nada**: si hay un error no se graba nada y el `400` trae `errors: [{ row, message }]` con todas las filas mal. `?dryRun=true` valida y devuelve el mismo resumen sin grabar | Subir → vista previa (`dryRun=true`) → confirmar (mismo archivo con `dryRun=false`). Mostrar `errors` en una tabla por fila y `warnings` (variantes repetidas que se suman) |
| `GET /branch-transfers/central-dispatch/import/template?destinationBranchId=` + `POST /branch-transfers/central-dispatch/import?destinationBranchId=&dryRun=`: **envío a una tienda por Excel** (una tienda por archivo; columna `Cantidad a enviar`; de referencia, el stock de la bodega y de la tienda, lo que ya va **en camino** a la tienda y si la tienda ya lo **pidió** en una reposición). Crea un envío normal `in_transit` (`transfer` en la respuesta); el `400` lista **todas** las líneas sin stock en la bodega. **Máximo 300 variantes** por archivo | En "Nuevo envío": opción "Desde Excel" con el mismo flujo plantilla → vista previa → confirmar; tras confirmar, abrir el envío creado (`transfer.id`) |
| ⚠️ En las dos importaciones `dryRun` acepta **solo `true`/`false`**: otro valor (`1`, `TRUE`, vacío) es un `400`, nunca una importación real. `?branchId=` se ignora | Mandar exactamente `dryRun=true` / `dryRun=false` |
| ~~Las dos plantillas traen un **buscador** en la fila 1 y el encabezado en la fila 3~~ — **quitado el 23/10**: el encabezado vuelve a la **fila 1**, sin buscador (las plantillas descargadas con buscador se siguen pudiendo subir). El error de encabezado ahora dice `La planilla debe tener un encabezado con las columnas …` (antes "La primera fila debe tener…") | Si se mostraba el texto del error tal cual, nada; si se comparaba el texto, actualizarlo |
| Las dos plantillas vienen **en bloques**: franja por categoría › subcategoría (orden del catálogo), título por producto (`#id · nombre`) y sus variantes por color y talla (XXS…XXL). Las franjas y títulos no tienen ID ni cantidad y se ignoran al subir; una cantidad escrita ahí da `Falta el ID de variante` en esa fila | Nada (el archivo lo arma el backend); si se muestra una vista previa del Excel, respetar los bloques |
| ⚠️ El backend **no detecta archivos repetidos**: subir dos veces (o doble clic en "Confirmar") duplica el ingreso o crea dos envíos | Deshabilitar "Confirmar" durante la request; tras confirmar, salir de la pantalla de subida (envío: ir a su detalle) |

- [ ] Pantalla de ingreso de stock: descargar plantilla, subir con `dryRun=true`, mostrar vista previa/errores, confirmar con `dryRun=false`.
- [ ] "Nuevo envío" desde Excel: elegir tienda → plantilla → vista previa (`dryRun=true`) → confirmar → ir al envío creado. Un archivo de ingreso subido acá da `400` (encabezado distinto).
- [ ] En las dos: botón "Confirmar" deshabilitado mientras la request está en curso, y aviso antes de volver a subir un archivo ya importado (duplica).
- [ ] Mostrar el `400` de "máximo 300 variantes" tal cual (pide dividir el archivo).

## Actualización 23 de octubre — editar sucursal

| Cambio | Impacto en el front |
|---|---|
| `PATCH /branches/:id`: el bloque `siatBranch` acepta **solo los campos editables**. Reenviar el objeto del `GET` con `id`/`createdAt` da `400 siatBranch.property id should not exist` (no es un cambio del backend: siempre fue así, ahora está documentado) | Quitar `id` y `createdAt` antes de enviar — ver [07](07-branches-daily-cash-billing.md) |
| `POST /orders/:id/facturar` y `/facturar-contingencia`: **solo ventas cobradas** (en tienda `sent`, online `paid`/`sent`; si no → `400`), una **edición** no se factura si la original (u otra edición) ya tiene factura vigente (`400`, anular primero), y `usuario` / `descuentoAdicional` / `montoGiftCard` del body **se ignoran** (figura el usuario logueado; el monto es lo cobrado) | Ocultar "Facturar" en órdenes no cobradas y en ediciones de una venta ya facturada; dejar de mandar esos tres campos — ver [07](07-branches-daily-cash-billing.md) |
| Plantillas Excel de ingreso de stock y de envío: **sin buscador**, encabezado en la **fila 1** (antes buscador en la 1 y encabezado en la 3). Las plantillas ya descargadas con buscador se siguen pudiendo subir | Nada, salvo que se mostrara o explicara el buscador |
| Sucursales **"solo facturación"** (`type: "billing_only"`, hoy DASH 21 y ZARGA 701, convertidas por SQL): no aparecen en `GET /branches` (el admin las lista con `?type=billing_only`; `GET`/`PATCH /branches/:id` sí las aceptan), pueden tener MANAGER/CASHIER, y su staff solo usa los endpoints SIAT — stock, ventas, caja y traslados → `403 Esta sucursal es solo de facturación…`. El login trae `branch.type` | Con `branch.type === "billing_only"` mostrar solo el menú de facturación; en la gestión de sucursales, una pestaña/filtro con `?type=billing_only`; el selector de sucursal al crear/editar usuarios tiene que cargar también `?type=billing_only` (si no, no se les puede asignar cajeros) — ver [07](07-branches-daily-cash-billing.md) |
| La factura de una venta muestra la sucursal como **`<siatBranch.name> <codigoSucursal>`** (ej. `COMERCIAL 3`), ya no con el nombre operativo de la sucursal | Nada |
| Factura manual (`/facturacion/facturacion/online`, `/offline`, `/contingencia`): `razonSocialEmisor`, `municipio`, `telefono` y `nombreSucursal` **pasan a ser opcionales y se ignoran**: salen de los datos SIAT de la sucursal del `codigoSucursal` (igual que en las facturas de venta) | Se pueden dejar de mandar; si se mandan no pasa nada |
| Facturar con una sucursal SIAT **desactivada** (`siatBranch.active = false`) da `400 La sucursal SIAT N está desactivada para facturar` (antes facturaba igual); sucursal SIAT inexistente → `404`. Aplica también a facturar una venta (`/orders/:id/facturar`) | Mostrar el error |
| Endpoint nuevo **`GET /variants/products`** (A, S, M, C; `page`, `limit`, `search`, `?branchId=`, acepta la bodega principal): igual que `GET /variants` pero **paginado por producto** — cada elemento es un producto con `productColors[]` → `variants[]` y los mismos campos de stock. `search` busca también por subcategoría y categoría. `GET /variants` no cambia (sigue paginado por color, para el POS) | Listado de la **bodega principal**: cambiar `GET /variants?branchId=<bodega>` por `GET /variants/products?branchId=<bodega>` y dibujar producto › colores › tallas — ver [06](06-inventory-and-warehouse.md) |
| **Devoluciones a la bodega principal** (tipo nuevo `type: "central_return"`): la tienda devuelve stock con `POST /branch-transfers/returns` (M, C; sale del depósito o, con `location: "sales_floor"`, del piso; nace `in_transit`) y la central la recibe con **`POST /branch-transfers/returns/:id/receive`** (A, S; entra al depósito de la bodega). Anular: la tienda o la central (con nota), solo en camino. `pending-count` trae `returnsToReceive`; kardex con tipos nuevos `devolucion_bodega` / `devolucion_anulada` | Un `switch` sobre `type` sin `default` rompe. Pantallas nuevas "Devolver a bodega" (tienda) y "Devoluciones por recibir" (central); la acción `receive` de una devolución va a `returns/:id/receive` — ver [16](16-central-returns.md) |
| `/facturacion` y `/paquetes` ahora aceptan **MANAGER y CASHIER** (antes `403 Special permits required : admin, supervisor`). Ven y operan **solo su sucursal SIAT**: el `codigoSucursal` de la query se reemplaza por el suyo, y una factura / paquete / evento de otra sucursal da `404`. `POST /paquetes` de un M/C envía solo las facturas offline de su sucursal. Todo `/catalogos` (`sincronizacion`, `parametricas`, `listas`, `fecha-hora`) y `POST /codigos/verificar-nit` también se abren a M/C, **sin** límite por sucursal (se usa el `codigoSucursal` + `codigoPuntoVenta` de la query, igual que para un admin). `GET /cafc` y `GET /cafc/:id` también se abren a M/C (los necesitan para elegir el `cafc` al facturar en contingencia), y los **eventos significativos** de `/operaciones` (registrar, listar, consultar) también, limitados a su sucursal SIAT; crear/editar CAFC, el resto de `/codigos` (CUIS/CUFD) y los puntos de venta de `/operaciones` siguen siendo ADMIN + SUPERVISOR | Mostrar las pantallas de facturas (lista, PDF, verificar, anular/revertir, paquetes, verificar NIT) al cajero y al encargado; no hace falta mandarles `codigoSucursal` distinto — ver [02](02-roles-and-permissions.md) |

## Actualización 26 de octubre — subida de imágenes

| Cambio | Impacto en el front |
|---|---|
| `POST /multimedia` vuelve a aceptar **jpg y png** y los **convierte a webp** en el backend (calidad 80; si miden más de 2000 px de ancho se achican a 2000, sin agrandar las chicas; se corrige la orientación de las fotos de celular y se quitan los metadatos). La URL devuelta siempre termina en `.webp`. Un webp de hasta 2000 px se guarda tal cual; uno más ancho se achica (los animados siguen animados). pdf y mp4 sin cambios | Ya no hace falta convertir a webp antes de subir. Usar la URL devuelta tal cual, sin armarla a mano con la extensión original |
| Antes un jpg/png se descartaba **en silencio** y la respuesta era `400 Make sure that at least one file was uploaded`. Ahora un formato no permitido da **`400 Formato no permitido: <mimetype>. Solo jpg, png, webp, pdf o mp4`** (ej. `image/heic`, `image/gif`) y un archivo que dice ser imagen pero no lo es, `400 <nombre> no es una imagen válida`. Si un archivo de la subida falla, **no se guarda ninguno** | Mostrar el mensaje del error |
| Límite por archivo: **10 MB** (antes 5 MB); siguen siendo hasta 10 archivos, campo `files` | Actualizar la validación del lado del front si la había |

## Actualización 26 de octubre — campos que se ignoraban pero se exigían

Errores del backend: campos que el backend reemplaza o ignora igual se validaban, y daban `400` aunque no sirvieran para nada.

| Cambio | Impacto en el front |
|---|---|
| `POST /orders/:orderId/facturar` y `/facturar-contingencia`: el `branchId` del body pasa a ser **opcional y se ignora** (se factura desde la sucursal del usuario logueado). Antes era obligatorio aunque se ignoraba, y al no mandarlo —como decía esta documentación— daba `400 branchId must be a positive number` | Nada: no mandarlo funciona. Si se manda, tampoco pasa nada |
| ⚠️ **Todo SIAT elige la sucursal por `branchId`, ya no por `codigoSucursal`**: `/catalogos` (`sincronizacion`, `parametricas`, `listas`, `fecha-hora`), `/codigos` (`cuis`, `cufd`, `verificar-nit`, `cufd/all`), `/facturacion/facturacion/online` / `offline` / `contingencia`, `/paquetes` (listar y `contingencia/:cafc/eventos`) y `/operaciones` (eventos significativos y puntos de venta). MANAGER/CASHIER usan siempre su sucursal (no mandan nada); ADMIN/SUPERVISOR mandan **`?branchId=`** (sin él → `403 La sucursal no pudo ser determinada`). El backend saca el `codigoSucursal` de los datos SIAT de la sucursal: sin datos SIAT → `403`, inexistente → `404`, bodega principal → `403`; las de solo facturación se aceptan. **`codigoPuntoVenta` pasa a ser opcional** (por defecto `0`). Un `?codigoSucursal=` que todavía llegue **se ignora** (no da `400`) | **Panel SIAT del admin**: cambiar `?codigoSucursal=` por `?branchId=` (el selector de sucursal de siempre; ojo, los de solo facturación se cargan con `GET /branches?type=billing_only`). **POS / cajero**: puede dejar de mandar `codigoSucursal` y `codigoPuntoVenta`. Ojo: en `/catalogos` y `verificar-nit` el cajero antes usaba el `codigoSucursal` que mandaba; ahora usa el de su sucursal (MONERO = 3), así que la primera vez se sincronizan los catálogos de ese par (necesita que el SIAT responda). Mientras el admin siga mandando solo `codigoSucursal`, recibe `403` |
| `POST /variants/subtractstock` (bajas): **solo ADMIN y SUPERVISOR**. El MANAGER pierde el permiso (`403 Special permits required`); el CASHIER ya no lo tenía. El admin da de baja en cualquier tienda o en la bodega con `?branchId=` | Ocultar "Dar de baja" al encargado y al cajero |
| `POST /orders/:orderId/facturar` y `/facturar-contingencia` se abren a **ADMIN y SUPERVISOR** (antes `403 Special permits required`): facturan cualquier venta, desde la sucursal de la venta, **sin** `?branchId=`. Siguen sin poder crear, cobrar, cancelar ni editar ventas. MANAGER/CASHIER sin cambios (solo ventas de su sucursal) | Mostrar "Facturar" también al admin y al supervisor en el detalle de la venta. Ojo: los catálogos SIAT y `verificar-nit` que usa esa pantalla le piden `?branchId=` al admin (usar el de la venta) |
| `POST /variants`: el `branchId` del body (ya ignorado) **no se valida** — un `0` o `""` del selector ya no da `400 branchId must be a positive number` | Nada |
| `?branchId=` **vacío** cuenta como no enviado en `GET /variants`, `/variants/products`, `/variants/:id/movements`, `/stock-transfers`, `/dailyCash`, `/branch-transfers` y `/branch-transfers/pending-count` (y `?sourceBranchId=` / `?destinationBranchId=` vacíos en `/branch-transfers`). Antes daba `400 branchId must be a positive number`, también a un cajero (para quien se ignora). Un ADMIN/SUPERVISOR con `?branchId=` vacío en un endpoint que necesita sucursal recibe `403 La sucursal no pudo ser determinada` (igual que sin el parámetro); en `/branch-transfers` ve todas. `?branchId=0` sigue siendo `400` | Nada; conviene igual no mandar el parámetro vacío |

## Actualización 26 de octubre — baja de varias variantes a la vez

| Cambio | Impacto en el front |
|---|---|
| Nuevo **`POST /variants/subtractstock/bulk`** (ADMIN, SUPERVISOR): da de baja **varias variantes del depósito de la bodega principal en una sola operación**, con un solo motivo. **Solo la bodega**: sin `?branchId=` (se ignora) ni `location` (con `location` → `400`); las bajas en tiendas siguen siendo de a una con `subtractstock?branchId=`. Body `{ "items": [{ "variantId", "quantity" }], "reason" }` — `quantity` **negativa**, como en `subtractstock`; hasta **300** líneas, sin variantes repetidas. **Todo o nada**: si una línea no tiene stock físico suficiente, `400 Stock insuficiente en la bodega principal para la variante N…` y no se graba ninguna. Responde el array de movimientos creados (uno por línea). `subtractstock` (una sola variante) sigue igual | (Opcional) En la bodega, pantalla "Dar de baja" con varias líneas: armar la lista y mandarla de una vez en vez de un `subtractstock` por variante (que podía dejar la baja a medias). Deshabilitar "Confirmar" durante la request (no detecta envíos repetidos) |

## Actualización 27 de octubre — SKU por variante y orden por talla

| Cambio | Impacto en el front |
|---|---|
| Cada variante trae **`sku`** (texto, único), autogenerado al crear un color (`POST /variants`) o agregar tallas (`PATCH /variants/:id`): `{CÓDIGO DEL PRODUCTO}-{COLOR}-{TALLA}`, ej. `PAN1-AZUM-36` (código = categoría abreviada + correlativo dentro de la categoría: `PAN1`, `PAN2`…). **Nunca cambia** (aunque se renombre el color o cambie la categoría) | Mostrar el `sku` en el listado, el detalle y las etiquetas; no armarlo en el front ni mandarlo en `POST`/`PATCH` — ver [06](06-inventory-and-warehouse.md) |
| `search` de **`GET /variants`** y **`GET /variants/products`** también busca por SKU, completo o en parte (`PAN1`, `PAN1-NEG`, `NEG-36`), si la palabra tiene un número o un guion. Devuelve el color / producto completo, como la búsqueda por talla | (Opcional) Buscar por SKU desde el mismo buscador o con el lector de códigos |
| Las **variantes de cada color vienen ordenadas por talla**: `XXS, XS, S, M, L, XL, XXL, XXXL` y después las numéricas (`36, 38, 40…`). Antes venían por `id` (o sin orden fijo en `GET /variants`). Vale para `GET /variants`, `/variants/products`, `/variants/:id` y las demás respuestas con stock por variante, también las públicas y `GET /outfits/:id` del panel desde el 30/10 | Si el front ordenaba las tallas a mano, puede dejar de hacerlo |

## Actualización 30 de octubre — storefront: lo que faltaba documentar

Son cambios ya hechos en el backend que no estaban anotados, o aclaraciones de cosas que los docs dejaban como "confirmar en Swagger". Las filas marcadas **Nuevo** son cambios del 30/10; las del invitado, la dirección, el envío y el outfit del panel todavía no están desplegadas. ⚠️ Los pagos en revisión de esta sección **se retiraron el 31/10** (ver esa actualización); `paymentStatus` sigue, con otro alcance. Detalle en [03](03-storefront-catalog.md), [04](04-cart-checkout-payments.md), [08](08-customer-account.md) y [09](09-admin-catalog-crud.md).

### ⚠️ Lo que puede romper

1. **La web elige sucursal al entrar** (con una por defecto) y de esa sucursal salen la factura y el stock de la venta. Hay que mandar su `branchId` en `POST /orders/reprice` y en `POST /web-page/orders/online`. Sin `branchId`, el reprice valida contra la suma de todas las tiendas y la orden puede fallar con `400 Insufficient stock for variant ID: N`. Mandalo también como `?branchId=` en el detalle del catálogo (ver la tabla).
2. **La ruta de retorno de la tarjeta lleva `/w`** y **`paymentStatus`**: `<FRONTEND_URL>/w/checkout/order-confirmed?orderId=...&paymentStatus=confirmed|rejected|review`. Se vuelve a esa ruta también con el pago rechazado: mostrar "confirmada" sin leer el parámetro engaña al cliente.
3. **`POST /products` exige `weightGrams` y `unitsPerBox`**. Un producto sin esos datos da `400` al cotizar FedEx.

| Cambio | Impacto en el front |
|---|---|
| `GET /web-page/products`: `search` por palabras, sin tildes ni mayúsculas, solo en el nombre (hasta 8 palabras; antes buscaba el texto entero). Orden fijo por `id` ascendente; `page` menor a 1 se trata como 1 | Nada que cambiar; los resultados y el orden pueden variar |
| `POST /shipping/rates`: cada servicio trae **`commit`** (fecha estimada de entrega de FedEx, o `null`) | (Opcional) Mostrar la fecha; tolerar `null` |
| `POST /shipping/rates`: `400` si un producto no tiene `weightGrams` o `unitsPerBox` | Mostrar el mensaje; cargarlos en el panel || **Nuevo** `GET /web-page/products/:id?branchId=` y `/web-page/outfits/:id?branchId=`: `availableStock` de esa sucursal. Sin el parámetro o vacío, la suma de todas las tiendas, como antes; `0`, negativo o no numérico → `400`; una sucursal que no existe o no vende → stock `0` | Mandar la sucursal elegida en el detalle de producto y de outfit |
| **Nuevo** Esos dos detalles traen las variantes **ordenadas por talla** (`XXS…XXXL`, después numéricas), y el outfit trae además el `size` de cada variante. Cada variante trae `sku` | Si se ordenaban las tallas a mano, se puede dejar de hacerlo |
| `POST /cart`: la variante **no trae stock** (el doc decía lo contrario) | No leer stock de `/cart`; usar el reprice |
| `GET /payments/verify/:id`: `true`/`false`; `404` si la orden venció, se canceló o no es QR | Cortar el polling con el `404` |
| `GET /web-page/customers/me` trae `address[]` y `orders[]` completas (vacías para un guest) | Usar `orders[]` para "Mis órdenes" |
| `POST /web-page/orders/online`: `name` y `phone` actualizan el perfil del cliente con cuenta | Avisarlo en el formulario si hace falta |
| **Invitado**: `address` es obligatorio también para él. Se crea con `POST /addresses` y su token, y se manda ese `id`; `email` para recibir el correo de pago | Formulario de dirección en el checkout de invitado |
| **Nuevo** ⚠️ **Cada `POST /auth/guest` abre una sesión propia**: direcciones y órdenes solo se ven con el token que las creó (`GET /addresses`, `GET /web-page/customers/order/:id`, `POST /web-page/customers/cancel/order/:id`); otro token → `404`. Un token de invitado anterior → `401 Guest session expired`. Las órdenes y direcciones de invitado anteriores dejan de ser accesibles desde la web | Guardar el token y **reusarlo en toda la compra**, sin pedir uno nuevo en medio; ante el `401`, pedir otro — ver [01](01-auth-and-sessions.md) |
| **Nuevo** ⚠️ `POST /web-page/orders/online`: `shipment` tiene que corresponder al `place` de la dirección; otro lugar o dirección sin `place` → `400 El envío <nombre> no corresponde al lugar de la dirección`; deshabilitado → `400`; inexistente → `404`. Un envío sin lugar se acepta siempre; FedEx no aplica. `GET /addresses/:id` ahora trae `place` | Ofrecer solo los envíos del lugar de la dirección (`GET /web-page/places`) y pedir el lugar en direcciones nacionales |
| **Nuevo** `GET /outfits/:id` (panel): variantes con `size` y ordenadas por talla | Nada |
| **Retirado el 31/10** ~~Pagos tardíos~~ (QR y tarjeta): un pago sobre una orden online vencida se confirma si hay stock. Si no se puede aplicar, queda registrado como **pago en revisión**, sin descontar stock ni facturar | Pantalla nueva en el panel — ver [05](05-orders-lifecycle-and-pos.md) "Pagos por devolver" |
| **Retirado el 31/10** `GET /orders/payment-reviews`, `GET /orders/payment-reviews/:id` (A, S, M, C) y `POST /orders/payment-reviews/:id/resolve` (A, S; `{ note }`) | Lista "Pagos por devolver" + "Marcar como devuelto" |
| **Retirado el 31/10** La orden trae `paymentReviewAt`, `paymentReviewReason` y `paymentReviewResolvedAt` (`null` si no aplica). Una orden con `paymentReviewAt` no está pagada, aunque se haya cobrado | Mostrar "Pago por devolver" en el detalle |
| **Nuevo** ⚠️ `POST /web-page/orders/online`: una dirección que no es del comprador (o de esa sesión de invitado) o que no existe → `404 Address not found`, sin crear la orden (antes aceptaba cualquier `id` existente, y uno inexistente daba `409`) | Usar direcciones creadas con el mismo token |
| `GET /web-page/customers/me`: en `orders[]` una orden vencida puede seguir `pending` | Tratar como vencida una `pending` con `expiresAt` pasado |
| `POST /web-page/customers/cancel/order/:id`: la orden cancelada desaparece de `orders[]` y su detalle da `404` | Mostrar el resultado con la respuesta del `POST` |
| Listados públicos: `sizes` y `subcategories` paginan (`{ data, meta }`); `categories`, `places`, `outfits` y `discounts` devuelven el array directo. `first-discount` es el más reciente, no "el más relevante" | Revisar cómo se lee cada respuesta |
| Outfits: sección nueva en [03](03-storefront-catalog.md) (no dependen de la sucursal, no se compran como unidad) | Armar el flujo de compra por prenda |

- [ ] Selector de sucursal al entrar a la web (`GET /web-page/branches`), con una por defecto configurada en el front; si no está en la lista, usar la primera.
- [ ] Mandar la sucursal elegida como `branchId` en el reprice y en la orden; volver a llamar al reprice si el cliente cambia de sucursal.
- [ ] Reprice: los ids sin stock vienen en el texto del `400` (`Insufficient stock for variants: [10,12]`), no en `errorsStock`.
- [ ] Checkout: manejar `400 Insufficient stock…` al crear la orden aunque el reprice haya dado OK.
- [ ] Tener la ruta `/w/checkout/order-confirmed` y mostrar según `paymentStatus` (`confirmed`, `rejected`, `review`).
- [ ] QR: al recibir `404` en `verify`, dejar de mostrar el QR y avisar "Si ya pagaste, contactanos".
- [ ] Cotización FedEx: tolerar `commit: null` y mostrar el `400` de producto sin peso o empaque.
- [ ] Detalle de producto y outfit: mandar `?branchId=` con la sucursal elegida y volver a pedirlo si el cliente cambia de sucursal.
- [ ] Polling del QR: cortar con `404`.
- [ ] Checkout de invitado: guardar el token de `POST /auth/guest` y reusarlo en toda la compra; crear la dirección con él y pedir `email`; ante `401 Guest session expired`, pedir otro.
- [ ] Checkout nacional: pedir el lugar de la dirección y ofrecer solo sus envíos; mostrar el `400` si no corresponde.
- [ ] "Mis órdenes": `pending` con `expiresAt` pasado se muestra como vencida; tras cancelar, usar la respuesta del `POST`.
- [ ] Panel: `weightGrams` y `unitsPerBox` en el alta y la edición de productos.

## Actualización 31 de octubre — la web vende del piso y del depósito de la sucursal elegida

Todavía no está desplegado. La sucursal elegida manda en el stock que se muestra, la venta y la factura. El envío FedEx sigue saliendo del remitente único configurado en el backend. El POS no cambia: vende solo del piso.

### ⚠️ Lo que puede romper

1. **Para vender en la web, `branchId` es obligatorio** (sin él → `400`): `POST /shipping/rates` y `POST /orders/reprice` con `type: online`. Reemplaza lo dicho el 30/10 sobre validar contra la suma de todas las tiendas. En `GET /web-page/products/:id` y `GET /web-page/outfits/:id` sigue siendo opcional.
2. **Los pagos en revisión del 30/10 se retiraron** (tarjeta ya tiene otra regla, abajo; el QR tardío sigue sin definir): no existen `GET /orders/payment-reviews`, `POST /orders/payment-reviews/:id/resolve`, `paymentReviewAt`, `paymentReviewReason` ni `paymentReviewResolvedAt`. No construyas esas pantallas todavía; las secciones que las mencionan quedan sin efecto. `paymentStatus` en el retorno de la tarjeta **sí existe**, pero `review` ya no aparece en ninguna lista: solo indica que hay que contactar al cliente.

| Cambio | Impacto en el front |
|---|---|
| `POST /shipping/rates`: el stock se revisa solo en la sucursal de `branchId`, piso + depósito; si no alcanza → `400 Insufficient stock for variants: [...]`, sin cotizar | Mandar la sucursal elegida y volver a cotizar si el cliente la cambia — ver [04](04-cart-checkout-payments.md) |
| `availableStock` de `GET /web-page/products/:id` y `/web-page/outfits/:id`: ahora es **piso + depósito** de la sucursal de `?branchId=`; sin el parámetro, la suma de las tiendas de `GET /web-page/branches`. Una sucursal que no vende por la web (bodega principal, inactiva o sin facturación SIAT activa) da `0`, y `400 Insufficient stock…` en el reprice online y la cotización | La web puede mostrar más que el POS: es lo esperado. Con una sucursal elegida, mandá `?branchId=`: el total no se puede comprar de una sola tienda |
| `POST /orders/reprice` con `type: online`: valida contra piso + depósito de `branchId` | Mandar la sucursal elegida |
| `GET /orders` y `GET /orders/:id` (panel): cada línea trae **`fromWarehouse`** y **`fromSalesFloor`** (cuánto sacar de cada lugar, ya resuelto, como en los pedidos). Una venta en tienda o anterior viene con todo en `fromSalesFloor`. El cliente no recibe estos campos | Pantalla de despacho: "Sacar `fromWarehouse` del depósito y `fromSalesFloor` del piso" — ver [05](05-orders-lifecycle-and-pos.md) |
| Campo nuevo **`pendingShipmentWarehouse`** en las variantes con stock por sucursal; `heldInWarehouse` ahora incluye ventas web en curso | Conteo físico del depósito: `warehouseStock + pendingDispatchWarehouse + pendingShipmentWarehouse` — ver [06](06-inventory-and-warehouse.md) |
| `GET /variants/branch-stock/...`: `reserved` es solo la parte del piso; la del depósito suma en `heldInWarehouse` | Nada, si ya usabas `availableSalesFloor` y `availableWarehouse` |
| Kardex y Excel: una venta web puede dar dos movimientos, uno en cada ubicación | Nada |
| **QR**: vence 1 minuto antes que la orden o el apartado del pedido, a la hora exacta (antes duraba hasta el fin del día). Cancelar una orden sin pagar anula sus QR en BNB | Cortar el QR al recibir `404` de `verify`; con una cuenta regresiva, usar `expirationDate` de la respuesta de `generate-qr` si viene |
| `POST /payments/generate-qr`: `404` también si a la orden le queda 1 minuto o menos | Mostrar "La orden venció" y volver a armar la compra |
| **`POST /payments/card/checkout-params`** renueva la orden y su reserva (10 minutos, tope 2 veces la vida de la orden) y responde **`409`** si por el tope quedan menos de 5 minutos | Pedir los parámetros al hacer clic en "Pagar", enviar a Cybersource enseguida y no reutilizarlos. Con `409`, volver a armar la compra — ver [04](04-cart-checkout-payments.md) |
| **Tarjeta**: un pago aprobado con la orden vencida se confirma (`confirmed`, de `expired` a `paid`), haya o no stock. `review` queda para orden cancelada o monto distinto. Una orden FedEx puede cambiar de `trackingCode` si su envío ya se había cancelado | Ninguno en el retorno; no dar por definitiva una orden `expired` que el cliente dice haber pagado con tarjeta: volver a consultarla |
| `GET /orders` y `GET /orders/:id` (panel): cada línea trae **`missingQuantity`** (0 casi siempre): de `fromSalesFloor`, las unidades que no había al confirmar un pago tardío | En el despacho, alerta por línea: "Faltan `missingQuantity`: conseguir con un pedido a otra tienda o a la central" — ver [05](05-orders-lifecycle-and-pos.md) |
| `PUT /orders/change-status/:id`: una orden FedEx con `fedexShipmentCancelled: true` responde **`400`** sin un `trackingCode` distinto; al recibirlo, el flag vuelve a `false` | Pedir el código nuevo en el despacho — ver [05](05-orders-lifecycle-and-pos.md) |

- [ ] Mandar `branchId` en el reprice online y la cotización FedEx, y en el detalle de producto y outfit cuando ya hay una sucursal elegida.
- [ ] Cotización FedEx: volver a cotizar si cambia la sucursal y mostrar el `400` sin stock.
- [ ] Despacho de pedidos online: mostrar `fromWarehouse` / `fromSalesFloor` por línea.
- [ ] Conteo físico: sumar `pendingShipmentWarehouse` al esperado del depósito.
- [ ] Quitar del plan la pantalla "Pagos por devolver". El retorno de la tarjeta sigue con `paymentStatus`; con `review`, pedirle al cliente que contacte con su número de orden.
- [ ] Tarjeta: pedir `checkout-params` al hacer clic en "Pagar", enviar enseguida y manejar el `409`.
- [ ] Despacho: alerta con `missingQuantity` por línea.
- [ ] Despacho FedEx: con `fedexShipmentCancelled: true`, alerta "Guía cancelada" y pedir el código nuevo antes de marcar `sent`.
