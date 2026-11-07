# Cuenta del cliente (storefront)

Todo esto requiere un token de `Customer` (Google OAuth o guest — ver
[01-auth-and-sessions.md](01-auth-and-sessions.md)) vía `@Auth()` +
`@GetCustomer()`. Un token de staff (`User`) es rechazado.

## Perfil

```
GET /web-page/customers/me
```
Datos del cliente logueado, con `address[]` (cada una con su `place`) y
`orders[]` (**todas** sus órdenes, sin paginar y sin relaciones: para el
detalle, `GET /web-page/customers/order/:id`). Un guest recibe los dos vacíos.

⚠️ En `orders[]` una orden vencida puede seguir como `pending` hasta que otra
lectura la actualice: tratá como vencida cualquier `pending` con `expiresAt` en
el pasado. El detalle sí viene actualizado (`expired`). Una orden con tarjeta
vencida puede pasar después a `paid` si llega un pago tardío: no la des por perdida
si el cliente dice haber pagado, volvé a consultarla.

## Direcciones

CRUD completo, siempre scoped al cliente logueado — no hace falta (ni sirve)
mandar el id de otro cliente, el backend filtra por `customer.id` en cada
operación. Con un token de invitado, solo ve las direcciones de esa sesión (ver
[01](01-auth-and-sessions.md)).

```
POST   /addresses          { address, city, type: "national" | "international", country?, postal_code?, place? }
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
`404` (no `403`, para no filtrar existencia). Un invitado solo ve las órdenes
creadas con su mismo token.

```
POST /web-page/customers/cancel/order/:id
```
Autoservicio: el cliente cancela su propia orden. **Solo funciona si sigue
`PENDING`** — una vez pagada (`PAID`/`SENT`), el cliente ya no puede
cancelarla solo; tiene que pedirlo por soporte (lo hace un MANAGER/CASHIER
vía `POST /orders/cancel/:id`). Otro estado, ya vencida o de otro cliente →
`404`. **La orden cancelada desaparece**: deja de salir en `orders[]` y su
detalle pasa a dar `404`, así que usá la respuesta de este `POST` para mostrar
el resultado.

## Lo que NO existe para el cliente

- No hay "editar mi orden" — eso es exclusivo de staff (ver
  [05-orders-lifecycle-and-pos.md](05-orders-lifecycle-and-pos.md)).
- No hay historial **paginado** de órdenes: la lista completa viene en
  `orders[]` de `GET /web-page/customers/me`.
- No hay endpoint para que el cliente edite su perfil. Lo único que lo cambia
  es el checkout: `name` y `phone` de `POST /web-page/orders/online` actualizan
  al cliente con cuenta. El email no se puede cambiar desde el storefront.
