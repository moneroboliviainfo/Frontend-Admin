# Catálogo público (storefront)

Todo lo de acá es público (sin `Authorization`). Vive bajo `web-page/*` y es
una **copia deliberadamente duplicada** del CRUD admin — no es el mismo
código, así que si algo falta en el storefront no es un bug de "olvidaron
compartir lógica", es que nadie lo expuso ahí a propósito.

## Productos

```
GET /web-page/products?limit=&page=&search=&days=&discounts=
GET /web-page/products/:id
```

- `discounts` (`DiscountFilter`) filtra por si el producto tiene descuento
  vigente.
- `days` — filtro relacionado a "nuevos" (productos recientes); confirmar
  semántica exacta en Swagger.
- `GET /web-page/products/:id` devuelve el producto **con stock** ya
  calculado (`findOneWithStock`) — no hace falta pedirlo aparte.
- Los descuentos que trae un producto ya vienen filtrados por vigencia real:
  un descuento con `isActive: false`, fuera de rango de fechas, o que no
  aplica al canal (`appliesOnline`) **no aparece** — no hace falta que el
  frontend re-valide fechas.

## Categorías / Subcategorías / Tallas / Outfits / Places

Mismo patrón en todos:
```
GET /web-page/categories
GET /web-page/categories/:id
GET /web-page/subcategories
GET /web-page/subcategories/:id
GET /web-page/sizes
GET /web-page/sizes/:id
GET /web-page/outfits
GET /web-page/outfits/:id
GET /web-page/places
GET /web-page/places/:id
```
Solo lectura, pensados para poblar filtros/selects del storefront.

## Descuentos

```
GET /web-page/discounts
GET /web-page/discounts/first-discount   # el más relevante para mostrar como banner
GET /web-page/discounts/:id
```

## Sucursales

```
GET /web-page/branches
```
Lista liviana (`id`, `name`) para el **selector de sucursal en el checkout
online** (retiro/facturación). **Solo trae sucursales activas Y con
facturación SIAT configurada** — si una sucursal no tiene SIAT activo, no
aparece acá, porque una venta online se factura sola al confirmar el pago y
sin SIAT quedaría sin factura.

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
Público. `type` en el primero usa el enum `GenderType` (confirmar valores
exactos — `male`/`female`/etc. — en Swagger).

## Descuentos por canal — lo que hay que saber

`Discount` tiene `appliesOnline` y `appliesInStore` (ambos `true` por
default). Un mismo producto puede tener descuento visible en la tienda
física y no en la web, o viceversa. **Esto ya lo resuelve el backend** en
cada endpoint relevante (catálogo, cart, reprice) — el frontend no necesita
recalcularlo, pero sí saber que el precio/descuento que ve un cliente
navegando la web puede diferir del que ve un cajero en el POS para el mismo
producto, y es correcto.
