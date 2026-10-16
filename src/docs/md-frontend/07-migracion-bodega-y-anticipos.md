# Migración: SUPERVISOR, bodega central, traslados y pedidos con anticipo

## Por qué existe este doc

El backend entregó docs actualizados (`src/docs/md-backend/`, reemplazados el
13/10/2026 — ver `12-changelog-2026-09.md` y `14-changelog-2026-10.md`). Es un
cambio grande: un rol nuevo y dos módulos de negocio enteros. Demasiado para un
solo cambio: esta es la lista de control para ir pieza por pieza.

**Regla de oro**: antes de marcar algo ✅, confirmalo contra el código actual, no
contra lo que diga este archivo de una sesión vieja.

## ⚠️ Importante: a qué backend apuntás

El backend nuevo **no está en producción**. Verificado el 15/10/2026:

| Backend | Endpoints nuevos (`/central-warehouse`, `/settings`, `/dailyCash/current`) |
|---|---|
| `api.moneroget.com` (producción) | ❌ 404 — versión vieja |
| `monerodevelop-backend-...sslip.io` (desarrollo) | ✅ 401 (existen) |

Todo lo implementado acá **requiere el backend de desarrollo** en
`NEXT_PUBLIC_API_URL`. Apuntando a producción, el POS se rompe: `reprice` y
`change-status` no existen ahí.

## ⏸ Pendiente de verificar en la UI (bloqueado por el backend)

Implementado y con `tsc`/eslint en verde, pero **no probado en el navegador**
porque en el backend de desarrollo **las sucursales no tienen configurado SIAT**,
y sin eso no cargan los catálogos. Queda bloqueado:

| Qué | Por qué está bloqueado |
|---|---|
| **Venta en tienda completa** (el cambio de `reprice`) | El modal de pago pide los tipos de documento al catálogo SIAT (`POST /catalogos/parametricas`); sin SIAT configurado no carga el formulario de facturación y no se llega a cobrar |
| **Facturar / refacturar** (`ANULADA`/`RECHAZADA`, botón "Emitir Nueva Factura", tarjeta "Facturas Anteriores") | Necesita una sucursal con `siatBranch` activo (CUIS/CUFD) |

**Para desbloquear**: configurar SIAT en al menos una sucursal del backend de
desarrollo. Hasta entonces, el cambio más riesgoso de la Fase 2 (el nuevo
`POST /orders/reprice` con el token en el body) **sigue sin confirmarse contra el
backend real** — es lo primero que hay que probar cuando se pueda.

Lo que **sí** se puede probar sin SIAT: rol SUPERVISOR, menús y rutas por rol,
alta de usuarios, selector de sucursal, y el detalle de orden (tarjeta FedEx,
actores y fechas, chip FedEx en la lista).

## Estado

- ❌ No empezado · ⚠️ Parcial · ✅ Hecho y verificado

---

## Fase 1 — Rol `SUPERVISOR` ✅ (15/10/2026)

- [x] `types/api/auth.ts`: `supervisor`/`SUPERVISOR` + `normalizeRole`.
- [x] `menuPermissions.ts`: ve lo mismo que ADMIN **salvo Usuarios** (ni menú ni
      ruta `/users`). `canAccessRoute`: todo salvo `/sales/instore` y `/users`.
- [x] `AuthGuard` / `getHomeRouteByRole`: sin cambios — ya caían bien por descarte.
- [x] Alta de usuario: opción "Supervisor", manda `rol` en `POST /users/admin`,
      no pide sucursal. Schema y `CreateAdminDto` actualizados.
- [x] Chequeos de rol: el punto central era `BranchContext` — su `isAdmin` ahora
      significa "no tiene sucursal fija" (ADMIN o SUPERVISOR), así que los ~10
      componentes que hacen `branchId = isAdmin ? ... : undefined` quedaron
      correctos sin tocarlos. En `useUserRole` se agregaron `isSupervisor` e
      `isAdminLike`; `isAdmin` quedó estricto (solo ADMIN crea/edita usuarios).
- [x] Etiquetas "Supervisor" en `UserDropdown`, `UserListTable` (label + color)
      y `Congratulations`.

---

## Fase 2 — Portado desde `main` ⚠️ (15/10/2026 — implementado, verificación parcial)

- [x] `POST /orders/reprice` con `{ items, type }` en el body (sin `:token`).
- [x] `Order`: `trackingCode`, `fedex_shipping_data`, `fedex_shipment_response`,
      `fedexShipmentCancelled` (+ tipos `Fedex*`). Se eliminó `dhl_code`.
- [x] `PUT /orders/change-status/:id` con `trackingCode` opcional.
- [x] Refacturar: `canInvoice` acepta factura `ANULADA` **y `RECHAZADA`**. El
      botón dice "Emitir Nueva Factura" si ya hay factura previa.
- [x] `canEditOrder` corta si la orden es online y tiene `fedex_shipping_data`.
- [x] Tarjeta "Envío FedEx" (guía, bultos, peso, botón PDF) + chip FedEx en la
      lista de ventas.
- [ ] `card_online` falta en `CreateOrderRequest` (lo tiene `Order`). Unificar.
- [ ] **Sin verificar en la UI**: venta completa (reprice) y facturar/refacturar
      — ver la sección de bloqueados arriba.

**No se portó a propósito** (en `main` está viejo, `develop` está mejor): el
auto-select de sucursal por `codigoSucursal === 3`, el filtro de roles por email
en `SalesListTable`, y `addToCart` sin `?type=in_store`.

---

## Fase 3 — Actores, historial y fixes ⚠️ (15/10/2026 — implementado, verificación parcial)

- [x] Actores y fechas: `createdBy`, `editedBy`, `cancelledBy`, `sentBy`,
      `paidAt`, `cancelledAt`, `sentAt` tipados y mostrados en el detalle. Si
      `cancelledBy` es null se muestra "por el sistema".
- [x] `facturasAnteriores`: tarjeta "Facturas Anteriores" en el detalle.
- [x] Factura `REVERTIDA` = vigente: ya estaba resuelto de antes (verde junto a
      VALIDADA y cuenta como factura activa). No hizo falta tocar nada.
- [x] Kardex: no aplica — no existe pantalla de movimientos. Contemplar los tipos
      nuevos cuando se construya (Fase 4).
- [x] `addstock` ya no acepta MANAGER: tampoco hizo falta — el MANAGER ya no ve
      el menú Productos ni entra a `/products` (Fase 1).

---

## Fase 4 — Bodega central + traslados entre sucursales ❌

Doc: [11-central-warehouse-and-branch-transfers.md](../md-backend/11-central-warehouse-and-branch-transfers.md).
Módulo nuevo completo. El stock nuevo ya no entra directo a una tienda: entra a
una bodega central y alguien tiene que **enviarlo** y la tienda **recibirlo**.

- [ ] Bodega principal: ver/renombrar (`GET/PATCH /central-warehouse`), stock,
      altas y bajas.
- [ ] Envíos bodega → tienda: crear, listar, anular, marcar perdido.
- [ ] Recibir (envíos y pedidos): pantalla "por recibir" + faltantes por línea.
- [ ] Revisión de faltantes (ADMIN/SUPERVISOR).
- [ ] Ajuste positivo en tienda (nota obligatoria).
- [ ] Pedidos entre sucursales sin cobro: buscar stock
      (`GET /variants/branch-stock/*`), crear, despachar, recibir.
- [ ] POS: "buscar en otras sucursales" y enlazar el pedido con
      `branchTransferId` en reprice y creación.
- [ ] Badges con `GET /branch-transfers/pending-count` (~30 s).
- [ ] Estadística de retiro (`pickup-stats`).
- [ ] Usar `inTransitStock` donde se muestre stock.

---

## Fase 5 — Pedidos cobrados con anticipo ❌

Doc: [13-prepaid-branch-requests.md](../md-backend/13-prepaid-branch-requests.md).
**Depende de la Fase 4.**

- [ ] Configuración de plazos (`GET/PATCH /settings`).
- [ ] Nuevo pedido con cobro: cotizar (`requests/quote`) → cobrar → crear.
- [ ] Cobro por QR: pantalla de espera, polling, estado `pending_payment`.
- [ ] Devoluciones de anticipo (`?pendingRefund=true`, badge, botón Devolver).
- [ ] POS venta de retiro: **cobrar `amountDue`, nunca `total`**.
- [ ] Corregir venta de retiro: ofrecer editar, no cancelar + nueva.
- [ ] Anticipo perdido (`advanceForfeited`).
- [ ] Cierre de caja con desglose (`salesAmount`, `advancesAmount`,
      `refundsAmount`).
- [ ] Actores `null` del sistema → mostrar "Sistema (pago QR)".
- [ ] Usar `pickupDeadline`/`holdUntil`, no recalcular desde `receivedAt`.

---

## Bugs viejos encontrados y corregidos en el camino

1. **`FacturacionList.tsx`** desestructuraba `excludedBranchCodes` /
   `allowedBranchCodes` de `useUserRole`, que no existen en `develop` (son del
   modelo de roles por email de `main`): **el proyecto no compilaba**. Se
   reemplazó por un filtro de sucursales activas.
2. **Punto muerto en `BranchContext`**: `isReady` solo se liberaba con una
   sucursal seleccionada, y el error de `GET /api/branches` no se manejaba. Si
   esa llamada fallaba, el dashboard y la lista de ventas quedaban cargando para
   siempre y el selector de sucursal **desaparecía**, sin ningún mensaje. Ahora
   se libera igual cuando no hay sucursales que elegir, y el selector avisa
   ("No se pudieron cargar las sucursales").
