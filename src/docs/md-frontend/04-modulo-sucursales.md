# Módulo de Sucursales (branches)

ADMIN-only. Ruta: `/branches/list`. Ver doc backend
`07-branches-daily-cash-billing.md`.

## Archivos

- `src/types/api/branch.ts` — tipos (`Branch`, `SiatBranch` anidado).
- `src/services/branchService.ts`
- `src/hooks/useBranchAdmin.ts` — nombrado así (no `useBranches`) para no
  pisar el `useBranches()` ya existente en `src/hooks/useSales.ts` (que es
  otro hook, para otro caso de uso — ver
  [05-pendientes-y-bugs-conocidos.md](05-pendientes-y-bugs-conocidos.md)).
- `src/schemas/branch.schema.ts` — validación del bloque SIAT.
- `src/views/Dashboard/branches/list/` — `BranchListTable.tsx`,
  `BranchFormDialog.tsx` (crear), `BranchEditDialog.tsx` (editar).

## Shape real confirmado (con Swagger, no con el doc a ciegas)

`siatBranch` es un **objeto anidado**, no campos planos en el `Branch`:

```json
// GET /api/branches (lista, paginado)
{
  "data": [
    { "id": 1, "name": "COMERCIAL", "active": false, "createdAt": "...", "siatBranch": null },
    { "id": 2, "name": "Zarga", "active": true, "createdAt": "...", "siatBranch": null }
  ],
  "meta": { "total": 4, "page": 1, "lastPage": 1, ... }
}

// GET /api/branches/:id
{ "id": 2, "name": "Zarga", "active": true, "createdAt": "...", "siatBranch": null }

// PATCH /api/branches/:id
{
  "name": "Sucursal Norte",
  "active": true,
  "siatBranch": {
    "codigoSucursal": 0,
    "name": "Casa Matriz",
    "alias": "CM",
    "razonSocial": "EMPRESA DEMO S.R.L.",
    "actividadEconomica": "477110",
    "address": "Av. Siempre Viva #123",
    "departamento": "Chuquisaca",
    "municipio": "Sucre",
    "telefono": "74409411",
    "active": true
  }
}
```

**Ojo**: existe otro tipo `Branch` en `src/types/api/sales.ts`, usado por el
módulo de ventas/SIAT (`cartService.getBranches()`), con un shape **plano**
(`codigoSucursal`, `razonSocial`, etc. directamente en el branch, sin
`siatBranch` anidado). Es un tipo viejo/distinto, no lo tocamos al crear este
módulo — ver el gap relacionado en
[05-pendientes-y-bugs-conocidos.md](05-pendientes-y-bugs-conocidos.md).

## Endpoints usados

| Endpoint | Body | Notas |
|---|---|---|
| `GET /api/branches?limit=&page=` | — | listar |
| `GET /api/branches/:id` | — | al editar |
| `POST /api/branches` | `{ name, siatBranch? }` | el form de creación solo pide `name` — SIAT se configura después |
| `PATCH /api/branches/:id` | `{ name?, active?, siatBranch? }` | incluye el bloque SIAT completo cuando se activa el checkbox "Configurar datos SIAT" |

**No hay `DELETE`** — el doc backend no lo documenta. Desactivar una sucursal
es `PATCH { active: false }`, y el backend responde `409 Conflict` si tiene
una caja diaria abierta (el mensaje de error ya se muestra tal cual llega,
vía el Snackbar — no se maneja como caso especial).

## Diseño del formulario de edición

`siatBranch.active` es **independiente** de `branch.active` — una sucursal
puede estar activa como sucursal pero con la facturación SIAT desactivada (o
sin configurar). El checkbox "Configurar datos de facturación SIAT" en
`BranchEditDialog.tsx` controla si se manda el bloque `siatBranch` completo
en el PATCH; si está destildado, no se manda esa key en absoluto (no se
manda `siatBranch: undefined`, se omite la key).

## Efecto secundario al crear/editar

`useCreateBranch`/`useUpdateBranch` invalidan también la query
`['branches-list']` (la que usa `BranchContext`), así que el selector global
de la navbar (`BranchSwitcher`) se refresca solo sin recargar la página.
