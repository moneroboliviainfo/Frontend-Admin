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

## Historial de caja (18/10/2026)

`GET /dailyCash` no se usaba: se podía abrir y cerrar caja, pero no ver los
turnos anteriores. Pantalla **VENTAS → Caja** (`/cash`) para ADMIN, SUPERVISOR
y MANAGER; el CASHIER no la ve (el doc da el historial a A/S/M).

Lista cada turno con apertura, esperado, contado y la **diferencia** en un
chip (Cuadra / Sobra / Falta), y un detalle con el desglose completo —ventas,
anticipos, devoluciones— y quién abrió y cerró. ADMIN/SUPERVISOR filtran por la
sucursal de la navbar; el MANAGER siempre ve la suya.

## Decisión de negocio: no hay pedidos fiados (18/10/2026)

Un pedido para un cliente **se cobra siempre al encargarlo**. Se eliminó la
opción "paga al retirar".

El modal del POS pasó de una pregunta con cuatro botones a dos preguntas:

1. **¿Para qué es?** — *Para un cliente* (se cobra) o *Para reponer stock*
   (no se cobra ni pide datos; es la sucursal abasteciéndose de otra).
2. **¿Cómo paga?** — Efectivo, Tarjeta o QR. Solo aparece con cliente.

Los datos del cliente solo se muestran cuando hay cliente, y ahí son
obligatorios.

> El backend **no admite pagos parciales**: `expectedTotal` es el total de la
> cotización y el QR se genera por *"el anticipo completo"*. O sea que el
> cliente paga la prenda entera al encargarla; al retirarla solo abona lo que
> lleve de más (`amountDue`).

## Vistas generales vs. vistas de sucursal (19/10/2026)

El color del tema seguia a la sucursal elegida en **todas** las pantallas, y el
selector de la navbar se mostraba siempre. En Usuarios o Clientes eso miente:
mover el selector no cambia nada de lo que se ve.

`src/utils/branchScope.ts` clasifica cada ruta y es la unica fuente de verdad:
la leen el color (`BranchThemeSync`) y el selector (`BranchSwitcher`), para que
no puedan quedar en desacuerdo.

- **Con sucursal** (5): `/products`, `/sales`, `/cash`, `/central-warehouse`,
  `/siat`.
- **Generales** (12): el resto. Color azul fijo y sin selector.

Criterio: entra en la primera lista solo si lo que se **muestra** cambia al
mover el selector. Usar `useBranchContext` no alcanza — Usuarios lee la lista
de sucursales para un desplegable del formulario.

El color general es **verde medio oscuro** (`#15803D`).

La paleta de sucursales se rehizo entera: el color de sucursal es el `primary`
del tema y tine todos los botones, asi que **ningun color puede parecerse a los
semanticos de la plantilla** (error `#FF4C51`, warning `#FF9F43`, info
`#00BAD1`, success `#28C76F`). La paleta vieja tenia naranja, ambar, rojo, lima
y cian: una sucursal en rojo hacia que cada boton primario pareciera de peligro.

Quedaron solo azules, purpuras, magentas y tierras, ordenados para que las
primeras sucursales sean las mas distintas entre si. La regla esta escrita en
`branchColor.ts` para que no se repita el error al sumar colores.

Una ruta sin clasificar cae en general (azul, sin selector): nunca miente, solo
queda sosa. En desarrollo avisa por consola una vez por ruta.

### Rutas que mezclan los dos casos

Tres rutas no son de un solo tipo:

| Ruta | Si aplica | No aplica |
| --- | --- | --- |
| `/products` | paso 2 (Variantes) | listado y paso 1 |
| `/siat` | eventos, facturacion | cafc, paquetes |

SIAT se resolvio partiendo la ruta en sub-rutas. Productos comparte direccion
con la vista del otro tipo, asi que la vista interna declara su alcance con
`useDeclareBranchScope` (`BranchScopeContext`): Variantes declara `true`, y al
desmontarse se limpia sola.

Bodega Central tenia el mismo problema con la pestana Retiros, que declaraba
`false`. Se resolvio **mudando la pantalla** en vez de declarar: el informe
vive ahora en Inicio, que ya es general. Que una pantalla necesitara declarar
lo contrario a su ruta era la senal de que estaba en el menu equivocado.

Las declaraciones se guardan en una pila con un id por declarante, para que uno
anidado no borre el de afuera al salir. Funciona porque ni el asistente ni las
pestanas montan mas de una vista a la vez: el wizard renderiza un solo paso, y
`TabPanel` de MUI solo monta la pestana activa (sin `keepMounted`, que no se
usa). Si alguna vez se monta mas de una, la de adentro manda.

### Selector de sucursal

Paso de botones (`ToggleButtonGroup`) a un **select** de 150px en el grupo
izquierdo de la navbar.

El nombre de la sucursal se separo en `BranchIndicator`: un chip grande
(`variant='tonal'`, en el color del tema) al **centro** de la navbar. La
division es a proposito —el select cambia, el chip orienta— y separarlos deja
el chip en el punto donde la vista cae primero. Los dos comparten las mismas
guardas (`isAdmin` + `isBranchScoped`), asi que aparecen y desaparecen juntos.

### Retiros, de Bodega Central a Inicio

El informe `pickup-stats` no habla de la bodega sino de los pedidos entre
tiendas, y era la unica pestana de Bodega Central que no dependia del selector
de sucursal. Paso a ser una tarjeta ancha del tablero de Inicio, junto a Stock
bajo y Mas vendidos, que es donde viven los otros informes.

El archivo se movio a `views/Dashboard/ecommerce/` con el resto de las tarjetas
del tablero. Lleva guarda propia (`isAdmin`): el encargado ve Inicio pero el
informe es de ADMIN/SUPERVISOR, y la consulta ni se dispara para el. Bodega
Central queda con sus dos pestanas reales: Stock y Envios.

## Refresco de listas despues de cada accion (19/10/2026)

Sintoma reportado: dar de baja stock no refrescaba el historial de movimientos.
Causa: ninguna mutacion invalidaba `variant-movements`.

Se relevaron **todas** las claves de consulta contra todo lo que se invalida.
Resultado: no era un caso aislado.

| Mutacion | No refrescaba |
| --- | --- |
| stock (alta, baja, traspaso, sobrante) | historial de movimientos, stock por sucursal, bodega central |
| traslados (9 mutaciones) | el detalle abierto, stock por sucursal, bodega central, movimientos |
| cobrar un pedido / devolver anticipo | la caja del turno |
| crear CAFC / evento / paquete SIAT | su propia lista |
| guardar datos de facturacion | esos datos al volver a buscar el CI |

En vez de repetir claves en cada mutacion se centralizo en dos constantes:
`CLAVES_TRASLADO` (useBranchTransfers) y `CLAVES_STOCK` (useVariants), con un
helper por archivo. Agregar una pantalla nueva ahora es sumar una clave en un
solo lugar, no recordar cada mutacion.

Quedan sin invalidar a proposito: catalogos SIAT que no cambian desde el panel
(actividades economicas, tipos de documento, parametricas), claves en singular
cuyo plural si se invalida, `dashboard` (es una foto) y `verify-payment` (se
pollea solo).

## Menus por proposito y reposiciones (20/10/2026)

Doc: [15-replenishments-and-transfer-stages.md](../md-backend/15-replenishments-and-transfer-stages.md) §5.

Regla: **cada pantalla es un solo tema y sus pestañas son partes o etapas de
ese tema**. Se separan tres cosas: stock (lo que hay), movimientos (mercaderia
que se mueve) y solicitudes (alguien le pide algo a otro).

| Menu | Admin / Supervisor | Encargado / Cajero |
| --- | --- | --- |
| INVENTARIO → Bodega Central | Stock · Envios | — |
| INVENTARIO → Inventario | — | Stock · Envios de la central |
| INVENTARIO → Reposiciones (`/replenishments`) | Por atender · Historial | Mi reposicion · Historial |
| PEDIDOS ENTRE SUCURSALES → Pedidos (`/branch-requests`) | listado de todos los pedidos | Mis pedidos · Por despachar · Para entregar · Devoluciones |
| PEDIDOS ENTRE SUCURSALES → Plazos de Pedidos | (se movio desde INVENTARIO) | — |

- **Bodega → Envios**: se saco el filtro *Tipo* (los pedidos entre tiendas no
  pasan por la bodega; con "ver todas" ademas salia siempre vacio). Se saco
  *Todos* del estado: traeria las reposiciones sin atender y las rechazadas,
  que son solicitudes. Badge nuevo de faltantes por revisar.
- **La recepcion de la central vive en un solo lugar** (Inventario → Envios de
  la central), venga de un envio directo o de una reposicion atendida. Ahi se
  elige si entra al deposito o directo a la tienda (`location`).
- La pestaña de recepciones de la tienda mezclaba envios de la central con el
  seguimiento de pedidos (filtros "Todavía no lo envían", "Esperando el pago",
  QR, anular). Se partio: `ReceptionsTable kind='central' | 'requests'`.
- **Excepcion aceptada**: el envio inline de Bodega → Stock se queda como esta.
- **Atajo**: ícono "Pedir reposición" por talla en Inventario → Stock. Solo
  agrega la talla; ver, quitar y anular es en Reposiciones.
- Badges por menu: `pending-count.toReceive` suma envios y pedidos, asi que
  cada menu cuenta su tipo con `useTransferCount` (listado con `limit=1`,
  lee `meta.total`, cada 30 s). Si el back separa ese campo, se reemplaza.
- Etiquetas y botones: se usan `stageLabel` y `allowedActions` del back
  (`stageOf` / `canDo` en `central-warehouse/transfers.ts`), con la regla
  vieja como respaldo si no vienen.
- `BranchTransferItem.quantity` ahora es `number | null` (null en
  reposiciones): usar `itemUnits` / `transferUnits` para sumar.

## Variantes: pantalla global (19/10/2026)

Hecho. La pestana Variantes ya no depende del selector de sucursal.

**Lectura**: muestra solo **talla** y **cantidad en bodega central**. Se fueron
las columnas Tienda, Bodega sucursal y En camino. La consulta manda
`?branchId=<bodega>` (el id sale de `GET /central-warehouse`).

> Nota tecnica: `centralWarehouseStock` **no depende** del `branchId` (doc 06:
> "igual: la bodega principal, no depende de X"), asi que la llamada sin
> parametro habria dado el mismo numero. Se manda igual por decision del
> equipo.

**Acciones quitadas**: Quitar Stock, Mover Variante y Registrar Sobrante. Las
tres mandaban `?branchId=<sucursal>` y con el id de la bodega no funcionan
(`positive-adjustment` con la bodega da **403**; mover piso/deposito no aplica).

### Lo que esto deja pendiente

- **Dar de baja y registrar sobrante de una TIENDA**: hoy no tienen pantalla
  para el ADMIN. Hay que sumarlas a Bodega Central eligiendo la tienda (nunca
  la bodega: 403 en el sobrante). El MANAGER no quedo sin nada: las hace desde
  Inventario → Mi stock.
- Mover piso/deposito ya existia en Inventario → Mi stock, no se perdio nada.
- `/products` quedo como ruta general pura: se borro el
  `useDeclareBranchScope(true)` y **no queda ningun caso especial en el
  sistema**. `BranchScopeContext` sigue montado pero sin declarantes: se puede
  borrar si no aparece otro caso.

Una nota anterior listaba "Ver movimientos" entre las acciones de Variantes.
Era falso: `MovementsModal` se abre solo desde Bodega Central.

## Stock de Sucursales (20/10/2026)

Pantalla nueva para ADMIN/SUPERVISOR: **INVENTARIO → Stock de Sucursales**
(`/branch-stock`). Lista el stock de **la sucursal del selector**, paginado y
con busqueda, agrupado por producto. Una sola accion por fila: **Ajustar**
(sobrante de conteo).

Reemplaza el apaño anterior: el boton de ajuste que vivia en Bodega Central
(se quito) operaba sobre una tienda mientras la tabla mostraba el stock de la
**bodega**. Bodega Central volvio a ser solo la bodega.

Por que una pantalla propia y no abrirle Inventario al admin: Inventario
arrastra recepciones, despachos y entregas —tareas de mostrador—; por eso el
menu se la esconde (ver el comentario en `menuPermissions.ts`).

No hizo falta backend nuevo: `GET /variants?branchId=&page=&limit=&search=`
ya existia y ya estaba en `useVariants`.

### El detalle de los dos numeros

El listado trae `availableStock` **neto de reservas** (piso − ventas en curso −
apartado por pedidos). Para contar hace falta el **fisico**. Por eso la tabla
no le pasa sus numeros al modal: el modal consulta `branch-stock?branchId=` y
muestra `salesFloor`, `warehouse` y lo apartado en tres celdas.

Si le pasara los de la fila, el cajero contaria 12 prendas colgadas, la
pantalla diria 10, y registraria un sobrante de 2 que no existe.

Sigue pendiente **dar de baja stock de una tienda** desde el panel del admin:
esta pantalla es ahora el lugar natural (un segundo boton por fila).

## Reposiciones: ingreso en linea y aviso en el menu (20/10/2026)

**Ingresar stock sin salir de la pantalla.** En *Atender reposicion*, la
columna "En bodega central" tiene ahora un `+` por fila: se escribe la cantidad
y se ingresa ahi mismo (`POST /variants/addstock`). Antes, si faltaba stock
para atender, habia que ir a Bodega Central, cargarlo y volver.

La celda se actualiza sola: `addstock` invalida `['variant']` (ver
`CLAVES_STOCK`) y el detalle del stock se consulta con
`['variant', productColorId, destinationBranchId]`, que coincide por prefijo.

`addstock` entra **siempre** a la bodega principal —ignora `branchId`, doc 06—
asi que no se le manda ninguna sucursal.

**Aviso en el sidebar.** El menu *Reposiciones* muestra un chip con
`replenishmentsPending` (las que las tiendas pidieron y la central no atendio),
igual que *Bodega Central* con `pendingReview`.

Los avisos se declaran en un mapa `href → aviso` en `VerticalMenu`, en vez de
un `if` por menu: sumar un tercero es una entrada mas.

> **Son dos llamadas a `pending-count`, no una.** Con `?branchId=<bodega>` el
> endpoint responde "envios que salen de la bodega" (de ahi `pendingReview`);
> `replenishmentsPending` solo cuenta cuantas **tiendas** esperan ser atendidas
> cuando se pide **sin** `branchId` (doc 15 §3: "Central (sin branchId)"). Con
> una sola llamada el chip de Reposiciones quedaba siempre en cero.

## Reposiciones: filtro por el selector global (20/10/2026)

Las dos tablas (*Por atender* e *Historial*) tenian su propio desplegable
"Tienda" con opcion "Todas". Se reemplazo por un **switch "Todas las
sucursales", encendido por defecto**: apagado, filtran por la sucursal del
**selector de la navbar** —el estado global— y se muestra su chip al lado.

`/replenishments` paso de GENERALES a **CON_SUCURSAL** en `branchScope.ts`.
Era imprescindible: clasificada como general, el selector no se dibuja, y con
el switch apagado no habria forma de elegir la sucursal.

Efecto lateral asumido: con el switch encendido (todas), la navbar igual
muestra una sucursal. El switch manda sobre la tabla; el selector solo dice
cual se usaria al apagarlo.

## De donde sale la prenda al despachar (20/10/2026)

El back empezo a mandar, por linea de un traslado, **`fromWarehouse`** y
**`fromSalesFloor`**: de donde se descuenta la prenda. Descuenta primero de la
**bodega** de la tienda origen y recien cuando no alcanza toma del **salon**.
`{ fromWarehouse: 0, fromSalesFloor: 1 }` = no habia en bodega.

> Todavia no esta en los docs del back (no aparece en 11 ni en 15). Los campos
> se tipearon como opcionales por eso.

En *Por despachar* hay ahora una columna **"De donde sale"** con un chip por
origen —bodega en el color de la marca, salon en ambar— y, cuando algo sale del
salon, un aviso: *"N prendas salen del salon: no habia suficiente en la bodega.
Saquela de la percha antes de despachar."*

Sin esto el cajero busca la prenda en la bodega, no la encuentra y da el pedido
por perdido, cuando en realidad esta colgada en el salon.

## Reglas nuevas del back del 20/10/2026 (aplicadas el 21/10)

| Cambio del back | Que se hizo |
| --- | --- |
| Venta de retiro **sin saldo** no se puede crear con `qr` (quedaba `PENDING` sin forma de confirmarla) | El POS ofrece **solo efectivo** cuando `amountDue` es `"0.00"`, con un aviso que lo explica |
| **Anular desde la central** exige nota | `TransferActionsModal`: la nota de *cancel* paso a obligatoria |
| **"No retirado"** en un pedido cobrado exige nota | El dialogo la pide y no deja confirmar sin ella, solo cuando el cliente pierde el anticipo |
| La central **ya no anula** una reposicion pendiente (la rechaza al atenderla) | El boton ya no aparecia porque `allowedActions` no trae `cancel`; se bajo el fallback de `canDo(..., 'cancel', true)` a **`false`** para que no pueda aparecer sin autorizacion del back |

El cuarto confirmo que respetar `allowedActions` fue la decision correcta: el
back cambio una regla y la pantalla se adapto sin tocar nada. Solo quedaba el
fallback, que es lo que se corrigio.

### Conteo fisico y apartados (21/10/2026)

**El campo contra el que se cuenta no era el correcto.** `availableStock` es lo
VENDIBLE del piso: ya resta los carritos del POS y lo apartado por pedidos, que
siguen colgados. Contra ese numero el conteo siempre da de mas.

El back agrego **`salesFloorStock`** (piso fisico). Lo esperado en un conteo:

| Ubicacion | Esperado |
| --- | --- |
| Piso | `salesFloorStock + pendingDispatchSalesFloor` |
| Deposito | `warehouseStock + pendingDispatchWarehouse` (`warehouseStock` si es fisico) |

*Stock de Sucursales* muestra ahora lo fisico y, debajo, **"+N por despachar"**
en ambar — **por ubicacion**: un pedido sale primero del deposito y solo lo que
falta del piso, asi que el aviso no siempre va en el piso. El modal de ajuste
repite el aviso de la ubicacion elegida.

**`heldInWarehouse`** (del deposito, apartado por pedidos con QR sin pagar) se
muestra en Inventario como *"N apartadas"*, y el campo **Pasar a tienda** quedo
topado en `warehouseStock - heldInWarehouse`. Antes dejaba escribir de mas y el
back respondia `400 Stock insuficiente en bodega... (apartada para el pedido
#N)`, que parecia un bug. Si esta todo apartado, el tooltip lo dice.

> `availableWarehouse` y `availableSalesFloor` **solo** vienen en
> `GET /variants/branch-stock/:variantId`. En `GET /variants?branchId=` hay que
> calcularlo a mano, que es lo que hace `movibleDesdeBodega`.

## Importaciones por Excel (21/10/2026)

Dos botones en **Bodega Central → Stock**, al lado de Exportar: **Ingresar por
Excel** y **Enviar por Excel**. Van ahi porque son la version masiva de las dos
columnas de esa tabla (*Ingresar* y *Enviar a X*), y porque los dos endpoints
son ADMIN/SUPERVISOR — en Inventario los verian justo los roles que reciben
`403`.

Un solo componente para los dos (`ExcelImportModal`, `mode: 'stock' |
'dispatch'`): cambian los endpoints y una nota opcional en el envio. Lo
delicado —plantilla, vista previa, errores por fila— es identico, y duplicarlo
era garantizar que se desincronizaran.

Flujo: **Descargar plantilla → Elegir archivo → Ver que se va a grabar
(`dryRun=true`) → Confirmar (`dryRun=false`)**.

Detalles que impone el back y que estan contemplados:

- `dryRun` se manda **siempre explicito** (`'true'` / `'false'`): omitirlo
  importa de verdad y cualquier otro valor es `400`.
- Las plantillas **requieren token**: se piden como `blob` y se disparan con un
  `<a download>` temporal. Un enlace directo no funciona.
- El `400` con filas trae `errors: [{ row, message }]` y se muestra como tabla;
  los demas (`413`, encabezado equivocado, limite de 300) traen solo `message`.
- **Subir dos veces duplica** (el back no detecta repetidos): el boton se
  bloquea durante la request y al confirmar se cierra el modal.
- El envio usa la sucursal del selector; sin sucursal elegida el boton se
  deshabilita, igual que la columna.

Como los services se llaman directo (sin `useMutation`), la invalidacion de
cache va a mano dentro del modal: sin eso la tabla seguia mostrando el stock
viejo despues de importar.

### Pendiente

- `onDispatchCreated` esta cableado pero nadie navega al envio creado: falta
  abrir su detalle tras confirmar.

## Comprobante de recepcion (21/10/2026)

En el modal de **Recibir traslado**, dos botones nuevos: **Imprimir** (hoja) y
**Termica** (bluetooth, solo si el navegador lo soporta). `receptionReceipt.ts`
tiene los dos generadores.

Se imprime **antes de confirmar**: los datos ya estan en el modal y el papel se
firma con las dos personas frente al paquete.

Lleva traslado, origen, destino, **a donde ingresa** (bodega o tienda), el
detalle con *despachado vs recibido* (los faltantes en negrita), la nota, y al
pie **dos lineas en blanco para firmar a mano**: *Entrega* con el nombre de la
sucursal de origen, y *Recibe* con el del usuario logueado.

No se reusaron los printers de factura: estan tipados contra `Factura` y esto
no es un documento fiscal. Lo que si se reuso es lo de bajo nivel del termico
—`ESC_POS`, `writeToprinter`, `printLine`, que pasaron a exportarse— para no
duplicar la logica ESC/POS.

## Etiqueta de variante (22/10/2026)

En el modal del **QR de la variante**, dos botones: **Imprimir etiqueta**
(hoja) y **Termica** (bluetooth). Los dos abren un menu con las cuatro medidas
de rollo: **30x20, 40x40, 50x50 y 50x25 mm**. `variantLabel.ts` tiene los dos
generadores y `LABEL_SIZES`.

La etiqueta lleva QR, producto, **TALLA**, **COLOR** e id. Jerarquia (22/10): el
producto **completo** en renglones, talla y color chicos (tambien completos), y
el id **grande y sin rotulo** (solo el numero). Nombre y color en minuscula con
mayuscula inicial; la talla va tal cual (XL, M). En **30x20 y 50x25** el nombre
va arriba a todo el ancho y debajo talla/color/id a la izquierda con el QR
pegado a la derecha, ocupando el alto que deja el nombre. Cada medida tiene que
existir tambien como tamaño de papel en el driver de la impresora.

El alto decide el armado: en **20-25 mm** el QR va **al lado** del texto (no
entra apilado) y las tipografias bajan; de 40 mm para arriba va arriba y el
texto centrado debajo. El nombre del producto se corta con ellipsis en una
linea: si parte, rompe la etiqueta entera.

Dos decisiones tecnicas:

- **Hoja**: el QR se pasa de SVG a PNG en un canvas antes de imprimir. El SVG
  de pantalla no se imprime de forma confiable.
- **Termica (formato POS, 22/10)**: misma conexion y protocolo que la factura
  (ESC/POS por `bluetoothPrinter.ts`), pero la etiqueta **no** se arma con
  renglones de texto: asi no se puede poner el QR al costado ni usar las
  tipografias de cada medida. Se dibuja el **mismo diseño de la hoja**
  (`labelParts`, compartido) dentro de un SVG `foreignObject`, se pasa a un
  canvas a 203 dpi (8 puntos/mm), se convierte a blanco y negro (corte en 170
  para que la negrita no salga finita) y se manda como imagen raster
  `GS v 0` en franjas de 48 filas, y despues `GS FF` (avanzar a la etiqueta
  siguiente). Sin librerias nuevas. Pausa entre paquetes de 6 ms
  (`RASTER_PAUSE_MS`); la factura sigue con 20. Antes se usaba el QR nativo
  `GS ( k` + texto, que salia siempre vertical y sin respetar la medida.

Probado contra el formato de facturacion (mismo patron de ventana de impresion
y mismos helpers ESC/POS exportados desde `bluetoothPrinter.ts`).

## Facturacion: billing obligatorio y sin sucursal (23/10/2026)

**`REQUIRE_BILLING` volvio a `true`** en `PaymentDialog`. Estaba en `false`
como temporal para probar ventas en efectivo sin SIAT. Ahora los datos de
facturacion se exigen antes de elegir el metodo de pago, que es cuando el
cajero todavia tiene al cliente enfrente.

**`branchId` salio de `FacturarRequest`** y de los dos bodies que lo armaban
(`SuccessDialog` y `SaleDetailsModal`). El back resuelve la sucursal de la
sesion: doc 07 dice que facturar falla si la orden *"no es de tu sucursal"*,
asi que mandarlo era redundante y podia contradecir a la sesion.

`FacturarContingenciaRequest` hereda de `FacturarRequest`, asi que quedo
arreglado solo.

> Queda vestigial el **selector de sucursal** del dialogo de facturacion
> (`needsBranchSelector`, solo ADMIN). Ya no decide donde se factura; si no
> sirve para otra cosa, se puede sacar.

## Remito de envio (23/10/2026)

El papel que acompaña la mercaderia al salir de la bodega. Mismo formato que el
comprobante de recepcion (80mm, bloque de pagina ya calibrado) pero **sin
firmas**: nadie firma al despachar, se firma al recibir del otro lado.

Lleva traslado (si ya existe), **Sale de / Va a / Despacha**, el detalle con una
casilla para tildar mientras se arma el paquete, y el total.

Dos lugares:

- **Bodega Central → Stock**, en un modal chico que se abre **despues** de
  confirmar (`DispatchCreatedModal`): *"Envio #46 creado"* con los dos botones.
  Asi el remito lleva el numero real y refleja lo que quedo registrado, no lo
  que se iba a mandar. (`transferId` quedo opcional en `DispatchNote` por si
  alguna vez se imprime antes.)
- **Bodega Central → Envios**, en las acciones de cada fila, **solo cuando esta
  en camino**: reimprime el remito de un envio ya creado. El papel se pierde, el
  envio no.

Tambien se sumo, en el modal de recibir, una columna **Etiqueta** (primera) con
el QR de la variante: reutiliza `VariantQRModal`, asi se imprimen las etiquetas
de lo que acaba de llegar sin salir de la pantalla.

## Pendientes de esta tanda

- [x] **Prendas pagadas protegidas en el carrito** (18/10/2026): con un pedido
      **pagado** enlazado, sus líneas no se pueden borrar ni bajar de la
      cantidad pagada (botón oculto, menos deshabilitado), y se marcan con
      "N ya pagada(s) en el pedido". Un pedido sin cobro no restringe nada.
- [x] **Corregir una venta de retiro**: al cancelar una venta con
      `branchTransferId`, un aviso explica que el pedido vuelve a figurar
      pendiente de retiro y que para corregir datos conviene **Editar**.
      Editar ya estaba disponible; lo que faltaba era advertir la diferencia.

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
- [x] **`pickup-stats`**: pestaña *Retiros* en Bodega Central, con rango de
      fechas (por defecto, el mes en curso) y el **porcentaje de retiro** por
      par de sucursales, en verde/naranja/rojo. Es el dato con el que se
      decide dónde exigir anticipo.
- [ ] **Volver `REQUIRE_BILLING` a `true`** en `PaymentDialog.tsx` cuando SIAT
      esté configurado. Hoy está en `false` para poder probar ventas en efectivo.

## Bugs propios corregidos

- **`sales.ts`**: dos parches de tipos cayeron en la interfaz `Order` en vez de
  `CreateOrderRequest`, porque el texto buscado aparecía antes ahí. Quedó un
  `branchTransferId?: number | 'card_online'` sin sentido en `Order` y
  `CreateOrderRequest` sin `card_online` ni `branchTransferId`. El POS mandaba
  el campo igual (el spread condicional esquiva el chequeo de propiedades), así
  que compilaba y funcionaba, pero sin tipado. Corregido el 18/10/2026.

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
