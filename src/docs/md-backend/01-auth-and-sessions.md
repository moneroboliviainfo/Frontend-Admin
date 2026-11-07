# Auth y sesiones

## Dos tipos de principal

El sistema tiene **dos tipos de usuario autenticado**, con JWTs distintos que
no son intercambiables:

| | `User` (staff) | `Customer` (cliente) |
|---|---|---|
| Quién | ADMIN / SUPERVISOR / MANAGER / CASHIER | comprador del storefront (o guest) |
| Login | `POST /auth/login` (email+password) | Google OAuth, o token guest |
| Decorador para leerlo en un endpoint | `@GetUser()` | `@GetCustomer()` |
| Payload JWT | `{ id, type: 'user', sessionId }` | `{ id, type: 'customer' }` |

`@GetUser()` rechaza un token de customer y viceversa — no sirve mandar
cualquier token a cualquier endpoint.

## Login de staff

```
POST /auth/login
{ "email": "manager.norte@gmail.com", "password": "..." }

→ 200 { "email": "...", "name": "...", "rol": "manager", "branch": { ... }, "token": "<jwt>" }
```

`branch` es la sucursal del usuario (con su `type`); `null` para admin y
supervisor.

`rol` puede ser `admin`, `supervisor`, `manager` o `cashier`.

- **Sesión única**: cada login genera un `sessionId` nuevo y lo graba en el
  usuario. Un login posterior desde otro dispositivo invalida el token
  anterior de inmediato (el JWT viejo sigue siendo válido criptográficamente,
  pero el backend compara `sessionId` en cada request y lo rechaza).
- Si el usuario está deshabilitado (`enabled: false`), el login falla con
  401, y si ya tenía una sesión activa, ese token también queda muerto.
- No hay endpoint de "olvidé mi contraseña". El único cambio de password es:
  - **Autoservicio**: `PATCH /users/me/password` (cualquier staff logueado,
    pide la password actual).
  - **Reset forzado por ADMIN**: `PATCH /users/:id { "password": "..." }`
    (invalida la sesión activa del usuario afectado).
- No existe endpoint para que un staff se auto-registre. Los usuarios
  (ADMIN/SUPERVISOR/MANAGER/CASHIER) los crea un ADMIN (el SUPERVISOR no
  crea ni edita usuarios) — ver
  [02-roles-and-permissions.md](02-roles-and-permissions.md).

## Login / registro de customer

No hay registro por email+password para clientes. Las vías son:

### Google OAuth
```
GET  /auth/google              → redirige al login de Google
POST /auth/google/exchange     → el frontend llama esto con los datos que
                                  devuelve Google; el backend crea el
                                  Customer si no existe y devuelve el token
```

### Guest (checkout sin cuenta)
```
POST /auth/guest
→ 200 { "email": "...", "token": "<jwt customer>" }
```
Sirve para pagar sin loguearse. **Cada llamada abre una sesión de invitado
nueva, firmada dentro del token**, y sus direcciones y órdenes quedan atadas a
esa sesión.

- **Guardá el token y reusalo** durante toda la compra (por ejemplo, en
  `localStorage`) para volver a la confirmación tras el redirect de la tarjeta.
  Si pedís otro, la dirección y la orden creadas con el anterior dan `404`.
- Con ese token, `GET /addresses`, `GET /web-page/customers/order/:id` y
  `POST /web-page/customers/cancel/order/:id` solo ven lo de **esa** sesión. Otro
  invitado o un id ajeno → `404`.
- Si el token vence o se pierde, esas órdenes ya no se pueden consultar desde la
  web: el cliente tiene el correo de confirmación y, si hace falta, soporte.
- Un token de invitado emitido antes de este cambio da `401 Guest session
  expired`: pedí uno nuevo con `POST /auth/guest`. Las órdenes y direcciones de
  invitado anteriores no quedan accesibles desde la web.
- `GET /web-page/customers/me` sigue devolviendo `address` y `orders` vacíos para
  un invitado: no sirve para armar "mis órdenes".

### Suscripción a newsletter
```
POST /auth/subscribe
{ "email": "..." }
```
Crea un `Customer` tipo `SUBSCRIBED` (sin login, sin token). Si esa persona
después inicia sesión con Google usando el mismo email, se "upgradea" a
`REGISTERED` automáticamente.

## Header de autenticación

```
Authorization: Bearer <token>
```

## Sesión y expiración

- El JWT expira según `SIGN_OPTIONS` del backend (no controlado por el
  frontend). Al expirar o al ser invalidado (`sessionId` no coincide, usuario
  deshabilitado), cualquier request autenticado responde `401`. El frontend
  debe manejar ese caso limpiando el token local y volviendo a login.
- No hay refresh token — es login de nuevo.
