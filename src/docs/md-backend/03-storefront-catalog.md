# Catálogo público (storefront)

Todo lo de acá es público (sin `Authorization`). Vive bajo `web-page/*` y es
una **copia deliberadamente duplicada** del CRUD admin — no es el mismo
código, así que si algo falta en el storefront no es un bug de "olvidaron
compartir lógica", es que nadie lo expuso ahí a propósito.

## Productos

```
GET /web-page/products?limit=&page=&search=&days=&discounts=&branchId=
GET /web-page/products/:id?branchId=
```

- `search` busca **solo en el nombre del producto**, por palabras y sin
  distinguir tildes ni mayúsculas: cada palabra tiene que aparecer, en
  cualquier orden (`pantalon azul` encuentra "Pantalón Azul Marino" y "Azul
  Pantalón"). Se usan las primeras 8 palabras. No busca por SKU, color ni
  categoría (para cruzar categorías: `GET /searchs/advanced`, abajo).
- `discounts` acepta `true` o `false`: con o sin descuento **vigente para la
  web de la sucursal elegida** (activo, en fechas y que aplique en la web de
  `branchId`; sin `branchId`, en la web de alguna sucursal). Otro valor →
  `400`.
- `days` (entero positivo): productos creados en los últimos N días, para
  "novedades".
- El listado viene **ordenado por `id` ascendente** y sus `productColors` no
  traen variantes ni stock. `page` menor a 1 se trata como 1.
- `GET /web-page/products/:id` devuelve el producto **con stock** ya
  calculado (`findOneWithStock`) — no hace falta pedirlo aparte. Cada
  variante trae **solo `availableStock`** (vendible en la web); no se muestra
  cuánto hay en cada lugar, ni la bodega principal, ni lo que está en camino.
  Lo mismo en `GET /web-page/outfits/:id?branchId=`.
- **Con una sucursal elegida, mandá `?branchId=`**: `availableStock` es **piso +
  depósito** disponibles de esa tienda, lo mismo contra lo que se valida la
  compra. Por eso la web puede mostrar más stock que el POS, que vende solo del
  piso. Sin el parámetro (o vacío) es la suma de piso + depósito de **las tiendas
  de `GET /web-page/branches`**: sirve para mostrar el producto, pero ese número
  no se puede comprar de una sola tienda, y el reprice puede responder `400`.
  `0`, negativo o no numérico → `400`. Una sucursal que no venda por la web (no
  existe, es la bodega principal, está inactiva o no tiene facturación SIAT
  activa) no da error: el stock viene en `0`.
- Cada variante del detalle trae también `sku` (ver
  [06](06-inventory-and-warehouse.md)) y viene **ordenada por talla**. En el
  outfit ahora trae además su `size`.
- Los descuentos que trae un producto ya vienen filtrados por vigencia real:
  un descuento con `isActive: false`, fuera de rango de fechas, o que no
  aplica en la **web de la sucursal elegida** (`?branchId=`) **no aparece** —
  no hace falta que el frontend re-valide nada. **Mandá siempre `?branchId=`**
  (también en el listado): sin él se muestra el descuento si aplica en la web
  de *alguna* sucursal, y el cliente podría ver un descuento que al pagar no
  tiene. Ver "Descuentos por sucursal" abajo.

## Categorías / Subcategorías / Tallas / Outfits / Places

Solo lectura. Ojo: no todos los listados paginan.

| Endpoint | Paginado | Qué trae |
|---|---|---|
| `GET /web-page/categories` | No | Categorías con `subcategories` |
| `GET /web-page/categories/:id?branchId=` | — | Subcategorías con sus productos, colores y descuento vigente en la web de `branchId` (sin variantes ni stock) |
| `GET /web-page/subcategories?limit=&page=&search=` | Sí | Subcategorías con `products` |
| `GET /web-page/subcategories/:id?branchId=` | — | Productos con colores y descuento vigente en la web de `branchId` (sin variantes ni stock) |
| `GET /web-page/sizes?limit=&page=&search=` | Sí | Tallas |
| `GET /web-page/sizes/:id` | — | Una talla |
| `GET /web-page/outfits` | No | Outfits con `productColors` (sin producto, variantes ni stock) |
| `GET /web-page/outfits/:id?branchId=` | — | Ver "Outfits" abajo |
| `GET /web-page/places` | No | Lugares con sus `shipments` (envíos nacionales y precio) |
| `GET /web-page/places/:id` | — | Un lugar con sus `shipments` |

Los paginados usan `limit` 10 por defecto y responden `{ data, meta }`; los otros
devuelven el array directo.

## Outfits

Un outfit es un **"look" para mostrar**: `name`, `images`, `videos`, `gender` y
los producto-color que lo forman. **No depende de la sucursal**: se ve igual en
toda la web, y solo cambia el stock de cada talla.

- `GET /web-page/outfits/:id?branchId=` trae en cada `productColors[]` su
  `color`, su `product` (con descuento vigente) y sus `variants` (con `size`,
  `sku` y `availableStock`, ordenadas por talla).
- **No hay filtro de género ni paginación** en el listado: filtrá por `gender`
  en el front.
- **Un outfit no se compra como unidad**: el carrito y la orden no lo conocen.
  El cliente elige la talla de cada prenda y se agregan como variantes normales
  con `POST /cart`. No tiene precio propio: el total es la suma de las prendas,
  y el cliente puede llevarse solo una.
- **Sigue apareciendo aunque no haya stock** en la sucursal elegida: deshabilitá
  las tallas con `availableStock: 0`.

## Descuentos

```
GET /web-page/discounts?branchId=
GET /web-page/discounts/first-discount?branchId=   # el vigente creado más recientemente, o vacío si no hay ninguno
GET /web-page/discounts/:id?branchId=
```
Solo devuelven descuentos activos, vigentes y que aplican en la **web de la
sucursal elegida** (sin `branchId`: en la web de alguna). Un descuento que no
aplica ahí da `404` en `/:id`. Sin paginar, del más nuevo al más viejo.

## Sucursales

```
GET /web-page/branches
```
Lista liviana (`id`, `name`) para el **selector de sucursal al entrar a la
web**. El cliente elige una al principio y hay una **por defecto** al cargar;
esa sucursal se usa en todo el flujo y **de ella sale la factura** de la venta.
**Solo trae sucursales activas Y con facturación SIAT configurada** — si una
sucursal no tiene SIAT activo, no aparece acá, porque una venta online se
factura sola al confirmar el pago y sin SIAT quedaría sin factura.

El backend no define cuál es la sucursal por defecto: la respuesta no trae esa
marca y viene ordenada por nombre. Si la configurada no aparece en la lista
(por ejemplo, se desactivó), usá la primera y no sigas con un `branchId` que el
backend va a rechazar.

## Envíos

```
GET /shipments
```
Público, sin prefijo `web-page` (vive en su propio módulo). Lista los
métodos/costos de envío para el checkout online.

## Banners, sliders, publicidad

```
GET /banners
GET /banners/:id
GET /sliders
GET /sliders/:id
GET /advertisements
```
Contenido de marketing, público.

## Búsqueda

```
GET /searchs?type=                       (GenderType, opcional) → productos "más buscados", filtrable por género
GET /searchs/advanced?limit=&page=&search=   → búsqueda paginada de productos, cruza categorías y subcategorías
```
Público. `type` en el primero acepta `male` o `female`; sin él, los 10 más
buscados en general.

## Descuentos por sucursal — lo que hay que saber

Cada descuento elige en qué **sucursal** y **canal** aplica: la tienda física
y/o la web de cada sucursal (ver [09](09-admin-catalog-crud.md) §Descuentos).
Un mismo producto puede tener descuento en la web de A y no en la de B, o en
la tienda física y no en la web. **Esto ya lo resuelve el backend** en cada
endpoint relevante (catálogo, cart, reprice) — el frontend no necesita
recalcularlo, solo **mandar la sucursal elegida** (`?branchId=` en el
catálogo, `branchId` en el body de `/cart` y del reprice). El precio que se
cobra siempre sale del reprice con la sucursal de la venta.

`appliesOnline`/`appliesInStore` siguen en la respuesta pero están
**obsoletos**: dicen si aplica en ese canal de *alguna* sucursal, no de la
elegida. No los usen para decidir.
