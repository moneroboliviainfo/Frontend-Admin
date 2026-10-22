# Cambios en `develop` — octubre de 2026

Secciones: 9–10 de octubre (abajo), [18 de octubre](#actualización-18-de-octubre--stock-de-la-bodega-principal-separado),
[19 de octubre](#actualización-19-de-octubre--reposiciones-etapas-de-los-traslados-facturas-por-sucursal)
, [20 de octubre](#actualización-20-de-octubre--reglas-de-traslados-bajas-y-caja)
y [21 de octubre](#actualización-21-de-octubre--ingreso-de-stock-por-excel)
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
| Variantes con stock por sucursal (inventario, `GET /products/:id`, etc.): campos nuevos **`heldInWarehouse`** (de `warehouseStock`, lo apartado por pedidos QR sin pagar — no se puede pasar al piso), **`pendingDispatchWarehouse`** y **`pendingDispatchSalesFloor`** (pedidos que la tienda tiene que despachar: ya descontados pero todavía físicamente en el local) | Inventario: "Depósito: N (M apartadas)"; en el **conteo físico**, esperado = stock + `pendingDispatch…` de esa ubicación, para no registrar sobrantes falsos |
| Errores de stock insuficiente que restan apartados (`POST /stock-transfers`) nombran el pedido: `… (apartada para el pedido #N)` | Mostrar el mensaje tal cual |
| Revisión `found_at_destination` en un **pedido** suma en el **piso** de la tienda que pidió (antes, en su depósito) | Nada |
| Revisión `found_at_destination` en un **pedido que todavía espera al cliente**: la prenda **vuelve al pedido** (sube `receivedQuantity`, queda apartada, el pedido reaparece en "pedidos recibidos"); si es cobrado, **baja `refundOwed`** y en la venta sale a precio congelado. No aplica si esa plata ya se devolvió o si el pedido ya no espera (retirado, vencido, "no retirado") | Refrescar el pedido tras revisar; la línea ya no muestra faltante (`reviewOutcome` lo dice). Ver [11](11-central-warehouse-and-branch-transfers.md) §4 y [13](13-prepaid-branch-requests.md) §5.1 |

- [ ] Inventario de la tienda: mostrar `heldInWarehouse` y "por despachar" (`pendingDispatchWarehouse` / `pendingDispatchSalesFloor`).
- [ ] Pantalla de conteo / ajuste positivo: avisar si la variante tiene unidades "por despachar" en esa ubicación.
- [ ] Revisión de faltantes de un pedido: tras `found_at_destination`, releer el pedido (puede volver a "pedidos recibidos" y cambiar `refundOwed`).

## Actualización 21 de octubre — ingreso de stock por Excel

Nada se rompe: son endpoints nuevos (ADMIN, SUPERVISOR). Detalle en
[06](06-inventory-and-warehouse.md) ("Ingreso masivo por Excel") y
[11](11-central-warehouse-and-branch-transfers.md) §2 ("Crear el envío con un Excel").

| Cambio | Impacto en el front |
|---|---|
| `GET /variants/import-stock/template`: descarga la plantilla `.xlsx` (una fila por variante con `ID variante`, producto, color, talla, stock actual de la bodega principal y la columna a llenar `Cantidad a ingresar`) | Botón "Descargar plantilla" en la pantalla de ingreso de stock |
| `POST /variants/import-stock` (`multipart/form-data`, campo `file`): ingresa todo al **depósito de la bodega principal**, como `addstock`. **Todo o nada**: si hay un error no se graba nada y el `400` trae `errors: [{ row, message }]` con todas las filas mal. `?dryRun=true` valida y devuelve el mismo resumen sin grabar | Subir → vista previa (`dryRun=true`) → confirmar (mismo archivo con `dryRun=false`). Mostrar `errors` en una tabla por fila y `warnings` (variantes repetidas que se suman) |
| `GET /branch-transfers/central-dispatch/import/template?destinationBranchId=` + `POST /branch-transfers/central-dispatch/import?destinationBranchId=&dryRun=`: **envío a una tienda por Excel** (una tienda por archivo; columna `Cantidad a enviar`; de referencia, el stock de la bodega y de la tienda, lo que ya va **en camino** a la tienda y si la tienda ya lo **pidió** en una reposición). Crea un envío normal `in_transit` (`transfer` en la respuesta); el `400` lista **todas** las líneas sin stock en la bodega. **Máximo 300 variantes** por archivo | En "Nuevo envío": opción "Desde Excel" con el mismo flujo plantilla → vista previa → confirmar; tras confirmar, abrir el envío creado (`transfer.id`) |
| ⚠️ En las dos importaciones `dryRun` acepta **solo `true`/`false`**: otro valor (`1`, `TRUE`, vacío) es un `400`, nunca una importación real. `?branchId=` se ignora | Mandar exactamente `dryRun=true` / `dryRun=false` |
| ⚠️ El backend **no detecta archivos repetidos**: subir dos veces (o doble clic en "Confirmar") duplica el ingreso o crea dos envíos | Deshabilitar "Confirmar" durante la request; tras confirmar, salir de la pantalla de subida (envío: ir a su detalle) |

- [ ] Pantalla de ingreso de stock: descargar plantilla, subir con `dryRun=true`, mostrar vista previa/errores, confirmar con `dryRun=false`.
- [ ] "Nuevo envío" desde Excel: elegir tienda → plantilla → vista previa (`dryRun=true`) → confirmar → ir al envío creado. Un archivo de ingreso subido acá da `400` (encabezado distinto).
- [ ] En las dos: botón "Confirmar" deshabilitado mientras la request está en curso, y aviso antes de volver a subir un archivo ya importado (duplica).
- [ ] Mostrar el `400` de "máximo 300 variantes" tal cual (pide dividir el archivo).
