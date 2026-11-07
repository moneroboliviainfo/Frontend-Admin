# Cambios en `develop` — noviembre de 2026

## 6 de noviembre — cierre de caja por medio de pago

El cierre muestra el total en **efectivo**, **tarjeta** y **QR**, y el
**efectivo que tiene que haber en el cajón**. El conteo del cajero pasa a
ser **solo el efectivo**. Detalle en
[07](07-branches-daily-cash-billing.md) §Totales por medio de pago (ya
actualizado) y [05](05-orders-lifecycle-and-pos.md) §8.

| # | Cambio | Impacto en el front | Detalle |
|---|---|---|---|
| 1 | `GET /dailyCash/current` trae `summary`: ventas, anticipos y devoluciones por medio (`cash`/`card`/`qr`/`total`), `byMethod`, `expectedCash` y `expected`, **en vivo** | Pantalla de cierre: mostrar efectivo / tarjeta / QR y el efectivo esperado **antes** de contar | [07](07-branches-daily-cash-billing.md) |
| 2 | Las cajas cerradas traen `cashAmount`, `cardAmount`, `qrAmount` y `expectedCashAmount` (respuesta del cierre, historial, conteo pendiente) | Mostrarlos en el cierre y en el historial | [07](07-branches-daily-cash-billing.md) |
| 3 | **`closingAmount` = solo el efectivo contado**; sobrante/faltante = `closingAmount − expectedCashAmount` | Cambiar el cálculo de la diferencia (antes contra `expectedAmount`) | [07](07-branches-daily-cash-billing.md) |
| 4 | Endpoint nuevo **`GET /dailyCash/mine`** (M, C): el historial de las cajas del usuario logueado, con la misma información que el del admin (`?status=`, paginado) | Pantalla "Mis cajas" en el POS | [07](07-branches-daily-cash-billing.md) §Historial |

**Qué se rompe:** si el front calcula el sobrante o faltante contra
`expectedAmount`, en una caja con ventas por QR o tarjeta va a mostrar un
faltante falso. Hay que usar `expectedCashAmount`. Las cajas cerradas antes
de este cambio traen estos campos en `null`: ahí se sigue usando
`expectedAmount`.

- [ ] Pantalla de cierre con los tres totales y el efectivo esperado (del
      `summary` de `GET /dailyCash/current`).
- [ ] El conteo (cierre y conteo pendiente) pide solo el efectivo.
- [ ] Diferencia = `closingAmount − expectedCashAmount` (si es `null`, caja
      vieja: contra `expectedAmount`).
- [ ] Historial: columnas efectivo / tarjeta / QR.
- [ ] POS: pantalla "Mis cajas" con `GET /dailyCash/mine`.

## 6 de noviembre — descuentos por sucursal

Cada descuento elige en qué **sucursal** y **canal** aplica: tienda física
y/o web de cada sucursal ("solo tienda de A", "solo web de B", "tienda de A +
web de B"…). El detalle está en [09](09-admin-catalog-crud.md) §Descuentos
(ya actualizado), [03](03-storefront-catalog.md) y
[04](04-cart-checkout-payments.md).

**Nada se rompe**: los descuentos que existían quedaron en todas las tiendas
de sus canales, los precios no cambian con el deploy, y
`appliesOnline`/`appliesInStore` se siguen aceptando y devolviendo.

| # | Cambio | Impacto en el front | Detalle |
|---|---|---|---|
| 1 | Create/update de descuentos aceptan `inStoreBranchIds` y `onlineBranchIds`; la respuesta trae `inStoreBranches`/`onlineBranches` (`[{ id, name }]`) | Formulario de descuento: elegir tiendas físicas y webs | [09](09-admin-catalog-crud.md) §Descuentos |
| 2 | `appliesOnline`/`appliesInStore` **obsoletos**: en la respuesta = "aplica en ese canal de alguna sucursal"; en el body solo cuentan si no viene la lista | Dejar de mandarlos y de usarlos para decidir | [09](09-admin-catalog-crud.md) §Descuentos |
| 3 | El precio usa el descuento de **la sucursal de la venta** (POS: la del cajero; web: la elegida; anticipo: la tienda que pide) | Nada: reprice ya lleva `branchId` | [05](05-orders-lifecycle-and-pos.md), [13](13-prepaid-branch-requests.md) |
| 4 | Catálogo web con `?branchId=`: `web-page/products` (listado y detalle), `categories/:id`, `subcategories/:id`, `outfits/:id`, `discounts` (los tres) | **Mandar siempre la sucursal elegida**; sin ella se muestra el descuento si aplica en la web de alguna | [03](03-storefront-catalog.md) |
| 5 | `POST /cart` acepta `branchId` en el body | Mandarlo (web: la elegida; POS: la del cajero) | [04](04-cart-checkout-payments.md) |
| 6 | POS (`GET /variants…?branchId=`) y admin `GET /products` traen `discount.branches` (`[{ discountId, branchId, channel }]`); con `branchId` se oculta el descuento que no aplica en ningún canal de esa sucursal | En el POS, mostrar el descuento solo si tiene `{ branchId: <la mía>, channel: 'in_store' }` | [06](06-inventory-and-warehouse.md), [09](09-admin-catalog-crud.md) §Descuentos |

### Checklist del front

- [ ] Formulario de descuento: selector de tiendas físicas y de webs.
- [ ] Web: `?branchId=` en todo el catálogo y `branchId` en `POST /cart`.
- [ ] POS: `branchId` en `POST /cart`; mostrar el descuento por
      `discount.branches` en vez de `appliesInStore`.
- [ ] Dejar de leer y mandar `appliesOnline`/`appliesInStore`.

## 3 de noviembre — caja por usuario

Qué cambió, **qué se rompe** y **qué tiene que hacer el front**. El detalle
está en [07-branches-daily-cash-billing.md](07-branches-daily-cash-billing.md)
(ya actualizado), y en [05](05-orders-lifecycle-and-pos.md) y
[13](13-prepaid-branch-requests.md).

### Resumen

| # | Cambio | Impacto en el front | Detalle |
|---|---|---|---|
| 1 | **Caja por usuario**: cada CASHIER/MANAGER abre y cierra la suya; varias abiertas por sucursal, una por usuario | El POS trabaja siempre con "mi caja" | [07](07-branches-daily-cash-billing.md) |
| 2 | **Sin caja abierta no se vende**: crear y confirmar una venta en tienda exigen la caja de quien lo hace | Manejar el `409` (llevar a "Abrir caja") | [05](05-orders-lifecycle-and-pos.md) §1 |
| 3 | Confirmar a mano (`POST /orders/confirm/:id`) pasa la venta a la caja de **quien confirma** | Nada, salvo el `409` si no tiene caja | [07](07-branches-daily-cash-billing.md) |
| 4 | El cierre **se rechaza** con ventas pendientes o un QR de anticipo vivo | Mostrar el mensaje del `409` | [07](07-branches-daily-cash-billing.md) |
| 5 | **Cierre automático a las 00:00** (hora Bolivia) y **conteo obligatorio** después | Pantalla "registrar conteo" al entrar al POS | [07](07-branches-daily-cash-billing.md) §Cierre automático |
| 6 | Endpoints nuevos: `POST /dailyCash/:id/count`, `GET /dailyCash/pending-count` | Usarlos en el flujo de entrada al POS | [07](07-branches-daily-cash-billing.md) |
| 7 | `GET /dailyCash` filtra por `?status=` y `?userId=` | Para ver "cajas abiertas ahora" (admin, encargado) | [07](07-branches-daily-cash-billing.md) §Historial |
| 8 | Anticipos, QR de anticipo y devoluciones usan la caja de quien opera | Mensajes de `409` nuevos | [13](13-prepaid-branch-requests.md) |
| 9 | No se puede deshabilitar ni cambiar de sucursal a un usuario con su caja abierta | Mostrar el `409` en la edición de usuarios | [07](07-branches-daily-cash-billing.md) |

### ⚠️ Lo que rompe (revisar sí o sí)

1. **`GET /dailyCash/current` ya no es "la caja de la sucursal"**: devuelve
   la caja abierta **del usuario logueado**, y solo para MANAGER/CASHIER.
   ADMIN/SUPERVISOR reciben `403`: para ver las cajas abiertas usen
   `GET /dailyCash?status=open&branchId=`.
2. **`POST /dailyCash/:id/close` solo cierra la caja propia**: la de otro
   usuario da `404`. El encargado ya no cierra cajas de los cajeros (se cierran
   solas a la medianoche).
3. **`POST /orders/in-store` y `POST /orders/confirm/:id` dan `409`** si el
   usuario no tiene su caja abierta (`No tienes una caja abierta: ábrela para
   vender` / `… para confirmar la venta`). Antes se podía vender sin caja.
4. **`POST /dailyCash/open` da `409`** también si el usuario tiene una caja
   cerrada automáticamente sin conteo. Antes de "Abrir caja", consultá
   `GET /dailyCash/pending-count` y, si hay una, pedí el conteo
   (`POST /dailyCash/:id/count`).
5. **Mensajes de caja de los anticipos**: `La caja de esta sucursal no está
   abierta: …` pasó a `No tienes una caja abierta: ábrela para cobrar el
   anticipo | generar el QR del anticipo | devolver el anticipo`.
6. **`openedBy`/`closedBy` de las cajas vienen como `{ id, name }`** (antes
   el usuario completo). `closedBy: null` = la cerró el sistema a la
   medianoche (`autoClosed: true`).

Cambios que **no** rompen pero conviene saber:
- **Editar y cancelar ventas no cambian**: cualquier cajero o encargado de
  la sucursal, en cualquier momento y sin caja abierta. Son correcciones de
  registro (no se cobra ni se devuelve plata): la corrección queda en la
  caja de la venta original; si ya cerró, su cierre no cambia.
- Las cajas traen `autoClosed`, `countedAt` y `countPending` (`true` = se
  cerró sola y su dueño todavía no la contó; su `closingAmount` es `null`).
- Las órdenes traen `dailyCashId` (la caja en la que entró la venta en
  tienda; `null` en online y en ventas viejas) y `awaitingDailyCash` (`true`
  = la plata llegó con su caja cerrada y entra en el próximo cierre de la
  sucursal).
- El reporte Excel de ventas del día (`dailyCashQuantity`) suma la apertura
  de **todas** las cajas del día de la sucursal.

### Checklist del front

- [ ] Entrada al POS: `pending-count` → (conteo) → `current` → (abrir caja).
- [ ] Pantalla "Registrar conteo" de una caja cerrada automáticamente.
- [ ] Manejar `409` al vender / confirmar sin caja → llevar a "Abrir caja".
- [ ] Cierre: mostrar el `409` con lo pendiente (ventas por cobrar, QR de
      anticipo).
- [ ] Admin/encargado: "Cajas abiertas" con `GET /dailyCash?status=open`;
      dejar de usar `GET /dailyCash/current` desde ADMIN/SUPERVISOR.
- [ ] Historial: mostrar "Cierre automático" (`autoClosed`) y "Conteo
      pendiente" (`countPending`).
- [ ] Edición de usuarios: mostrar el `409` de caja abierta.
