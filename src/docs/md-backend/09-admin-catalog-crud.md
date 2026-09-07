# CRUD administrativo (panel de back-office)

Todo lo de acá es **ADMIN-only** salvo que se indique lo contrario, y es CRUD
simple: crear, listar, ver uno, editar, borrar. No tiene la complejidad de
ventas/inventario — es el panel donde el admin arma el catálogo. El
equivalente **público** de lectura (sin auth) de varios de estos módulos ya
está en [03-storefront-catalog.md](03-storefront-catalog.md) — acá va la
mitad de escritura + la lectura admin (que trae campos que el público no ve).

Patrón general salvo que se diga otra cosa: `whitelist: true` +
`forbidNonWhitelisted: true` (400 si mandás un campo no declarado en el DTO),
`@Auth(Roles.ADMIN)` en todos los endpoints salvo el `GET` público marcado.

## Categories

```
POST   /categories              (A)
GET    /categories              (A)   sin paginar, sin query params
GET    /categories/:id          (A)
PATCH  /categories/:id          (A)
PUT    /categories/:id          (A)   { "newOrder": number } — solo reordena (displayOrder)
DELETE /categories/:id          (A)
```
Lectura pública equivalente: `GET /web-page/categories(/:id)`.

## Subcategories

```
POST   /subcategories           (A)
GET    /subcategories?limit=&page=&search=   (A)   paginado
GET    /subcategories/:id       (A)
PATCH  /subcategories/:id       (A)
DELETE /subcategories/:id       (A)
```
Lectura pública: `GET /web-page/subcategories(/:id)`.

## Sizes

```
POST   /sizes                   (A)
GET    /sizes?limit=&page=&search=   (A)   paginado
GET    /sizes/:id               (A)
PATCH  /sizes/:id               (A)
DELETE /sizes/:id               (A)
```
Lectura pública: `GET /web-page/sizes(/:id)`.

## Colors

```
POST   /colors                  (A)
GET    /colors?limit=&page=&search=   (A)   paginado
GET    /colors/:id              (A)
PATCH  /colors/:id              (A)
DELETE /colors/:id              (A)
```
Sin duplicado `web-page` — los colores se ven embebidos en la variante, no
hay listado público propio.

## Brands

```
POST   /brands                  (A)
GET    /brands?limit=&page=&search=   (A)   paginado
GET    /brands/:id              (A)
PATCH  /brands/:id              (A)
DELETE /brands/:id              (A)
```
Sin duplicado `web-page` (igual que `colors`).

## Places

```
POST   /places                  (A)
GET    /places                  (A)   sin paginar
GET    /places/:id              (A)
PATCH  /places/:id              (A)
DELETE /places/:id              (A)
```
Lectura pública: `GET /web-page/places(/:id)`.

## Outfits

```
POST   /outfits                 (A)
GET    /outfits                 (A)   sin paginar
GET    /outfits/:id             (A)   con stock (findOneWithStock)
PATCH  /outfits/:id             (A)
DELETE /outfits/:id             (A)
```
Lectura pública: `GET /web-page/outfits(/:id)`.

## Products (lado admin — alta/edición de catálogo)

```
POST   /products                              (A)   crear producto base
GET    /products?limit=&page=&search=&days=&discounts=   (A)
GET    /products/:id                          (A)   con stock (findOneWithStock)
PATCH  /products/:id                          (A)
PUT    /products/add-discounts                (A)   asociar descuento(s) a producto(s) puntuales
PUT    /products/add-discounts/all             (A)   asociar descuento a TODO el catálogo (o filtro amplio)
DELETE /products/:id                          (A)
```
- `days`/`discounts` — mismos filtros que en el lado público, ver
  [03-storefront-catalog.md](03-storefront-catalog.md).
- La creación de **colores + tallas + stock inicial** de un producto (las
  "variantes") es un módulo aparte: ver `POST /variants` en
  [06-inventory-and-warehouse.md](06-inventory-and-warehouse.md) — `products`
  es el producto "padre" (nombre, categoría, marca, género, descripción),
  `variants` es cada combinación color×talla vendible.
- `add-discounts` / `add-discounts/all` — confirmar shape exacto de
  `AddDiscountsDto`/`AddDiscountsAllDto` en Swagger; son operaciones masivas,
  no crean el `Discount` (eso es el módulo `discounts` de abajo), solo
  asocian uno ya existente.

Lectura pública: `GET /web-page/products(/:id)`.

## Discounts (crear/editar el descuento en sí)

Dos tipos con rutas separadas porque tienen forma distinta
(`CreateSeasonalDiscountDto` con rango de fechas vs.
`CreatePermanentDiscountDto` sin fechas):

```
POST   /discounts/seasonal        (A)
POST   /discounts/permanent       (A)
GET    /discounts                 (A)   sin paginar, trae ambos tipos
GET    /discounts/:id             (A)
PATCH  /discounts/seasonal/:id    (A)
PATCH  /discounts/permanent/:id   (A)
DELETE /discounts/permanents      (A)   borra TODOS los permanentes — ojo, no es por :id
DELETE /discounts/seasonals       (A)   borra TODOS los de temporada — ídem
DELETE /discounts/:id             (A)   borra uno puntual
```
`appliesOnline`/`appliesInStore` viven en el DTO de create/update — ver
[Discount visibility tradeoff] en el modelo de datos si necesitás fechas de
vigencia exactas; confirmar en Swagger. Lectura pública:
`GET /web-page/discounts`, `/first-discount`, `/:id`.

## Banners

```
POST   /banners        (A)
GET    /banners         público, sin @Auth
GET    /banners/:id     público, sin @Auth
PATCH  /banners/:id    (A)
```
Sin `DELETE` — un banner se desactiva/edita, no se borra (confirmar en
Swagger si el DTO de update tiene un flag `active`).

## Sliders

```
POST   /sliders         (A)
GET    /sliders          público, sin @Auth
GET    /sliders/:id      público, sin @Auth
PATCH  /sliders/:id     (A)
DELETE /sliders/:id     (A)
```

## Advertisements

```
GET    /advertisements   público, sin @Auth   — devuelve un único registro (findOne, no lista)
PATCH  /advertisements   (A)                   — sin :id, edita ese único registro
```
Singleton — no hay `POST`/`DELETE`, es un solo bloque de config (banner de
anuncio global, probablemente texto+link).

## Shipments (lado admin)

```
GET    /shipments        público, sin @Auth   — lista de métodos de envío
PATCH  /shipments/:id    (A)
DELETE /shipments/:id    (A)
```
**No hay `POST`** (está comentado en el código — los métodos de envío se
cargan directo en DB/seed, no se crean desde la API) ni `GET /shipments/:id`
suelto (también comentado). Si tu UI de admin necesita crear un método de
envío nuevo, es un gap real, no algo que solo falte documentar.

## Files (subida de imágenes)

```
POST   /multimedia                    (A)   multipart/form-data, campo "files" (hasta 10, 5MB c/u)
                                       → devuelve URLs seguras para usar en products/categories/etc.
GET    /multimedia/upload/:file        público, sin @Auth — sirve el archivo físico
GET    /multimedia/uploads            (A)   lista todos los archivos subidos
DELETE /multimedia                    (A)   body: string[] (array de nombres/keys a borrar)
```
Ojo: el controller vive bajo el prefijo `/multimedia`, no `/files` — el
nombre del módulo en el código no coincide con la ruta HTTP.
Subís la imagen **antes** de crear/editar el producto/categoría/etc., y le
mandás la URL devuelta en el campo correspondiente del DTO (`image`,
`images`, etc. — confirmar el campo exacto por entidad en Swagger).

## Users (staff: ADMIN/MANAGER/CASHIER)

```
POST   /users/admin              (A)   { name, email, password } → crea otro ADMIN, sin sucursal
POST   /users/staff              (A)   { name, email, password, rol: MANAGER|CASHIER, branchId } → crea MANAGER/CASHIER atado a una sucursal
GET    /users?limit=&page=&search=   (A)
GET    /users/:id                (A)
PATCH  /users/:id                (A)   { name?, email?, password?, branchId?, enabled? }
PATCH  /users/me/password        cualquier staff logueado — { currentPassword, newPassword }
```
- **No existe `DELETE /users/:id`.** Deshabilitar a alguien es
  `PATCH /users/:id { "enabled": false }` — eso además invalida su sesión
  activa (`sessionId` a null), así que el token que ya tenía en el celular
  deja de servir de inmediato aunque no haya expirado.
- Resetear la password de otro usuario (olvidó la suya) también es
  `PATCH /users/:id { "password": "..." }` por un ADMIN — igual invalida la
  sesión activa, fuerza a loguearse de nuevo con la nueva.
- `PATCH /users/me/password` es distinto: autoservicio, cualquier staff
  cambia **su propia** password, pero pide la actual (`currentPassword`) —
  no lo puede usar un ADMIN para resetear la de otro.
- `rol` es fijo desde la creación — no se puede reasignar MANAGER↔CASHIER
  con un PATCH, hay que borrar (deshabilitar) y crear de nuevo si hace falta
  cambiarlo. `branchId` en el PATCH sí sirve para mover a un manager/cashier
  de sucursal.
- ADMIN no tiene sucursal (`branch: null` siempre) — mandarle `branchId` a un
  ADMIN vía `POST /users/admin` no aplica (el DTO ni lo acepta); intentar
  poner `branchId` en el PATCH de un usuario que es ADMIN tira 400.

## Customers (lado admin — gestión de clientes del storefront)

```
GET    /customers?limit=&page=&search=&type=   (A)
GET    /customers/:id                          (A)
PATCH  /customers/:id                          (A)
DELETE /customers/:id                          (A)   soft-delete, confirmar en Swagger
```
`type` filtra por `CustomerType` (ej. `GUEST`, `SUBSCRIBED`, `REGISTERED` —
confirmar valores exactos en Swagger). Este es el panel para que soporte
busque/edite/dé de baja clientes — el propio cliente gestiona su cuenta por
`web-page/customers/*`, ver [08-customer-account.md](08-customer-account.md).
