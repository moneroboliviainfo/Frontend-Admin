# Pedidos cobrados (anticipo), cobro por QR, devoluciones y plazos

Extiende los **pedidos entre sucursales** de
[11-central-warehouse-and-branch-transfers.md](11-central-warehouse-and-branch-transfers.md) §5.
Leé ese primero: acá solo está lo que agrega el **cobro al pedir**.

Todas las rutas van bajo `/api` (omitido acá). Confirmá los shapes exactos en
Swagger (`/api/docs`, tags *Branch Transfers*, *Payments - QR* y *Settings*).

---

## 1. En 30 segundos

- Un pedido entre sucursales **puede cobrarse al pedir** (opcional). Sin
  cobro es el traspaso de siempre.
- Lo cobrado es un **anticipo**: **no es una venta y no se factura**. Entra
  en la caja de la tienda que pide (A).
- El precio de cada prenda **queda congelado** al pedir.
- Métodos: **efectivo**, **tarjeta en tienda** o **QR** (BNB). Tarjeta online
  no.
- Lo que no le llega al cliente (B no lo encontró, llegó menos, se perdió,
  A lo anuló) **se le devuelve en efectivo** desde la caja de A.
- Cuando el cliente vuelve, se le hace una **venta normal** enlazada al
  pedido: se factura el total, pero en caja **solo paga la diferencia**.
- Si no vuelve dentro del **plazo de retiro**, **pierde el anticipo** y la
  prenda vuelve a la venta. Sin excepciones.
- Con **QR**, el pedido queda **esperando el pago** y B no lo ve hasta que
  BNB confirma.

---

## 2. Configuración: plazos (`/settings`)

Los días de retiro y de apartado ya **no son variables de entorno**: se
editan desde el admin.

```
GET /settings                      (ADMIN, SUPERVISOR, MANAGER, CASHIER)
→ {
    "id": 1,
    "branchRequestPickupDays": 3,   // plazo para que el cliente retire
    "branchRequestHoldDays": 3,     // días que la prenda queda apartada (pedidos SIN cobro)
    "updatedAt": "...",
    "updatedBy": { "id": 1, "name": "admin" } | null
  }

PATCH /settings                    (ADMIN, SUPERVISOR)
{ "branchRequestPickupDays?": 7, "branchRequestHoldDays?": 3 }
→ igual que GET
```

- `branchRequestPickupDays`: de 1 a 365. `branchRequestHoldDays`: de 0 a 365
  (`0` = sin apartado).
- El apartado **no puede superar** al plazo de retiro:
  `400 Los días de apartado (5) no pueden superar el plazo de retiro (3)`.
- Body vacío → `400 No hay nada que actualizar`.
- **Se aplican a los pedidos que se reciban desde ahora.** Cada pedido guarda
  sus fechas al recibirse (`pickupDeadline`, `holdUntil`); cambiar la
  configuración no mueve los pedidos ya recibidos. Mostralo así en la
  pantalla de configuración.

### Cómo se cuentan los días

- El día en que A **recibe** el pedido es el **día 0**.
- El plazo vence a las **23:59 hora de Bolivia** del último día.
- Ejemplo: recibido el **lunes** (a cualquier hora) con 3 días → vence el
  **jueves a las 23:59**.
- **No calcules fechas en el front**: usá `pickupDeadline` y `holdUntil` de
  la respuesta.
- Un pedido **cobrado** aparta la prenda **todo el plazo de retiro**
  (`holdUntil = pickupDeadline`), sin importar `branchRequestHoldDays`.

---

## 3. Cotizar y crear un pedido cobrado (tienda A)

### 3.1 Cotizar (antes de cobrar)

```
POST /branch-transfers/requests/quote        (MANAGER, CASHIER)
{ "sourceBranchId": 3, "items": [ { "variantId": 10, "quantity": 2 }, { "variantId": 15, "quantity": 1 } ] }

→ {
    "sourceBranch": { "id": 3, "name": "Tienda Sur" },
    "items": [
      { "variantId": 10, "quantity": 2, "unitPrice": "400.00", "discountValue": 25, "totalPrice": "600.00", "available": 5 },
      { "variantId": 15, "quantity": 1, "unitPrice": "250.00", "discountValue": 0,  "totalPrice": "250.00", "available": 1 }
    ],
    "total": "850.00"
  }
```

- Precio con la misma regla del POS: descuento de tienda vigente, y el total
  de cada línea redondeado al boliviano (ej.: 2 × 429 con 30 % = 600,60 →
  **601**). No recalcules en el front: usá `totalPrice` y `total`.
- `available`: lo que hoy se puede pedir en el piso de B.
- **No guarda ni reserva nada.** Mostrale al cliente el `total` y guardalo:
  lo tenés que mandar al crear.

### 3.2 Crear

```
POST /branch-transfers/requests             (MANAGER, CASHIER)
{
  "sourceBranchId": 3,
  "items": [ { "variantId": 10, "quantity": 2 }, { "variantId": 15, "quantity": 1 } ],
  "paymentType": "cash" | "card" | "qr",    // ← con esto el pedido se cobra
  "expectedTotal": 850,                      // el "total" de la cotización
  "customerName": "María Pérez",
  "customerPhone": "70012345",
  "customerCi": "1234567",
  "note?": "Pasa a retirar el sábado"
}
```

Reglas:
- **Sin `paymentType`** = sin cobro (traspaso). Nombre, teléfono y CI son
  **opcionales**, pero si los mandás no pueden venir vacíos.
- **Con `paymentType`**: `expectedTotal`, `customerName`, `customerPhone` y
  `customerCi` son **obligatorios**.
- La **caja de A tiene que estar abierta**.
- Si el precio cambió desde la cotización:
  `409 El total del pedido cambió: ahora es Bs 900.00 (se cotizó Bs 850.00). Vuelve a cotizar antes de cobrar`.
  No cobra nada: volvé a cotizar y mostrale el total nuevo al cliente.
- Varias prendas distintas y varias unidades de cada una, **todas de la
  misma tienda B**. Cada variante una sola vez (con la cantidad total).

Resultado según el método:

| `paymentType` | Estado | La prenda en B | La plata |
|---|---|---|---|
| `cash` / `card` | `pending_dispatch` | sale del piso en el momento | entra en la caja de A |
| `qr` | `pending_payment` | **apartada** unos minutos, mientras se paga | entra cuando BNB confirma (sección 4) |

**Orden en la UI (efectivo/tarjeta)**: cotizar → mostrar total → el cliente
paga → crear. Si al crear falla (stock, precio), devolvé la plata en el
momento: el pedido no se creó.

---

## 4. Cobro por QR

### 4.1 Flujo

```
1. POST /branch-transfers/requests  { ..., "paymentType": "qr" }   → status "pending_payment"
2. POST /payments/generate-qr/request/:id                            → datos del QR
3. mostrar el QR; el cliente paga desde su banco
4. pollear GET /branch-transfers/:id cada ~3 s hasta que cambie el status
```

### 4.2 Generar el QR

```
POST /payments/generate-qr/request/:id       (MANAGER, CASHIER de la tienda que pidió)
{ "gloss?": "ANTICIPO PEDIDO 15 MONERO" }

→ {
    ...datos de BNB (incluye la imagen del QR, igual que generate-qr de una venta),
    "gloss": "ANTICIPO PEDIDO 15 MONERO",
    "branchTransferId": 15,
    "qrExpiresAt": "..."         // hasta cuándo la prenda queda apartada en B
  }
```

- El monto es **el anticipo completo** (`advanceAmount`): no se manda.
- Exige la **caja de A abierta** (el pago entra en el turno en curso).
- Cada llamada **renueva el apartado** hasta el nuevo `qrExpiresAt`.
- Se puede llamar de nuevo (el cliente perdió el QR, venció): el backend
  **anula en BNB los QR anteriores** del pedido, para que no se pague dos
  veces.
- Si BNB falla al generar, la respuesta trae `{ status, data, message }` de
  BNB (no lanza), igual que `generate-qr` de una venta.

Errores:
| Error | Cuándo |
|---|---|
| `404 Pedido #N no encontrado` | no existe o no lo pidió tu tienda |
| `409 El pedido #N no se cobra: es un traspaso sin anticipo` | pedido sin cobro |
| `409 El anticipo del pedido #N ya se pagó` | ya está pagado (también los de efectivo/tarjeta) |
| `409 No se puede generar el QR: el traslado #N fue anulado` | lo anularon |
| `409 La caja de esta sucursal no está abierta: ábrela para cobrar el anticipo` | caja cerrada |
| `409 La variante X del pedido #N ya no está disponible en la tienda a la que se pidió (disponible D, pedido Q): anula el pedido` | el QR anterior venció y B vendió la prenda |

### 4.3 Qué mirar al pollear `GET /branch-transfers/:id`

| `status` | Otros campos | Mostrar |
|---|---|---|
| `pending_payment` | `paymentExpired: false` | "Esperando el pago…" |
| `pending_payment` | `paymentExpired: true` | "El QR venció" → botones **Generar otro QR** / **Anular pedido** |
| `pending_dispatch` | `advancePaidAt` con fecha | **Pagado** → listo, el pedido sigue normal |
| `cancelled` | `advancePaidAt` con fecha, `refundPending > 0` | **Pagó tarde**: el pedido se anuló, **devolver** `refundPending` (sección 5) |
| `cancelled` | `advancePaidAt: null` | Anulado sin pago, nada que devolver |

- `paymentExpired: true` significa que **la prenda ya no está apartada** en
  B: otro la puede comprar. El pedido **no se anula solo**.
- Dejá de pollear al salir de `pending_payment` o si el cajero cierra la
  pantalla. Al volver, consultá el pedido de nuevo.

### 4.4 Casos raros (los resuelve el backend)

- **Pago tardío**: el QR de BNB sigue pagable hasta el fin del día aunque el
  apartado haya vencido. Si llega el pago:
  - la prenda sigue en B → el pedido sigue normal (`pending_dispatch`);
  - B ya la vendió, o A había anulado el pedido → queda `cancelled` con todo
    el anticipo **por devolver**. Aparece en "devoluciones pendientes".
- **Doble pago** (pagó dos QR del mismo pedido): el segundo queda registrado
  para conciliar a mano con el banco; no cambia el pedido ni la caja.
- **Al anular** un pedido que espera el pago, sus QR se anulan en BNB.

### 4.5 Qué ve la tienda B

Nada, mientras esté `pending_payment`: no aparece en su listado ni en sus
contadores, y si lo busca por id recibe `404`. La prenda sí figura como
**apartada** en su stock: si un cajero de B intenta venderla, el POS dice
`... (variante 10 reservada para el pedido #15)`. Ese pedido B no lo puede
abrir todavía; para B es simplemente "apartada".

### 4.6 Errores mientras espera el pago (tienda A)

`receive`, `mark-lost` y similares → `409 No se puede <acción>: el traslado #N todavía espera el pago del anticipo`.
**Anular** sí se puede (`POST /branch-transfers/cancel/:id`): no mueve stock
(la prenda nunca salió de B) y no hay nada que devolver.

---

## 5. Devoluciones

### 5.1 Cuándo se le debe plata al cliente

| Evento | Se debe |
|---|---|
| B no encontró una parte | el valor de lo no encontrado |
| B no encontró nada (`not_found`) | todo |
| A anula antes del despacho (`cancelled`) | todo |
| Llegó menos de lo despachado | el valor de lo que no llegó |
| Se perdió en el camino (`lost`) | todo lo que quedaba |
| Pago QR tardío sin la prenda / después de anular | todo |
| Anular un pedido QR que no se pagó | nada |

- Valor = **precio congelado** de cada prenda (mismo redondeo que la venta).
- El backend lo calcula solo; nunca se devuelve de más.
- **Puede bajar** en un solo caso: la revisión del faltante dice que la
  prenda **apareció en A** (`found_at_destination`) mientras el pedido
  todavía espera al cliente. La prenda vuelve al pedido (apartada, a precio
  congelado) y ya no se debe su valor. Si esa plata **ya se devolvió**, la
  prenda queda como stock de A y no cambia nada (ver 11 §4).
- El cliente **no** puede rechazar un pedido incompleto: sigue con lo que
  llegó y se le devuelve el resto.

### 5.2 Campos

| Campo | Qué es |
|---|---|
| `advanceAmount` | lo cobrado al pedir (`null` = sin cobro) |
| `advancePaidAt` | cuándo se pagó (`null` = no se pagó: QR pendiente o anulado sin pago) |
| `refundOwed` | total a devolver hasta ahora (`null` sin anticipo pagado) |
| `refunded` | lo ya devuelto |
| `refundPending` | **lo que falta devolver** — usá este para el botón |
| `payments` | movimientos: `advance` (cobro) y `refund` (devoluciones), con `amount`, `paymentType`, `note`, `createdAt`, `createdBy` (`null` si lo registró el sistema: pago QR) |

`refunded`, `refundPending` y `advanceForfeited` vienen `null` si no hay un
anticipo pagado.

### 5.3 Devolver

```
POST /branch-transfers/requests/:id/refund       (MANAGER, CASHIER de la tienda que pidió)
{ "note?": "Se le devolvió en efectivo" }
→ el pedido actualizado (refundPending: "0.00")
```

- Devuelve **todo lo pendiente de una vez**, siempre **en efectivo**.
- Sale de la **caja de A**, que tiene que estar abierta.
- Se puede devolver apenas hay algo pendiente (por ejemplo, en camino con
  faltante), y otra vez si después se debe más.

Errores: `404 Pedido #N no encontrado` ·
`409 El pedido #N no tiene un anticipo pagado: no hay nada que devolver` ·
`409 El pedido #N no tiene nada pendiente de devolver` ·
`409 La caja de esta sucursal no está abierta: ábrela para devolver el anticipo`.

### 5.4 Encontrarlas

```
GET /branch-transfers?pendingRefund=true          → pedidos de mi tienda con devolución pendiente
GET /branch-transfers/pending-count               → { ..., "pendingRefunds": 2 }
```

Mostrá `pendingRefunds` como badge, igual que los demás contadores.

---

## 6. Retiro: la venta con anticipo

El cliente vuelve: se le hace la **venta de retiro** igual que en 11 §5.4
(`branchTransferId` en el reprice y en la venta). Con un pedido cobrado
cambia esto:

### 6.1 Reprice

```
POST /orders/reprice
{ "items": "<jwt>", "type": "in_store", "branchId": 2, "branchTransferId": 15 }

→ {
    "items": [
      { "variantId": 10, "quantity": 2, "unit_price": 400, "discountValue": 25, "totalPrice": "600.00" },  // pagada: precio congelado
      { "variantId": 10, "quantity": 1, "unit_price": 400, "discountValue": 0,  "totalPrice": "400.00" },  // extra: precio de hoy (ya sin descuento)
      { "variantId": 22, "quantity": 1, "unit_price": 199, "discountValue": 0,  "totalPrice": "199.00" }   // otra prenda
    ],
    "total": "1199.00",            // lo que se FACTURA
    "advanceApplied": "600.00",    // lo que ya pagó al pedir
    "amountDue": "599.00",         // lo que COBRÁS en caja
    "errorsStock": []
  }
```

- Las prendas pagadas van con el **precio congelado** aunque hoy cueste
  distinto. Si lleva más unidades de la misma prenda, van en **otra línea**
  al precio de hoy.
- Sin pedido cobrado: `advanceApplied: "0.00"` y `amountDue = total`.
  **Mostrá siempre `amountDue` como "a cobrar"**.
- La venta tiene que incluir **todas** las prendas recibidas del pedido:
  `400 La venta debe incluir todas las prendas pagadas del pedido #15: faltan unidades de la variante 10 (pagadas: 2)`.

### 6.2 Crear y cobrar

```
POST /orders/in-store  { "items": "<jwt>", "payment_type": "cash" | "card" | "qr", "billing": {...}, "branchTransferId": 15 }
→ Order { ..., "totalPrice": "1199.00", "advanceApplied": "600.00" }
```

- **Factura** por `totalPrice` (todo).
- **Caja**: el cajero cobra `totalPrice − advanceApplied`.
- **QR**: `POST /payments/generate-qr` genera el QR **solo por el saldo**.
- **Saldo 0** (solo se lleva lo pagado): la venta **no se puede crear con
  `qr`**:
  `400 La venta no tiene saldo por cobrar (ya se pagó con el anticipo del pedido): créala en efectivo`.
  Si `amountDue` es `"0.00"`, forzá `cash` en el POS (no ofrezcas QR) y
  confirmala con `POST /orders/confirm/:id`.
- **Tarjeta online**: `400 Una venta con anticipo no se cobra con tarjeta online`.

### 6.3 Cancelar o editar la venta de retiro

- **Cancelar** (`POST /orders/cancel/:id`): el pedido **vuelve a esperar** al
  cliente con su anticipo intacto. Al cliente se le devuelve **solo lo que
  cobró esa venta** (`totalPrice − advanceApplied`), no el anticipo.
- **Editar** (`cancel-for-edit` + `PATCH`): el anticipo y el precio
  congelado pasan a la venta nueva, **aunque el plazo ya haya vencido**. La
  venta nueva también tiene que incluir todas las prendas pagadas.
- ⚠️ Para **corregir** una venta de retiro usá **editar**, nunca cancelar y
  hacer otra: si el plazo ya venció, la venta nueva no se puede enlazar y el
  cliente pierde el anticipo.

### 6.4 Retiro manual

`POST /branch-transfers/pickup/:id` con `picked_up` **no funciona** para un
pedido cobrado:
`409 El pedido #N se cobró al pedir: el retiro se hace con la venta enlazada al pedido (para descontar el anticipo), no a mano`.
`not_picked_up` sí funciona (ver 7).

---

## 7. Plazo vencido: anticipo perdido

Pasado `pickupDeadline` sin una venta de retiro vigente:

- `advanceForfeited: true` en la respuesta.
- La prenda **vuelve a la venta** en A.
- Enlazar el pedido a una venta (reprice o creación) falla:
  `409 El plazo de retiro del pedido #N venció: el anticipo se perdió. Si el cliente igual quiere la prenda, véndela sin enlazar el pedido`.
  Si el cliente igual la quiere, se le vende **sin** `branchTransferId`, a
  precio normal.
- Marcar **"no retirado"** (`pickup` con `not_picked_up`) antes del plazo
  también hace perder el anticipo y libera la prenda al instante. Confirmalo
  con el cajero ("el cliente pierde Bs X").
- Si al pedido no le llegó nada (todo se devuelve), `advanceForfeited` queda
  en `false`: no hay nada que perder.
- Lo pendiente de devolver (faltantes) **se sigue debiendo** aunque el
  anticipo se haya perdido.

---

## 8. Caja

```
POST /dailyCash/:id/close
→ DailyCash {
    ...,
    "expectedAmount": "2245.00",   // apertura + ventas + anticipos − devoluciones
    "salesAmount": "300.00",       // ventas: lo cobrado en caja (sin la parte del anticipo)
    "advancesAmount": "3861.00",   // anticipos cobrados en el turno
    "refundsAmount": "1716.00"     // devoluciones pagadas en el turno
  }
```

- Los anticipos y devoluciones cuentan en el turno en que se registraron
  (un anticipo QR: cuando BNB confirmó el pago).
- En cajas cerradas antes de este cambio, los tres campos vienen `null`.
- Mostrá el desglose en el cierre: "Ventas / Anticipos / Devoluciones".

---

## 9. Campos nuevos del pedido

Además de lo de 11 §6:

```jsonc
{
  "status": "pending_payment",     // nuevo estado (solo pedidos QR)
  "customerCi": "1234567",
  "advanceAmount": "850.00",       // null = sin cobro
  "advancePaidAt": "...",          // null = no pagado
  "refundOwed": "0.00",
  "qrIds": ["990000501"],          // QR de BNB generados (solo QR)
  "qrExpiresAt": "...",            // apartado en B mientras espera el pago
  "pickupDeadline": "...",         // fijado al recibir (sección 2)
  "holdUntil": "...",
  "pickupOrder": { "id": 120, "status": "sent", "expiresAt": null },  // venta de retiro
  "payments": [ { "id": 1, "type": "advance", "amount": "850.00", "paymentType": "qr", "note": null, "createdAt": "...", "createdBy": null } ],
  // calculados en la respuesta:
  "paymentExpired": false,
  "refunded": "0.00",
  "refundPending": "0.00",
  "advanceForfeited": false,
  "items": [
    { "...": "...", "unitPrice": "400.00", "discountValue": 25, "totalPrice": "600.00" }   // precio congelado (null sin cobro)
  ]
}
```

Filtros nuevos del listado: `status=pending_payment`, `pendingRefund=true`.

---

## 10. Pantallas sugeridas

**ADMIN / SUPERVISOR**
- **Configuración → Pedidos entre sucursales**: plazo de retiro y días de
  apartado, con la aclaración "aplica a los pedidos que se reciban desde
  ahora" y quién lo cambió por última vez.

**MANAGER / CASHIER (tienda A)**
- **Nuevo pedido**: elegir tienda y prendas → **Cotizar** → mostrar total y
  disponible → elegir cobro (sin cobro / efectivo / tarjeta / QR) → datos
  del cliente (obligatorios con cobro) → crear.
  - Con QR: pantalla de espera con el QR, polleando el pedido; botones
    "Generar otro QR" y "Anular" cuando venza.
- **Mis pedidos**: columnas de cobro (anticipo, pagado / esperando pago /
  vencido / perdido).
- **Devoluciones pendientes** (badge `pendingRefunds`): cliente, monto,
  botón "Devolver Bs X".
- **POS – venta de retiro**: mostrar "Anticipo: Bs X — A cobrar: Bs Y"
  (`advanceApplied` / `amountDue`); no dejar quitar prendas pagadas.
- **Pedidos recibidos**: plazo (`pickupDeadline`) y, si se cobró, aviso de
  que se pierde el anticipo al vencer o al marcar "no retirado".
- **Cierre de caja**: desglose ventas / anticipos / devoluciones.
