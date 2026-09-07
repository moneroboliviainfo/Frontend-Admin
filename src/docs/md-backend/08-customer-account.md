# Cuenta del cliente (storefront)

Todo esto requiere un token de `Customer` (Google OAuth o guest — ver
[01-auth-and-sessions.md](01-auth-and-sessions.md)) vía `@Auth()` +
`@GetCustomer()`. Un token de staff (`User`) es rechazado.

## Perfil

```
GET /web-page/customers/me
```
Datos del cliente logueado.

## Direcciones

CRUD completo, siempre scoped al cliente logueado — no hace falta (ni sirve)
mandar el id de otro cliente, el backend filtra por `customer.id` en cada
operación.

```
POST   /addresses
GET    /addresses
GET    /addresses/:id
PATCH  /addresses/:id
DELETE /addresses/:id      (soft-delete)
```
Se usan para el checkout online (`address` en `CreateOrderOnlineDto` es el
id de una de estas).

## Mis órdenes

```
GET /web-page/customers/order/:id
```
Trae la orden completa (items, shipment, address, billing, factura) **solo
si es del cliente logueado** — si el id existe pero es de otro cliente,
`404` (no `403`, para no filtrar existencia).

```
POST /web-page/customers/cancel/order/:id
```
Autoservicio: el cliente cancela su propia orden. **Solo funciona si sigue
`PENDING`** — una vez pagada (`PAID`/`SENT`), el cliente ya no puede
cancelarla solo; tiene que pedirlo por soporte (lo hace un MANAGER/CASHIER
vía `POST /orders/cancel/:id`).

## Lo que NO existe para el cliente

- No hay "editar mi orden" — eso es exclusivo de staff (ver
  [05-orders-lifecycle-and-pos.md](05-orders-lifecycle-and-pos.md)).
- No hay historial paginado de "todas mis órdenes" documentado en este
  controller — si tu UI necesita una lista completa, confirmá en Swagger si
  existe o si hay que pedirla de otra forma.
- No hay edición de perfil (nombre/email) expuesta acá — confirmar si existe
  en otro lado antes de asumir que no.
