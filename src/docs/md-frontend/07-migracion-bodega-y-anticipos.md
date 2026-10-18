# Migración: SUPERVISOR, bodega central, traslados y pedidos con anticipo

## Por qué existe este doc

El backend entregó docs actualizados (`src/docs/md-backend/`, reemplazados el
13/10/2026 — ver `12-changelog-2026-09.md` y `14-changelog-2026-10.md`). Es un
cambio grande: un rol nuevo y dos módulos de negocio enteros. Demasiado para un
solo cambio: esta es la lista de control para ir pieza por pieza.

**Regla de oro**: antes de marcar algo ✅, confirmalo contra el código actual, no
contra lo que diga este archivo de una sesión vieja.

Última verificación contra el código: **17/10/2026**.

## ⚠️ Importante: a qué backend apuntás

El backend nuevo **no está en producción**. Verificado el 15/10/2026:

| Backend | Endpoints nuevos (`/central-warehouse`, `/settings`, `/dailyCash/current`) |
|---|---|
| `api.moneroget.com` (producción) | ❌ 404 — versión vieja |
| `monerodevelop-backend-...sslip.io` (desarrollo) | ✅ 401 (existen) |

Todo lo implementado acá **requiere el backend de desarrollo** en
`NEXT_PUBLIC_API_URL`. Apuntando a producción, el POS se rompe: `reprice` y
`change-status` no existen ahí.

---

## Estado general

| Fase | Qué es | Estado |
|---|---|---|
| 1 | Rol `SUPERVISOR` | ✅ |
| 2 | Portado desde `main` (FedEx, refacturar, reprice) | ⚠️ sin verificar en UI (SIAT) |
| 3 | Actores, historial de facturas, kardex | ✅ |
| 4 | Bodega central y traslados entre sucursales | ⚠️ bodega y envíos completos; pedidos entre tiendas sin empezar |
| 5 | Pedidos cobrados con anticipo | ❌ nada |

Leyenda: ❌ no empezado · ⚠️ parcial · ✅ hecho y verificado.

---

## Fase 1 — Rol `SUPERVISOR` ✅

- [x] `types/api/auth.ts`: `supervisor`/`SUPERVISOR` + `normalizeRole`.
- [x] `menuPermissions.ts`: ve lo mismo que ADMIN **salvo Usuarios**.
- [x] Alta de usuario con opción "Supervisor", sin pedir sucursal.
- [x] `BranchContext.isAdmin` pasó a significar "no tiene sucursal fija"
      (ADMIN o SUPERVISOR), lo que arregló ~10 componentes sin tocarlos.
- [x] Etiquetas en `UserDropdown`, `UserListTable` y `Congratulations`.

---

## Fase 2 — Portado desde `main` ⚠️

- [x] `POST /orders/reprice` con `{ items, type }` en el body.
- [x] `Order`: `trackingCode`, `fedex_shipping_data`, `fedex_shipment_response`,
      `fedexShipmentCancelled`. Se eliminó `dhl_code`.
- [x] `PUT /orders/change-status/:id` con `trackingCode` opcional.
- [x] Refacturar con factura `ANULADA` **y `RECHAZADA`**; el botón dice
      "Emitir Nueva Factura" si ya hubo factura.
- [x] `canEditOrder` corta si la orden es online y tiene `fedex_shipping_data`.
- [x] Tarjeta "Envío FedEx" (guía, bultos, peso, PDF) + chip en la lista.
- [x] `card_online` agregado a `CreateOrderRequest` (`types/api/sales.ts`),
      que ya lo tenía `Order`.

**No se portó a propósito** (en `main` está viejo): el auto-select de sucursal
por `codigoSucursal === 3`, el filtro de roles por email en `SalesListTable`, y
`addToCart` sin `?type=in_store`.

---

## Fase 3 — Actores, historial y kardex ✅

- [x] Actores y fechas (`createdBy`, `editedBy`, `cancelledBy`, `sentBy`,
      `paidAt`, `cancelledAt`, `sentAt`) en el detalle de orden.
- [x] `facturasAnteriores`: tarjeta "Facturas Anteriores".
- [x] Factura `REVERTIDA` cuenta como vigente (ya estaba resuelto).
- [x] **Kardex**: hecho en la Fase 4 (`MovementsModal`), con los `type` nuevos
      de traslados.

---

## Fase 4 — Bodega central y traslados ⚠️

Doc: [11-central-warehouse-and-branch-transfers.md](../md-backend/11-central-warehouse-and-branch-transfers.md).

### Hecho ✅

**Pantalla Bodega Central** (`/central-warehouse`, ADMIN/SUPERVISOR), con dos
pestañas:

*Pestaña Stock* — acordeón por producto, tabla de tallas adentro:
- [x] Ver stock de la bodega (`GET /variants?branchId=<bodega>`).
- [x] Ingresar stock inline (`POST /variants/addstock`).
- [x] Enviar a sucursal inline (`POST /branch-transfers/central-dispatch`),
      con la sucursal destino tomada del selector de la navbar.
- [x] Un solo "Guardar cambios" con modal de confirmación que resume ingresos
      y envíos. Los ingresos se guardan **antes** del envío; si alguno falla,
      el envío no sale.
- [x] Dar de baja (`POST /variants/subtractstock`, `location: warehouse`,
      cantidad en negativo, motivo obligatorio).
- [x] Kardex por talla (`GET /variants/:id/movements`), con `branchTransferId`
      y sucursal de contraparte.
- [x] Renombrar la bodega (`PATCH /central-warehouse`).
- [x] Panel de stock crítico (`GET /variants/dashboard/lowStock`) en modal;
      al tocar una prenda la busca en la tabla.
- [x] Exportar a Excel: stock, stock crítico y movimientos.

*Pestaña Envíos*:
- [x] Historial (`GET /branch-transfers`), filtrado por la sucursal de la
      navbar (`direction=incoming`) o todas (switch → `direction=outgoing`
      desde la bodega).
- [x] Detalle en modal con línea de tiempo (todas las notas y actores).
- [x] Anular (`POST /branch-transfers/cancel/:id`).
- [x] Marcar perdido (`POST /branch-transfers/mark-lost/:id`).
- [x] Revisar faltantes (`POST /branch-transfers/review/:id`), por línea.
- [x] Badges con `GET /branch-transfers/pending-count` cada 30 s.

**Pantalla Recepciones** (`/receptions`, MANAGER/CASHIER):
- [x] "Por recibir" (`direction=incoming&status=in_transit`), sin filtrar por
      tipo: entran envíos de bodega y pedidos entre tiendas.
- [x] Recibir (`POST /branch-transfers/receive/:id`) con "Recibir todo" de un
      clic y un switch "Llegó diferente" para cantidades parciales; si llega
      menos, el motivo es obligatorio.
- [x] Badge con `toReceive`.

**Menú y permisos**: la sección `INVENTARIO` muestra *Bodega Central* a
ADMIN/SUPERVISOR y *Recepciones* a MANAGER/CASHIER. Recibir es exclusivo de la
tienda destino, así que un admin no ve Recepciones (vería solo 403s).

### Falta ❌

- [x] **Ajuste positivo en tienda** (`POST /variants/positive-adjustment`):
      botón "Ajuste Positivo" en Productos → Variantes (ADMIN/SUPERVISOR, que
      es a quienes el back se lo da), sobre la sucursal de la navbar. Nota
      obligatoria y elección de ubicación (tienda o depósito).
- [x] **Pedidos entre sucursales** (`branch_request`), 18/10/2026:
      - `GET /variants/branch-stock/:variantId` + `POST /branch-transfers/requests`:
        botón **"Pedir a otra sucursal"** en el catálogo del POS, visible solo
        cuando esa talla no tiene nada en la sucursal (ni piso ni depósito).
        Lista las otras tiendas con `availableToRequest` y oculta la propia.
      - `POST /branch-transfers/dispatch/:id`: pestaña **"Por despachar"** en
        Inventario, con "despachar todo" de un clic y un switch *"No encontré
        todo"*; si sale de menos la nota es obligatoria, y con 0 el pedido
        queda `not_found`.
      - `POST /branch-transfers/pickup/:id`: pestaña **"Pedidos recibidos"**
        con cliente, `pickupDeadline`/`holdUntil` y botón "No retirado".
      - Recibir ya estaba (la pestaña no filtra por tipo).
      - Admin: la pestaña *Envíos* de Bodega Central ahora tiene **filtro de
        tipo**, así que ve también los pedidos entre tiendas.
      - [ ] Falta **anular** un pedido antes del despacho (M/C de la tienda que
        pidió). El endpoint es el mismo `cancel` que ya usamos.
- [x] **POS — venta de retiro** (18/10/2026):
      - Tarjeta del catálogo: muestra "Pedido #N · Cliente" con botón
        **"Entregar este pedido"**, sobre la talla reservada.
      - `branchTransferId` en el **reprice** y en **`POST /orders/in-store`**.
        ⚠️ El reprice **ignora `branchTransferId` si no va `branchId`** (doc 04):
        por eso el POS ahora manda siempre su sucursal. La orden en cambio **no**
        lleva `branchId` (lo resuelve del cajero logueado).
      - Los datos del cliente del pedido **precargan la facturación** al pagar,
        solo si el CI está vacío y siempre editables.
- [x] **Agregar al carrito con disponible 0**: ya funcionaba — la tarjeta del
      catálogo nunca validó stock, el rechazo venía del backend.
- [ ] `pickup-stats`.
- [ ] Vista general de producto (admin): si alguna pantalla muestra un total
      de stock desde `GET /products/:id`, ahora hay que sumar
      `centralWarehouseStock` aparte de `warehouseStock`. Verificado el
      18/10/2026: **ninguna pantalla lo hace hoy** (`VariantsList` no muestra
      stock), así que no hay nada roto — pero tenerlo en cuenta si se agrega.
- [x] Storefront (`/web-page/*`): no aplica, este panel no consume esos
      endpoints.
- [x] **`inTransitStock`** agregado al tipo y al schema, y mostrado en
      Productos → Variantes, en Inventario → Mi stock y en el catálogo del POS
      (chip "N en camino", para que el cajero no crea que no viene nada).

### Pantalla de variantes, alineada al modelo nuevo (18/10/2026)

- [x] **Borrado "Agregar Stock"**: llamaba a `addstock` mandando el `branchId`
      de la sucursal de la navbar, pero el back **ignora ese parámetro** y
      siempre suma a la bodega central. O sea que decía "En bodega: 3" (de la
      sucursal), cargabas 20, y las 20 aparecían en la bodega central sin que
      el número de la sucursal se moviera. Ingresar stock vive en Bodega
      Central.
- [x] **`branchId` fuera del create y del update de variante**: está deprecado
      e ignorado; el stock inicial y las tallas nuevas van siempre a la bodega.
- [x] **Aviso al crear**: "El stock que cargues entra a la Bodega Central…".
- [x] **Cuatro números por talla**: Tienda · Bodega sucursal · En camino ·
      Bodega central, los cuatro de una sola consulta.

      > Actualización del back del **18/10/2026**: `GET /variants` ahora trae
      > **`centralWarehouseStock`**, que **no depende del `branchId`** que
      > consultes. Eso eliminó la segunda consulta que hacía falta antes.
      > Importante: **no sumarlo** al stock de la sucursal, y en la vista
      > general (`GET /products/:id`) `warehouseStock` **ya no incluye la
      > bodega** — son solo los depósitos de las tiendas.
- [x] "Bodega" → **"Bodega sucursal"** en las etiquetas, que desde que existe
      la Bodega Central era ambiguo.

### Inventario de sucursal (18/10/2026)

`/receptions` pasó a llamarse **Inventario** en el menú y tiene dos pestañas:

- **Mi stock**: las variantes de la sucursal agrupadas por producto, con
  Tienda · Depósito · En camino · Bodega central por talla. Acciones por color:
  **Mover** (depósito ↔ tienda) y **Dar de baja**, esta última oculta para el
  CASHIER porque `subtractstock` es A/S/M.
- **Por recibir**: lo que ya estaba.

Reutiliza `TransferStockModal` y `SubtractStockModal` de Productos sin tocarlos:
ya resolvían la sucursal solos (`branchId` solo lo manda un admin; para
MANAGER/CASHIER lo deduce el backend).

Con esto el encargado deja de depender de un admin para dar de baja algo roto
en su tienda.

### Pendiente: mudar dos acciones de tienda

`Quitar Stock` (`subtractstock`) y `Mover Variante` (`stock-transfers`) siguen
en Productos → Variantes, que es **ADMIN/SUPERVISOR**. Pero el backend las da a
**MANAGER** (y a CASHIER para los traspasos), así que hoy un encargado **no
puede pasar a la tienda lo que recibe**: depende de que un admin entre, se
cambie a su sucursal en la navbar y lo haga por él.

Corrección (18/10/2026): `stock-transfers` **también está en el catálogo del
POS** (`ProductCatalog.tsx`), al que MANAGER y CASHIER sí entran. O sea que el
encargado ya puede pasar a la tienda lo que recibe, y "Mover Variante" en
Productos es un duplicado de eso para ADMIN/SUPERVISOR.

El que **sigue sin alternativa** es `subtractstock` en una sucursal: dar de
baja algo dañado en la tienda solo se puede desde Productos, que el MANAGER no
ve, aunque el backend se lo permite.

Propuesta: pestaña **"Mi stock"** dentro de Recepciones (renombrada a
*Inventario*), con las tallas de la sucursal y las dos acciones — ocultando
"dar de baja" al CASHIER, que no la tiene. Quedaría simétrico con Bodega
Central (Stock · Envíos).

---

## Fase 5 — Pedidos cobrados con anticipo ❌

Doc: [13-prepaid-branch-requests.md](../md-backend/13-prepaid-branch-requests.md).
**Depende de la Fase 4.** No hay nada implementado.

> Nota: el commit `dfdb314` se llama *"feat: add prepaid branch requests
> functionality…"* pero **solo movió documentación**; no tocó ningún archivo de
> `src/`. El mensaje describe lo que hizo el backend, no el front.

- [x] **Configuración de plazos** (`GET/PATCH /settings`), 18/10/2026:
      pantalla `/settings` en ADMINISTRACIÓN → *Configuración* (ADMIN/SUPERVISOR).
      Valida los rangos del back (retiro 1-365, apartado 0-365) y que el
      apartado no supere el retiro. Muestra quién lo cambió por última vez y
      avisa que aplica solo a los pedidos que se reciban desde ahora.
      El hook se llama `useAppSettings` para no chocar con el `useSettings`
      del tema que ya existe en `@core/hooks`.
- [x] **Nuevo pedido con cobro** (efectivo y tarjeta), 18/10/2026: en el modal
      "Pedir a otra sucursal" del POS. Selector *Paga al retirar / Efectivo /
      Tarjeta*; con cobro aparece **Calcular total a cobrar**
      (`requests/quote`) y los datos del cliente pasan a obligatorios. La
      cotización se invalida al cambiar sucursal o cantidad, y ante el
      `409 El total del pedido cambió` se borra para obligar a recotizar.
      **Falta el QR** (sección 4 del doc 13).
- [x] **Cobro por QR** (18/10/2026): opción *QR* en el modal de pedido. Al
      confirmar, el pedido queda `pending_payment` y se abre `RequestQrDialog`,
      que genera el QR (`POST /payments/generate-qr/request/:id`) y pollea
      `GET /branch-transfers/:id` **cada 3 s solo mientras está
      `pending_payment`** (`refetchInterval` que se apaga solo).
      Estados cubiertos: esperando · QR vencido (Generar otro / Anular) ·
      pagado · **pagó tarde** (anulado con `refundPending` por devolver).
      Si BNB falla, el back responde sin lanzar: se mira `success` y se
      muestra su `message`.
      No toca el QR de las ventas, que es otro endpoint y otro componente.
- [x] **Devoluciones** (18/10/2026): pestaña *Devoluciones* en Inventario con
      badge `pendingRefunds`. Lista `?pendingRefund=true` con cliente, motivo
      (deducido del estado), lo que pagó y **`refundPending`** —que es el valor
      del botón, no `refundOwed`—. Confirmar llama
      `POST /branch-transfers/requests/:id/refund`: devuelve **todo lo
      pendiente de una vez y siempre en efectivo**, desde la caja de la tienda
      que pidió (debe estar abierta).
- [x] **POS venta de retiro**: `totalToPay` usa **`amountDue`** cuando viene, y
      el diálogo muestra el desglose (*Total de la venta* / *Ya pagó al
      encargar*). Sin pedido cobrado `amountDue` es igual a `total`, así que
      usarlo siempre es seguro. El vuelto sale del mismo valor.
- [x] **Anticipo perdido** (`advanceForfeited`), 18/10/2026: columna *Cobro* en
      *Pedidos recibidos* (Pagado al pedir / Esperando pago / **Anticipo
      perdido**) y aviso en rojo al marcar "no retirado" un pedido pagado:
      *"El cliente pierde los Bs X"*. En el POS, el `409` de plazo vencido
      **desenlaza el pedido solo**, para poder venderle la prenda a precio
      normal sin buscar cómo desmarcarlo.
- [x] **Pedidos esperando el pago**: un pedido con QR queda en
      `pending_payment` y antes **no aparecía en ninguna pantalla** si el
      cajero cerraba el QR. Ahora es una opción del filtro de *Por recibir*,
      con botón **Ver QR** que reabre la pantalla de cobro.
- [ ] Cierre de caja con desglose.
- [ ] Usar `pickupDeadline`/`holdUntil`, no recalcular desde `receivedAt`.

---

## "Lo que rompe" del changelog de octubre

Del [14-changelog-2026-10.md](../md-backend/14-changelog-2026-10.md):

| # | Qué rompe | Estado |
|---|---|---|
| 1 | Estado nuevo `pending_payment` en traslados | ✅ etiquetado "Esperando pago" |
| 2 | El POS debe cobrar `amountDue`, no `total` | ✅ resuelto el 18/10/2026 |
| 3 | `expectedAmount` del cierre de caja incluye anticipos y resta devoluciones | ✅ desglose tipado y mostrado al cerrar caja |
| 4 | Un pedido `pending_payment` es invisible para la tienda origen | ❌ no aplica todavía |
| 5 | Actores `null` del sistema → mostrar "Sistema" | ✅ en el kardex |
| 6 | Los plazos vencen a las 23:59; usar `pickupDeadline`/`holdUntil` | ❌ no aplica todavía |

---

## Pendientes de esta tanda

- [ ] **Pedidos cobrados en el POS**: las prendas ya pagadas no se deberían
      poder quitar del carrito en la venta de retiro (doc 13 §10).
- [ ] **Corregir una venta de retiro**: ofrecer editar en vez de cancelar y
      crear otra (editar no libera el pedido; cancelar sí lo devuelve a
      "esperando").

- [x] **Anular un pedido antes del despacho** y **ver los propios pedidos**:
      *Por recibir* tiene filtro de estado (En camino · Esperando despacho ·
      No encontrados). El listado acepta un solo `status` por consulta, por eso
      es un filtro y no una vista combinada. Antes la tienda que pedía **no veía
      sus pedidos hasta que estaban en camino**, y si volvían `not_found` no se
      enteraba nunca.
- [x] **Datos del cliente**: CI en *Pedidos recibidos* (se pide para cotejar el
      documento al entregar), cliente en *Por recibir* y en el detalle del admin.
- [x] **Errores del enlace**: el POS reescribía el error de stock y **perdía el
      número de pedido**. Ahora, si la unidad está reservada, el mensaje nombra
      el pedido e indica marcar "Entregar este pedido".
- [ ] `pickup-stats` (ADMIN/SUPERVISOR).
- [ ] **Volver `REQUIRE_BILLING` a `true`** en `PaymentDialog.tsx` cuando SIAT
      esté configurado. Hoy está en `false` para poder probar ventas en efectivo.

## Bugs viejos corregidos el 18/10/2026

5. **El stock no se actualizaba después de vender**: `useCreateOrder`,
   `useConfirmOrder` y `useCancelOrder` no invalidaban nada, y `useVariants`
   tiene `staleTime: 30000`. El backend descontaba bien; la pantalla mostraba
   el número viejo. Ahora las tres invalidan `['variants']`.

## Arreglos chicos — hechos el 17/10/2026

1. [x] `card_online` en `CreateOrderRequest`.
2. [x] "Sistema" en lugar de `—` cuando `movement.user` es `null` en el kardex.
3. [x] Desglose del cierre de caja. **Era más que tipos**: la respuesta de
   `POST /dailyCash/:id/close` se descartaba (`router.push('/home')` directo),
   así que el cajero nunca veía el esperado ni si había sobrante o faltante.
   Ahora hay un resumen (`CloseCashSummaryModal`) con apertura, ventas,
   anticipos, devoluciones, esperado vs. contado y la diferencia.

---

## ⏸ Bloqueado por el backend (SIAT)

En el backend de desarrollo **las sucursales no tienen configurado SIAT**, y sin
eso no cargan los catálogos. Sigue sin poder probarse en el navegador:

| Qué | Por qué |
|---|---|
| Venta en tienda completa (el nuevo `reprice`) | El modal de pago pide los tipos de documento a `POST /catalogos/parametricas` |
| Facturar / refacturar | Necesita una sucursal con `siatBranch` activo (CUIS/CUFD) |

**Para desbloquear**: configurar SIAT en al menos una sucursal del backend de
desarrollo. El cambio más riesgoso de la Fase 2 (el `reprice` con el token en el
body) **sigue sin confirmarse contra el backend real**.

---

## Bugs viejos encontrados y corregidos en el camino

1. **`FacturacionList.tsx`** desestructuraba `excludedBranchCodes` /
   `allowedBranchCodes` de `useUserRole`, que no existen en `develop`: **el
   proyecto no compilaba**. Se reemplazó por un filtro de sucursales activas.
2. **Punto muerto en `BranchContext`**: `isReady` solo se liberaba con una
   sucursal seleccionada y el error de `GET /api/branches` no se manejaba. Si
   esa llamada fallaba, el dashboard quedaba cargando para siempre y el selector
   desaparecía sin mensaje.
3. **Exports de Excel sin `branchId`**: los cuatro métodos de `variantService`
   no mandaban la sucursal, así que para un ADMIN (sin sucursal fija) devolvían
   `403 "La sucursal no pudo ser determinada"`. Afectaba también a los botones
   del dashboard de Inicio, no solo a la bodega.
4. **Faltantes mal calculados**: la fórmula del doc
   (`quantity − dispatched + (dispatched − received)`) solo vale con el traslado
   **cerrado**. Aplicada a uno `in_transit`, `receivedQuantity: null` se leía
   como "llegaron 0" y marcaba faltantes inexistentes. Ver
   `views/Dashboard/central-warehouse/transfers.ts`.

---

## Mapa de archivos nuevos

```
types/api/branchTransfer.ts            traslados
types/api/variants.ts                  + StockMovement, StockMovementType
services/branchTransferService.ts      central-warehouse + branch-transfers
services/variantService.ts             + getMovements, branchId en exports
hooks/useBranchTransfers.ts            queries y mutaciones de traslados
hooks/useVariants.ts                   + useVariantMovements
hooks/useDashboard.ts                  useLowStock acepta branchId explícito
views/Dashboard/central-warehouse/     11 componentes + transfers.ts + units.ts
views/Dashboard/receptions/            ReceptionsTable + ReceiveTransferModal
app/(dashboard)/(private)/central-warehouse/
app/(dashboard)/(private)/receptions/
```
