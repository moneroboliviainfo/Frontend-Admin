# Módulo de Usuarios (staff)

ADMIN-only, gestiona cuentas de `ADMIN`/`MANAGER`/`CASHIER`. Ruta:
`/users/list`. Ver doc backend `09-admin-catalog-crud.md` (sección Users) y
`01-auth-and-sessions.md`.

## Archivos

- `src/types/api/staffUser.ts` — tipos.
- `src/services/userService.ts` — llamadas HTTP.
- `src/hooks/useUsers.ts` — hooks de react-query.
- `src/schemas/staffUser.schema.ts` — validación zod (crear usuario, resetear
  password, cambiar mi password).
- `src/views/Dashboard/users/list/` — `UserListTable.tsx`, `UserFormDialog.tsx`
  (crear), `UserEditDialog.tsx` (editar).
- `src/components/layout/shared/ChangePasswordDialog.tsx` — autoservicio de
  cambio de contraseña, colgado del `UserDropdown.tsx` (dropdown de sesión),
  no de este módulo, pero usa el mismo `userService`.

## Endpoints usados (confirmados contra Swagger real)

| Endpoint | Body / params | Cuándo |
|---|---|---|
| `GET /api/users?limit=&page=` | — | listar (sin `search` — el backend todavía no lo soporta, ver nota abajo) |
| `GET /api/users/:id` | — | al abrir el diálogo de editar (necesario, ver gotcha) |
| `POST /api/users/admin` | `{ name, email, password }` | crear ADMIN |
| `POST /api/users/staff` | `{ name, email, password, rol: 'manager'\|'cashier', branchId }` | crear MANAGER/CASHIER |
| `PATCH /api/users/:id` | `{ name?, email?, password?, branchId?, enabled? }` | editar (solo se mandan los campos que cambiaron) |
| `PATCH /api/users/me/password` | `{ currentPassword, newPassword }` | autoservicio, cualquier rol |

## Gotchas confirmados con el backend real (no adivinados)

1. **`GET /users` (lista) NO trae `branch`** en absoluto (ni siquiera `null`
   — la key no existe en el objeto). **`GET /users/:id` sí lo trae**
   (`branch: null` o `{ id, name }`). Por eso `UserEditDialog` **no** recibe
   el objeto de la fila clickeada — recibe solo el `id` y hace su propio
   `GET /users/:id` (`useUser(id)`) para traer los datos completos, incluida
   la sucursal. Si alguna vez se necesita mostrar la sucursal en la
   **columna** de la tabla (no solo al editar), va a devolver `undefined`
   para todos — habría que confirmar con el backend si eso es un gap real o
   si algún día lo van a agregar al listado.
2. El response también trae `sessionId: string | null` (no usado en la UI
   todavía) — indica si el usuario tiene una sesión activa en este momento.
3. `rol` **no se puede editar** después de creado (confirmado por el usuario
   del proyecto, coincide con el doc backend). Por eso `UserEditDialog` no
   tiene selector de rol — es intencional, no un olvido.
4. El selector de sucursal en `UserFormDialog`/`UserEditDialog` usa
   `useBranchContext()` (el mismo contexto global), **no** el `useBranches()`
   de `useSales.ts` — ese hook tiene un bug real (ver
   [05-pendientes-y-bugs-conocidos.md](05-pendientes-y-bugs-conocidos.md)).
5. El buscador de la tabla se sacó (no comentado, borrado) porque
   `GET /users` todavía no acepta `search` en el backend. Si lo agregan,
   hay que reponer: el campo de búsqueda en `UserListTable.tsx`, el param en
   `UsersParams` (`types/api/staffUser.ts`) y en `userService.getUsers`.

## Notificaciones (éxito/error)

Usa el patrón `Snackbar` + `Alert` + cola (`snackPack`/`messageInfo`/
`showMessage`) que ya usa el resto de la app en sus tablas (`sales/list`,
`discounts`, `advertisement`, etc.) — **no** usa `react-toastify` (se migró
de ahí a este patrón para ser consistente). Detalle importante: como los
diálogos se cierran después de un éxito, el cierre se demora con
`setTimeout(handleClose, 1200)` para que el Snackbar alcance a mostrarse
antes de que el diálogo se desmonte (mismo truco que usa
`SaleDetailsModal.tsx`).

## Menú y permisos

- Entrada "Usuarios" bajo la sección "ADMINISTRACIÓN" en
  `verticalMenuData.tsx`.
- `menuPermissions.ts` → `filterMenuByRole`: para MANAGER se excluye
  explícitamente (`managerExcluded`), porque el filtro de MANAGER por
  default deja pasar todo salvo lo que se excluya a mano (ver gap relacionado
  en pendientes). Para CASHIER no hace falta excluirlo — usa una lista
  blanca que ya no lo incluye.
- `AuthGuard.tsx` → se agregó `/users` a `protectedPaths` (faltaba, así que
  hoy sin sesión se podía llegar a ver el shell de la página antes del 401).
