# Docs del frontend — migración a sucursales

Estos documentos registran el trabajo hecho para adaptar el admin (Monero-Admin)
al modelo de sucursales del backend (ver `src/docs/md-backend`). Son una
**bitácora de decisiones y estado**, no reemplazan al código — antes de asumir
que algo "ya está hecho", confirmá en el archivo correspondiente y, si hace
falta, en el propio código.

## Cómo usar esto

- Si volvés a este proyecto después de un tiempo, empezá por
  [01-plan-y-estado.md](01-plan-y-estado.md) — resume qué se decidió hacer, en
  qué orden, y qué falta.
- Si vas a tocar algo de sucursales/branchId, leé
  [02-arquitectura-sucursales.md](02-arquitectura-sucursales.md) primero —
  explica cómo se resuelve la sucursal en el frontend y por qué está armado así.
- Si vas a tocar Usuarios o Sucursales (los módulos admin), están documentados
  endpoint por endpoint en sus propios archivos.
- [05-pendientes-y-bugs-conocidos.md](05-pendientes-y-bugs-conocidos.md) es la
  lista de lo que sabemos que está roto o a medio migrar — revisalo antes de
  decir "esto ya andaba".

## Índice

| Archivo | Contenido |
|---|---|
| [01-plan-y-estado.md](01-plan-y-estado.md) | El plan de migración a sucursales completo, fase por fase, y qué se hizo de cada una |
| [02-arquitectura-sucursales.md](02-arquitectura-sucursales.md) | `BranchContext`, `BranchSwitcher`, cómo se resuelve `branchId` para ADMIN vs MANAGER/CASHIER, el theming por sucursal |
| [03-modulo-usuarios.md](03-modulo-usuarios.md) | CRUD de Usuarios (staff): endpoints, campos, gotchas confirmados con el backend real |
| [04-modulo-sucursales.md](04-modulo-sucursales.md) | CRUD de Sucursales: endpoints, shape de `siatBranch`, reglas |
| [05-pendientes-y-bugs-conocidos.md](05-pendientes-y-bugs-conocidos.md) | Todo lo que quedó identificado como roto, inconsistente, o pendiente de decidir |
| [06-productos-y-stock-por-sucursal.md](06-productos-y-stock-por-sucursal.md) | Qué es global (catálogo) vs qué es por sucursal (stock), mapa de endpoints confirmado con responses reales |
| [07-migracion-bodega-y-anticipos.md](07-migracion-bodega-y-anticipos.md) | Checklist de control: rol SUPERVISOR, portado desde `main`, bodega central, traslados entre sucursales, pedidos con anticipo |

## Contexto del negocio (recordatorio rápido)

Monero es retail de ropa con tienda online y sucursales físicas (POS). El
mismo backend sirve ambos canales. Roles de staff: `ADMIN` (config/catálogo,
no opera ventas), `MANAGER`/`CASHIER` (ventas, atados a una sucursal fija).
Ver `src/docs/md-backend/02-roles-and-permissions.md` para el detalle completo
de esa matriz — acá solo documentamos el lado frontend.
