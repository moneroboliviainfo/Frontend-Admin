# Sucursales, caja diaria y facturación

## Sucursales

Cada `Branch` puede tener (o no) datos de facturación SIAT asociados
(`SiatBranch`: CUIS/CUFD, código de sucursal SIN, razón social, dirección,
etc.). **Una sucursal sin `SiatBranch` activo no puede vender online** — no
aparece en `GET /web-page/branches` (el selector del checkout) y si se
intenta crear una orden online para esa sucursal igual, el backend la
rechaza (`400`) porque la venta se factura sola al confirmar el pago y sin
SIAT quedaría sin factura. **En tienda física sí se puede vender sin SIAT
configurado** (la venta queda, pero no se puede facturar hasta que se
configure).

```
GET  /branches                (A)  lista con datos SIAT
GET  /branches/:id            (A)
POST /branches                (A)
PATCH /branches/:id           (A)  incluye actualizar el bloque siatBranch
```
No se puede desactivar (`active: false`) una sucursal con una caja abierta
— `409 Conflict` hasta que se cierre.

## Caja diaria (`dailyCash`)

Un turno de caja por sucursal. Solo puede haber **una caja abierta a la vez**
por sucursal.

```
POST /dailyCash/open
{ "openingAmount": "200.00" }
→ DailyCash { id, status: "open", openedAt, openedBy, branch }

GET /dailyCash/current
→ la caja abierta de tu sucursal (o 404/null si no hay ninguna — chequear
  antes de intentar abrir otra)

POST /dailyCash/:id/close
{ "closingAmount": "1350.00", "closingNote?": "Faltante de 5 Bs, revisado con el cajero" }
→ DailyCash { status: "closed", expectedAmount, closingAmount, closedBy, ... }
```
`expectedAmount` se calcula **en el momento del cierre** (suma de ventas
in-store reales desde `openedAt` hasta ahora), no es un contador que el
frontend tenga que llevar. Comparalo contra `closingAmount` para mostrar
sobrantes/faltantes.

```
GET /dailyCash?limit=&page=&branchId=(solo ADMIN)      (A, M)  historial
```
MANAGER siempre ve el de su sucursal; ADMIN filtra con `?branchId=` o ve
todas si lo omite.

## Datos de facturación del cliente (`billing`)

```
GET  /billing/:ci      (M, C)   busca por CI/NIT, para autocompletar en el POS
POST /billing          (M, C)   crear/actualizar un registro
```
`ci`, `codigoTipoDocumentoIdentidad` son obligatorios; `name`, `phone`,
`email`, `complemento` opcionales. Estos mismos campos son los que se mandan
embebidos en `billing` al crear cualquier orden (in-store u online) — no
hace falta llamar `POST /billing` aparte si ya lo mandás en la creación de
la orden, el backend lo crea/actualiza solo.

## Facturación (SIAT)

Dos niveles:

### Nivel orden (lo que usa el frontend de ventas)
```
POST /orders/:orderId/facturar                (M, C)
POST /orders/:orderId/facturar-contingencia    (M, C)
```
Emite la factura para una orden específica. Falla si la orden ya tiene
factura, no tiene `billing`, o no es de tu sucursal.

**Venta online: se factura sola.** Al confirmarse el pago (webhook QR o
Cybersource), el backend dispara la facturación automáticamente
(fire-and-forget, no bloquea la respuesta del webhook). Si falla (datos
faltantes, SIAT caído), la orden queda `PAID` sin factura y **no hay
reintento automático** — se factura a mano después con el endpoint de
arriba.

**Venta in-store: manual siempre.** El cajero/manager decide cuándo facturar
llamando el endpoint de arriba.

### Nivel SIAT bajo nivel (ADMIN, uso interno/soporte)
Todo bajo `/facturacion`, `/cafc`, `/catalogos`, `/codigos`, `/paquetes`,
`/operaciones` — configuración de CUIS/CUFD, catálogos SIAT, puntos de
venta, contingencia, paquetes de envío masivo. El frontend de ventas
normalmente **no** llama nada de esto directamente; es panel de
administración/soporte técnico.

### PDF de la factura
Existe `GET /facturacion/facturacion/:id/representacion-grafica` (ADMIN) que
devuelve el PDF. **No está expuesto para MANAGER/CASHIER a propósito** — el
cliente recibe la factura por email al momento de facturar. Si tu POS
necesita reimprimir/mostrar el PDF en el momento de la venta, es un gap
conocido, no algo que ya funcione — avisá antes de asumirlo.
