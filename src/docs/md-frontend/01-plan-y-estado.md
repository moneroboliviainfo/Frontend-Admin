# Plan de migración a sucursales — estado

## Regla base (de los docs del backend)

Solo es "por sucursal" lo **operativo**: ventas, caja diaria, inventario/stock,
billing/facturación de orden. El **catálogo/configuración** (products,
categories, subcategories, sizes, colors, brands, discounts, outfits, places,
sliders, banners, advertisements, multimedia, customers admin) es **global y
ADMIN-only** — no necesita `branchId` ni selector de sucursal.

## Fases del plan original

**Fase 1 — Consolidar la capa de resolución de sucursal.** ✅ Hecho y además
mejorado: en vez de un selector por página, se centralizó en un selector
**global** en la navbar (`BranchSwitcher`, ver
[02-arquitectura-sucursales.md](02-arquitectura-sucursales.md)). Cualquier
componente accede al mismo `selectedBranchId` vía `useBranchContext()`.

**Fase 2 — Arreglar lo que ya estaba roto para ADMIN.** ⚠️ Pendiente. Ver el
detalle en
[05-pendientes-y-bugs-conocidos.md](05-pendientes-y-bugs-conocidos.md):
`SalesListTable` no manda `branchId` (probable 403 para ADMIN), y
`FacturacionList`/`SaleDetailsModal` tienen su propio selector de sucursal
roto y desconectado del contexto global.

**Fase 3 — Módulos operativos prerequisito del POS (caja diaria, stock).**
⚠️ Pendiente. `dailyCashService` no coincide con los endpoints reales
documentados (`/dailyCash/open`, `/current`, `/:id/close`). El stock por
sucursal en variantes está mapeado (ver
[06-productos-y-stock-por-sucursal.md](06-productos-y-stock-por-sucursal.md))
pero todavía no implementado en el frontend.

**Fase 4 — Panel admin: Usuarios y Sucursales.** ✅ Hecho. Ver
[03-modulo-usuarios.md](03-modulo-usuarios.md) y
[04-modulo-sucursales.md](04-modulo-sucursales.md).

**Fase 5 — Pantalla de Inventario** (bodega↔tienda, traspasos, dashboards de
stock). ⚠️ No empezada. Depende de que Fase 3 esté resuelta primero.

## Qué se hizo, en orden cronológico

1. **Rol visible en sesión** — el dropdown de usuario (`UserDropdown.tsx`)
   ahora muestra un chip con el rol (Administrador/Encargado/Cajero), además
   de nombre y email.
2. **Módulo de Usuarios (staff)** completo: listar, crear (ADMIN o
   MANAGER/CASHIER con sucursal), editar (nombre, email, sucursal, habilitar/
   deshabilitar, resetear contraseña). Ver
   [03-modulo-usuarios.md](03-modulo-usuarios.md).
3. **Cambiar mi contraseña** — modal accesible desde el mismo dropdown de
   sesión (`PATCH /users/me/password`), disponible para cualquier rol.
4. **Fix de hydration error** en `AuthGuard.tsx` — el `Box`/`CircularProgress`
   de MUI se renderizaba fuera del árbol del `ThemeProvider` (porque el
   loading state de `AuthGuard` reemplazaba a `{children}`, que es donde vive
   `Providers`/`ThemeProvider`). Se reemplazó por un spinner en HTML/CSS plano
   que no depende de Emotion. También se agregó `/users` y `/branches` a la
   lista de `protectedPaths` (faltaban).
5. **Campos nuevos en Productos**: `weightGrams` y `unitsPerBox`, agregados
   como obligatorios en el formulario de alta/edición (confirmado que el
   backend ya los devuelve/acepta).
6. **Selector de sucursal global** (`BranchSwitcher`) movido de Home a la
   navbar superior (visible en todas las páginas, mismo estado global). Se
   borró el `BranchTabs.tsx` viejo (solo vivía en Home). Es un
   `ToggleButtonGroup` (tabs), no un `Select`, para que se vea claro cuál está
   activa.
7. **Color de tema por sucursal** — al cambiar de sucursal (solo ADMIN), toda
   la app retiñe su color primario según una paleta fija de 10 colores
   asignados por **posición en la lista** de `GET /branches` (no por `id`,
   porque los ids no son consecutivos desde 1). Ver
   [02-arquitectura-sucursales.md](02-arquitectura-sucursales.md).
8. **Módulo de Sucursales (branches)** completo: listar, crear (solo nombre),
   editar (nombre, activa/inactiva, bloque SIAT completo). Ver
   [04-modulo-sucursales.md](04-modulo-sucursales.md).
9. **Documentación de todo el flujo de Productos/Variantes** contra
   responses reales del backend, confirmando qué es global y qué es por
   sucursal, y detectando que `GET /products/:id` no es confiable para stock
   por sucursal (ver
   [06-productos-y-stock-por-sucursal.md](06-productos-y-stock-por-sucursal.md)).

## Qué NO se tocó (a propósito)

Todo el catálogo global: `products` (alta/edición, sin contar los 2 campos
nuevos), `categories`, `subcategories`, `sizes`, `colors`, `brands`,
`discounts`, `outfits`, `sliders`, `banners`, `advertisement`, `customers`
(admin). Ninguno de estos necesita `branchId` según los docs del backend, y
así se mantuvo.
