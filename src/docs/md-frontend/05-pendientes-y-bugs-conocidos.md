# Pendientes y bugs conocidos

Lista de todo lo que quedó identificado durante la migración a sucursales
pero **no** se arregló todavía (o se arregló solo parcialmente). No asumir
que algo de acá "ya se solucionó solo" — confirmar en el código antes.

## 1. `SalesListTable.tsx` no manda `branchId` — riesgo de 403 para ADMIN

`useOrders` (en `SalesListTable.tsx`) no pasa `selectedBranchId` en ningún
lado. Según doc backend 02: *"un ADMIN necesita `?branchId=` en la query para
casi cualquier endpoint de lectura por sucursal (`GET /orders`...)"* — sin
eso, un ADMIN probablemente recibe `403 Forbidden` al listar ventas. Para
MANAGER/CASHIER no es problema (el backend resuelve su sucursal fija sola).

**Fix**: pasar `branchId: selectedBranchId` (de `useBranchContext()`) cuando
el rol es ADMIN, igual que ya hace `useDashboard.ts`.

## 2. `FacturacionList.tsx` tiene su propio selector de sucursal, roto y desconectado

Dos problemas en un mismo componente:

- Usa su propio `useState<number | ''>('')` + un `<Select>` local, en vez de
  `useBranchContext()`/`BranchSwitcher` — segunda fuente de verdad de
  sucursal en la misma app.
- Ese selector local carga sus opciones con `useBranches()` de
  `src/hooks/useSales.ts`, que tiene el bug del punto 3 (`.filter is not a
  function`) — **ya lo pisamos una vez** al construir `UserFormDialog`/
  `UserEditDialog` con el mismo hook, y ahí lo migramos a
  `useBranchContext()`. Acá no se tocó.

**Fix sugerido**: migrar a `useBranchContext()` igual que se hizo en el
módulo de Usuarios.

## 3. `useBranches()` (en `src/hooks/useSales.ts` / `cartService.getBranches()`) — bug de shape

```ts
// cartService.getBranches()
async getBranches(): Promise<Branch[]> {
  const response = await apiClient.get<Branch[]>('/api/branches')
  return response.data   // ← esto es { data: [...], meta: {...} }, no un array
}
```

`GET /api/branches` devuelve el sobre paginado `{ data: [...], meta: {...} }`
(confirmado con Swagger real), no un array plano. Cualquier código que trate
`branchesData` como array directo (`.filter(...)`, `.find(...)`) rompe.
Confirmado que **también afecta** a `SaleDetailsModal.tsx` (línea ~194,
`branchesData?.filter(...)`/`.find(...)`), no solo al selector de
`FacturacionList.tsx`.

**No se arregló** — se evitó usándolo en los módulos nuevos (Usuarios,
Sucursales usan `useBranchContext()` en su lugar). Si se necesita arreglar
`cartService.getBranches()` en sí, hay que revisar todos sus consumidores
actuales (`SaleDetailsModal.tsx`, `FacturacionList.tsx`) porque cambiar el
tipo de retorno los rompe a ellos también si no se ajustan en el mismo commit.

## 4. `dailyCashService.ts` no coincide con los endpoints reales

El doc backend 07 documenta `POST /dailyCash/open`, `GET /dailyCash/current`,
`POST /dailyCash/:id/close`, `GET /dailyCash?branchId=` (historial). El
service actual (`src/services/dailyCashService.ts`) pega a
`GET/POST /api/dailyCash` genéricos, que no son esos endpoints. **No está
consumido por ninguna pantalla todavía** (no hay UI de apertura/cierre de
caja), así que reescribirlo no rompe nada visible hoy — es terreno limpio
para cuando se aborde la Fase 3 del plan.

## 5. Stock por sucursal en variantes — mapeado pero no implementado

Ver el detalle completo en
[06-productos-y-stock-por-sucursal.md](06-productos-y-stock-por-sucursal.md).
En resumen: `variantService.getVariantById()`, `addStock()`, `subtractStock()`
no mandan `branchId` hoy, aunque los tres endpoints reales sí lo piden/aceptan
(confirmado con curl). `VariantsList.tsx` tampoco muestra `availableStock`/
`warehouseStock` todavía (los descarta del response).

## 6. Filtro de menú para MANAGER deja pasar módulos ADMIN-only

`filterMenuByRole` (en `menuPermissions.ts`), rama `MANAGER`: por diseño deja
pasar **todo** el menú salvo lo que se excluya explícitamente a mano
(`managerExcluded`). Hoy esa lista solo excluye `ADMINISTRACIÓN`/`Usuarios`/
`Sucursales` (agregados durante esta migración) — pero Productos,
Categorías, Descuentos, Outfits, Sliders, Banners, Anuncios siguen
**visibles para MANAGER** en el menú, aunque esos módulos son ADMIN-only
según el doc backend 02. El backend los va a rechazar igual (403) si un
MANAGER intenta usarlos, pero el link no debería ni aparecer. No se tocó
porque es un problema preexistente más amplio que excede el alcance de
"agregar Usuarios/Sucursales al menú" — si se aborda, conviene invertir la
lógica: en vez de una lista negra (`managerExcluded`), usar una lista blanca
explícita de qué SÍ puede ver MANAGER, como ya hace CASHIER.

## 7. `canAccessRoute` (en `menuPermissions.ts`) existe pero no se usa

Función que decide si un rol puede acceder a una ruta (ya tenía `/users` y
`/branches` como admin-only antes de que esos módulos existieran). No está
conectada a ningún guard real — `AuthGuard.tsx` solo chequea autenticación,
no rol. Hoy la única protección por rol es: (a) el menú oculta el link, (b)
el backend devuelve 403 si igual se llama al endpoint. Si un MANAGER escribe
`/users/list` a mano en la URL, hoy vería el shell de la página (los datos
fallarían con 403, pero el layout carga). No es una vulnerabilidad de datos,
pero es una inconsistencia de UX pendiente de decidir si vale la pena cerrar.

## 8. `GET /products/:id` no es confiable para stock por sucursal

Ver el detalle completo en
[06-productos-y-stock-por-sucursal.md](06-productos-y-stock-por-sucursal.md).
Devuelve `availableStock`/`warehouseStock` embebidos sin pedir `branchId` (ni
el Swagger lo acepta como param) — probablemente una cuenta agregada/vieja,
no confiable para decisiones por sucursal. Confirmar con el equipo de backend
qué calcula exactamente antes de usarlo para algo que no sea catálogo.
