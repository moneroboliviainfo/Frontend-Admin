# SIAT de bajo nivel (soporte técnico / panel interno)

Es la integración SOAP directa con el SIN (Servicio de Impuestos Nacionales
de Bolivia). Crear/editar CAFC, los puntos de venta de `/operaciones` y
`/codigos` (salvo `verificar-nit`) son **ADMIN + SUPERVISOR**; todo
`/catalogos`, `POST /codigos/verificar-nit` y `GET /cafc` son de **todos los
roles**; `/facturacion`, `/paquetes` y los eventos significativos de
`/operaciones` son de **todos los roles**, con MANAGER/CASHIER limitados a su
sucursal (una factura, paquete o evento de otra sucursal da `404`) — ver [02-roles-and-permissions.md](02-roles-and-permissions.md). El frontend de **ventas**
(POS/storefront) nunca llama nada de esto — usa
`POST /orders/:orderId/facturar` (ver
[07-branches-daily-cash-billing.md](07-branches-daily-cash-billing.md)), que
ya orquesta todo esto por dentro. Esta sección es para un eventual **panel de
soporte/configuración SIAT** (diagnosticar por qué falló una factura,
resincronizar catálogos, ver CUIS/CUFD vigentes, reenviar paquetes de
contingencia).

**La sucursal se elige por `branchId`, como en el resto del sistema — nunca
por `codigoSucursal`.** Todos estos endpoints comparten dos query params
opcionales:

- `branchId` (`Branch.id`): **obligatorio para ADMIN/SUPERVISOR** (sin él →
  `403 La sucursal no pudo ser determinada`); MANAGER/CASHIER usan siempre la
  suya y el que manden se ignora. El backend saca el `codigoSucursal` SIAT de
  los datos SIAT de esa sucursal (sin datos SIAT → `403`; inexistente →
  `404`; la bodega principal → `403`). Las sucursales "solo facturación"
  (DASH 21, ZARGA 701) se aceptan.
- `codigoPuntoVenta`: el punto de venta SIAT de esa sucursal; **por defecto
  `0`** (el que usan las ventas).

`codigoSucursal` en la query **se ignora** (se acepta solo para que un front
viejo no reciba `400`): ya no hace falta mandarlo.

## Catálogos (`/catalogos`) — sincronizar catálogos SIAT desde el SIN

```
POST /catalogos/sincronizacion    ?branchId&codigoPuntoVenta
POST /catalogos/parametricas      ?branchId&codigoPuntoVenta         body: ParametricasDto
POST /catalogos/listas            ?branchId&codigoPuntoVenta         body: ListasDto
POST /catalogos/fecha-hora        ?branchId&codigoPuntoVenta
```
Trae/actualiza las tablas paramétricas del SIN (tipos de documento, unidades
de medida, actividades económicas, etc.) que se usan como catálogos en los
DTOs de facturación.

## Códigos (`/codigos`) — CUIS/CUFD (credenciales de emisión)

```
POST /codigos/cuis              ?branchId&codigoPuntoVenta         solicita/renueva el CUIS
POST /codigos/cufd              ?branchId&codigoPuntoVenta         solicita/renueva el CUFD (rota seguido)
POST /codigos/verificar-nit     ?branchId&codigoPuntoVenta         body: VerificarNitDto — valida un NIT contra el SIN
GET  /codigos/cuis/all                                              lista histórico de CUIS emitidos
GET  /codigos/cufd/all          ?branchId&codigoPuntoVenta&soloVigentes=true|false
```
CUIS/CUFD son los códigos que habilitan a un punto de venta a facturar; se
piden solos automáticamente en el flujo normal (ver
[Plan: getCUFD offline contingencia] para el manejo de caídas de
conectividad) — estos endpoints son para inspeccionar/forzar manualmente.

## Operaciones (`/operaciones`) — eventos significativos y puntos de venta

```
POST /operaciones/evento-significativo            ?branchId&codigoPuntoVenta         registra un evento (ej. corte de luz, sistema caído)
GET  /operaciones/evento-significativo            ?branchId&codigoPuntoVenta         lista eventos registrados
POST /operaciones/evento-significativo/consulta   ?branchId&codigoPuntoVenta         consulta contra el SIN

POST /operaciones/punto-venta                     ?branchId&codigoPuntoVenta         registra un punto de venta nuevo ante el SIN
GET  /operaciones/punto-venta                                                        lista puntos de venta registrados (local)
POST /operaciones/punto-venta/consulta            ?branchId                           consulta contra el SIN
POST /operaciones/punto-venta/cierre              ?branchId&codigoPuntoVenta         cierra un punto de venta
```
Los tres de **evento significativo** son de todos los roles (MANAGER/CASHIER
siempre sobre su sucursal); los de **punto de venta**, solo ADMIN/SUPERVISOR.

Un "evento significativo" es lo que dispara el modo **contingencia** (emitir
facturas offline cuando el SIN no responde) — ver
[siat-unreachable-from-new-vps] para contexto de por qué esto importa en este
proyecto puntualmente.

## Paquetes (`/paquetes`) — envío masivo de facturas al SIN

```
POST /paquetes                                    envía el paquete acumulado de facturas online pendientes
POST /paquetes/contingencia                        body: CreatePaqueteContingenciaDto — envía paquete de facturas emitidas en contingencia
GET  /paquetes/contingencia/:cafc/eventos          ?branchId&codigoPuntoVenta       eventos pendientes de un CAFC
GET  /paquetes?limit=&page=&search=&branchId=&codigoPuntoVenta=&fechaInicio=&fechaFin=
GET  /paquetes/:id
POST /paquetes/validacion/:id                      valida el resultado de un paquete ya enviado
```
Existe un cronjob de envío batch (mencionado en el layout de módulos) — estos
endpoints son para forzar/inspeccionar manualmente, no para que el flujo de
venta normal los llame.

`POST /paquetes/validacion/:id` actualiza cada factura del paquete según el
**veredicto de SIAT** (`VALIDADA`, `RECHAZADA` u `OBSERVADA`), y solo las que
siguen `ENVIADA` (no pisa anuladas, revertidas ni reemplazadas). Si SIAT
todavía no dio veredicto, las facturas quedan `ENVIADA`: reintentá más tarde.
Si SIAT no responde → `503`. Una factura `RECHAZADA` se corrige
refacturando su orden (ver
[07-branches-daily-cash-billing.md](07-branches-daily-cash-billing.md)).

## CAFC (`/cafc`) — Código de Autorización de Facturación en Contingencia

```
POST   /cafc
GET    /cafc
GET    /cafc/:id
PATCH  /cafc/:id
```
CRUD simple sobre el registro local de CAFCs (los códigos que habilitan a
facturar en modo offline/contingencia). `GET` es de todos los roles (para
elegir el `cafc` al facturar en contingencia); `POST`/`PATCH`, solo
ADMIN/SUPERVISOR.

## Facturacion (`/facturacion`) — bajo nivel, no confundir con `/orders/:id/facturar`

```
GET  /facturacion/facturacion/verificar-comunicacion                          ping al SIN
POST /facturacion/facturacion/online            ?branchId&codigoPuntoVenta         body: CreateFacturaDto
POST /facturacion/facturacion/contingencia      ?branchId&codigoPuntoVenta         body: CreateFacturaContingenciaDto
POST /facturacion/facturacion/offline           ?branchId&codigoPuntoVenta         body: CreateFacturaDto
POST /facturacion/facturacion/verificacion                                         body: VerificacionEstadoFacturaDto
POST /facturacion/facturacion/anulacion                                            body: AnulacionFacturaDto — anula una factura ya emitida
POST /facturacion/facturacion/reversion                                            body: ReversionAnulacionFacturaDto — revierte una anulación
GET  /facturacion/facturacion?branchId=&codigoPuntoVenta?=&limit=&page=&search=&fechaInicio=&fechaFin=
GET  /facturacion/facturacion/:id/representacion-grafica                           PDF (application/pdf), ver nota abajo
```
**Ojo con la ruta duplicada**: el controller vive en `/facturacion` y cada
ruta interna vuelve a empezar con `facturacion/...` — así que la URL real es
`/api/facturacion/facturacion/online`, no `/api/facturacion/online`. Es así
en el código, no es un error de este doc.

- `online`/`offline`/`contingencia` son las tres formas de emitir una
  factura directamente contra el SIN (bypaseando todo el flujo de
  `orders`) — **normalmente no se usan así**; el flujo real pasa por
  `POST /orders/:orderId/facturar`, que arma el `CreateFacturaDto` con los
  datos de la orden y llama a esto por dentro.
- **Datos del emisor**: `razonSocialEmisor`, `municipio`, `telefono` y
  `nombreSucursal` del body **se ignoran** (ahora son opcionales): el backend
  los toma de los datos SIAT de la sucursal (`branchId`), y
  `nombreSucursal` sale como `<nombre SIAT> <código>` (ej. `COMERCIAL 2`),
  igual que en las facturas de venta. Si esa sucursal SIAT está **desactivada**
  (`siatBranch.active = false`) → `400 La sucursal SIAT N está desactivada para
  facturar`; si no existe → `404`. Sus facturas viejas se siguen listando.
- `anulacion`/`reversion` — no tienen contraparte en `/orders`; si tu panel
  de soporte necesita anular una factura ya emitida, es acá. Reglas:
  - solo se anula una factura `VALIDADA` (otro estado → `400` con el motivo);
  - una `ANULADA` se revierte **o** se refactura su orden, no las dos: si ya
    tiene factura de reemplazo, revertir da `400`;
  - una `REVERTIDA` es vigente y **definitiva**: no se puede volver a anular.
  Tabla completa de estados en
  [07-branches-daily-cash-billing.md](07-branches-daily-cash-billing.md).
- **Listado** (`GET /facturacion/facturacion`): por **sucursal** del sistema
  (`?branchId=`, como el resto de los endpoints de ADMIN/SUPERVISOR); el
  `codigoSucursal` SIAT sale de los datos SIAT de esa sucursal. Ya **no**
  acepta `codigoSucursal` (`400`). `codigoPuntoVenta` es opcional: sin él,
  todos los puntos de venta de la sucursal. Sin `branchId` → `403`;
  sucursal inexistente → `404`; sucursal sin datos SIAT → `400`. Devuelve
  `{ data, meta, totalFacturado }`, más nuevas primero.
- El total facturado del listado (`totalFacturado`) cuenta las facturas
  `VALIDADA` y `REVERTIDA`.
- **PDF**: `GET /facturacion/facturacion/:id/representacion-grafica` es el
  único lugar donde se puede pedir el PDF de una factura por API (todos los
  roles; MANAGER/CASHIER solo facturas de su sucursal) — ver la nota en
  [07-branches-daily-cash-billing.md](07-branches-daily-cash-billing.md)
  sobre por qué el POS no lo usa.

## `/siat` — controller vacío

```
(nada — @Controller('siat') sin rutas propias)
```
Existe como agrupador/futuro, no expone ningún endpoint hoy.
