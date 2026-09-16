# Arquitectura: cómo se maneja la sucursal en el frontend

## La regla del backend que todo esto respeta

`@GetBranchId()` (doc backend 02) resuelve la sucursal así, **por request**,
sin estado en el servidor:
1. Si el usuario logueado tiene sucursal fija (MANAGER/CASHIER) → usa esa.
2. Si no (ADMIN) → toma `?branchId=` de la query string.
3. Si no hay ninguna → `403`.

Como es stateless del lado del backend, el frontend puede tratar "la sucursal
elegida" como una variable de UI pura — no hace falta persistir nada en el
servidor, ni bloquear nada al cambiarla.

## `BranchContext` (`src/contexts/BranchContext.tsx`)

Fuente única de verdad, global, montada en `Providers.tsx` envolviendo toda
la app (no depende de qué página estés viendo).

```ts
const { branches, selectedBranch, selectedBranchId, setSelectedBranch, isLoading, isAdmin, isReady } = useBranchContext()
```

- `branches`: viene de `GET /api/branches`, **filtradas a `active: true`**
  (`fetchBranches` en el propio context hace `.filter(b => b.active)`).
- Solo hace el fetch si `isAdmin` (MANAGER/CASHIER no necesitan la lista,
  tienen su sucursal fija en `user.branch`).
- Auto-selecciona `branches[0]` la primera vez que cargan, si no hay ninguna
  elegida todavía.
- `selectedBranchId` es `null` para MANAGER/CASHIER siempre — **a propósito**:
  esos roles nunca mandan `branchId`, el backend ya sabe cuál es la suya.

### Cómo consumirlo en un hook/servicio nuevo

Patrón ya usado en `useDashboard.ts` (bestsellers, lowStock, ordersCount) —
replicar este patrón, no inventar uno nuevo por pantalla:

```ts
const { selectedBranchId, isReady } = useBranchContext()

return useQuery({
  queryKey: ['algo', selectedBranchId],
  queryFn: () => algoService.getAlgo(selectedBranchId),
  enabled: isReady
})
```

Si `selectedBranchId` es `null` (porque sos MANAGER/CASHIER), simplemente no
se manda `branchId` en la request — el backend resuelve solo.

## `BranchSwitcher` (`src/components/layout/shared/BranchSwitcher.tsx`)

El único selector de sucursal que debería existir en toda la app. Vive en la
navbar superior (`NavbarContent.tsx`, tanto en el layout vertical como el
horizontal), siempre visible, no por página.

- `ToggleButtonGroup` (tabs), no un `<Select>` — se pidió explícitamente así
  para que se vea claro cuál está activa.
- Se auto-oculta si `!isAdmin` o si no hay sucursales activas.
- El tab seleccionado usa `primary.main`/`primary.contrastText` del tema —
  por eso combina automáticamente con el color de la sucursal (ver abajo).

**Importante**: no había que crear un componente nuevo por pantalla para
elegir sucursal (ni un `Select` local en un modal). Cualquier pantalla que
necesite `branchId` simplemente lee `useBranchContext().selectedBranchId` —
el usuario ya la eligió una vez, arriba, para toda la sesión.

⚠️ Sigue existiendo al menos un lugar que **no** sigue esta regla:
`FacturacionList.tsx` tiene su propio `<Select>` de sucursal local,
desconectado de este contexto. Ver
[05-pendientes-y-bugs-conocidos.md](05-pendientes-y-bugs-conocidos.md).

## Color de tema por sucursal

Al cambiar de sucursal (solo ADMIN), toda la app cambia de color primario.
Usa el sistema de theming que ya traía el template (Materio) — no se
construyó nada nuevo de theming, solo se automatizó algo que ya existía
manualmente en el customizer.

- `src/utils/branchColor.ts` — paleta fija de 10 colores. `getBranchColor(index)`
  devuelve el color según la **posición de la sucursal en la lista**
  (`branches[i]`), no según su `id` — los ids reales no son consecutivos
  desde 1 (ej. `COMERCIAL` tiene `id: 1` pero está inactiva; la primera activa
  es `Zarga`, `id: 2`), así que indexar por posición es lo único que garantiza
  "la primera sucursal de la lista siempre es azul".
- `src/components/BranchThemeSync.tsx` — componente sin UI (`return null`)
  que escucha `selectedBranch` (de `BranchContext`) y llama
  `updateSettings({ primaryColor })` (de `useSettings`, el hook de
  `SettingsContext` del template). Se monta en `Providers.tsx`, dentro de
  `ThemeProvider`.

**Por qué es un componente puente y no está metido dentro de `BranchContext`
directamente**: el orden de providers en `Providers.tsx` es
`AuthProvider → BranchProvider → VerticalNavProvider → SettingsProvider → ThemeProvider`.
`BranchProvider` está **arriba** de `SettingsProvider` en el árbol — un
provider padre no puede leer el contexto de uno de sus hijos en React. Por
eso `BranchThemeSync` vive más abajo (dentro de `ThemeProvider`), donde ambos
contextos ya están disponibles, en vez de intentar llamar `useSettings()`
desde adentro de `BranchContext.tsx`.

El color queda guardado en cookie (comportamiento default de
`updateSettings`), así que sobrevive a un F5.
