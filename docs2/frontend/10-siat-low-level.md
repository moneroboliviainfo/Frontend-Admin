# SIAT de bajo nivel (soporte técnico / panel interno)

Todo lo de acá es **ADMIN + SUPERVISOR** y es la integración SOAP directa con el SIN
(Servicio de Impuestos Nacionales de Bolivia). El frontend de **ventas**
(POS/storefront) nunca llama nada de esto — usa
`POST /orders/:orderId/facturar` (ver
[07-branches-daily-cash-billing.md](07-branches-daily-cash-billing.md)), que
ya orquesta todo esto por dentro. Esta sección es para un eventual **panel de
soporte/configuración SIAT** (diagnosticar por qué falló una factura,
resincronizar catálogos, ver CUIS/CUFD vigentes, reenviar paquetes de
contingencia).

Todos estos endpoints comparten dos query params casi siempre obligatorios:
`codigoPuntoVenta` y `codigoSucursal` (identifican el punto de venta SIAT
contra el que se opera — no confundir con el `id` interno de `Branch`).
Confirmá en Swagger cuáles son opcionales caso por caso.

## Catálogos (`/catalogos`) — sincronizar catálogos SIAT desde el SIN

```
POST /catalogos/sincronizacion    ?codigoPuntoVenta&codigoSucursal
POST /catalogos/parametricas      ?codigoPuntoVenta&codigoSucursal   body: ParametricasDto
POST /catalogos/listas            ?codigoPuntoVenta&codigoSucursal   body: ListasDto
POST /catalogos/fecha-hora        ?codigoPuntoVenta&codigoSucursal
```
Trae/actualiza las tablas paramétricas del SIN (tipos de documento, unidades
de medida, actividades económicas, etc.) que se usan como catálogos en los
DTOs de facturación.

## Códigos (`/codigos`) — CUIS/CUFD (credenciales de emisión)

```
POST /codigos/cuis              ?codigoPuntoVenta&codigoSucursal   solicita/renueva el CUIS
POST /codigos/cufd              ?codigoPuntoVenta&codigoSucursal   solicita/renueva el CUFD (rota seguido)
POST /codigos/verificar-nit     ?codigoPuntoVenta&codigoSucursal   body: VerificarNitDto — valida un NIT contra el SIN
GET  /codigos/cuis/all                                              lista histórico de CUIS emitidos
GET  /codigos/cufd/all          ?codigoPuntoVenta&codigoSucursal&soloVigentes=true|false
```
CUIS/CUFD son los códigos que habilitan a un punto de venta a facturar; se
piden solos automáticamente en el flujo normal (ver
[Plan: getCUFD offline contingencia] para el manejo de caídas de
conectividad) — estos endpoints son para inspeccionar/forzar manualmente.

## Operaciones (`/operaciones`) — eventos significativos y puntos de venta

```
POST /operaciones/evento-significativo            ?codigoPuntoVenta&codigoSucursal   registra un evento (ej. corte de luz, sistema caído)
GET  /operaciones/evento-significativo            ?codigoPuntoVenta&codigoSucursal   lista eventos registrados
POST /operaciones/evento-significativo/consulta   ?codigoPuntoVenta&codigoSucursal   consulta contra el SIN

POST /operaciones/punto-venta                     ?codigoPuntoVenta&codigoSucursal   registra un punto de venta nuevo ante el SIN
GET  /operaciones/punto-venta                                                        lista puntos de venta registrados (local)
POST /operaciones/punto-venta/consulta            ?codigoSucursal                     consulta contra el SIN
POST /operaciones/punto-venta/cierre              ?codigoPuntoVenta&codigoSucursal   cierra un punto de venta
```
Un "evento significativo" es lo que dispara el modo **contingencia** (emitir
facturas offline cuando el SIN no responde) — ver
[siat-unreachable-from-new-vps] para contexto de por qué esto importa en este
proyecto puntualmente.

## Paquetes (`/paquetes`) — envío masivo de facturas al SIN

```
POST /paquetes                                    envía el paquete acumulado de facturas online pendientes
POST /paquetes/contingencia                        body: CreatePaqueteContingenciaDto — envía paquete de facturas emitidas en contingencia
GET  /paquetes/contingencia/:cafc/eventos          ?codigoSucursal&codigoPuntoVenta   eventos pendientes de un CAFC
GET  /paquetes?limit=&page=&search=&codigoPuntoVenta=&codigoSucursal=
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
facturar en modo offline/contingencia).

## Facturacion (`/facturacion`) — bajo nivel, no confundir con `/orders/:id/facturar`

```
GET  /facturacion/facturacion/verificar-comunicacion                          ping al SIN
POST /facturacion/facturacion/online            ?codigoPuntoVenta&codigoSucursal   body: CreateFacturaDto
POST /facturacion/facturacion/contingencia      ?codigoPuntoVenta&codigoSucursal   body: CreateFacturaContingenciaDto
POST /facturacion/facturacion/offline           ?codigoPuntoVenta&codigoSucursal   body: CreateFacturaDto
POST /facturacion/facturacion/verificacion                                         body: VerificacionEstadoFacturaDto
POST /facturacion/facturacion/anulacion                                            body: AnulacionFacturaDto — anula una factura ya emitida
POST /facturacion/facturacion/reversion                                            body: ReversionAnulacionFacturaDto — revierte una anulación
GET  /facturacion/facturacion?codigoPuntoVenta=&codigoSucursal=&limit=&page=&search=&fechaInicio=&fechaFin=
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
- `anulacion`/`reversion` — no tienen contraparte en `/orders`; si tu panel
  de soporte necesita anular una factura ya emitida, es acá. Reglas:
  - solo se anula una factura `VALIDADA` (otro estado → `400` con el motivo);
  - una `ANULADA` se revierte **o** se refactura su orden, no las dos: si ya
    tiene factura de reemplazo, revertir da `400`;
  - una `REVERTIDA` es vigente y **definitiva**: no se puede volver a anular.
  Tabla completa de estados en
  [07-branches-daily-cash-billing.md](07-branches-daily-cash-billing.md).
- El total facturado del listado (`GET /facturacion/facturacion`) cuenta las
  facturas `VALIDADA` y `REVERTIDA`.
- **PDF**: `GET /facturacion/facturacion/:id/representacion-grafica` es el
  único lugar donde se puede pedir el PDF de una factura por API, y es solo
  ADMIN/SUPERVISOR a propósito — ver la nota en
  [07-branches-daily-cash-billing.md](07-branches-daily-cash-billing.md)
  sobre por qué el POS no lo usa.

## `/siat` — controller vacío

```
(nada — @Controller('siat') sin rutas propias)
```
Existe como agrupador/futuro, no expone ningún endpoint hoy.
