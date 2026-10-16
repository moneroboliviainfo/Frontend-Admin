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

→ 200 { "email": "...", "name": "...", "rol": "manager", "token": "<jwt>" }
```

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
Devuelve un token de un `Customer` "guest" fijo (email constante en el
backend). Sirve para armar el carrito y pagar sin loguearse. **Ojo**: como es
un customer compartido, no uses este token para nada que dependa de historial
personal (direcciones guardadas, "mis órdenes").

### Suscripción a newsletter
```
POST /auth/subscribe
{ "email": "...", ... }
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
