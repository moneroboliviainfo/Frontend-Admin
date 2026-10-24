# Devoluciones a la bodega principal

Una tienda **devuelve** stock a la bodega principal (fin de temporada,
mercadería que no se vende, cierre de una tienda…). Antes no había forma: lo
único posible era dar de baja en la tienda y volver a ingresar en la central,
lo que ensuciaba los reportes de bajas y no dejaba rastro del traslado.

Es un traslado más de `/branch-transfers` (ver
[11-central-warehouse-and-branch-transfers.md](11-central-warehouse-and-branch-transfers.md)
y [15-replenishments-and-transfer-stages.md](15-replenishments-and-transfer-stages.md)):
`type: "central_return"`, origen = la tienda, destino = la bodega principal.
Todas las rutas van bajo `/api` (omitido acá). Confirmá los shapes en
Swagger (`/api/docs`, tag *Branch Transfers*).

---

## 1. El flujo

```
TIENDA (MANAGER/CASHIER)                         CENTRAL (ADMIN/SUPERVISOR)
POST /branch-transfers/returns
  → status "in_transit"  (el stock sale YA de la tienda)
  stage "in_transit" — puede anular              ve "Por recibir" (returnsToReceive)
                                                 POST /branch-transfers/returns/:id/receive
                                                   → "received", entra al DEPÓSITO de la bodega
                                                 (o anular / marcar perdido, como un envío)
```

- **La crea solo la tienda** (MANAGER o CASHIER, con su sucursal fija). La
  central no puede crear una devolución en nombre de una tienda ni pedirle
  que devuelva algo (por ahora).
- **Nace en camino**: la tienda arma el paquete y lo registra en el mismo
  paso. No hay "pendiente de despacho".
- **Todo sale de una misma ubicación** de la tienda: el **depósito** (por
  defecto) o el **piso**. Para devolver de las dos, se hacen dos
  devoluciones (o un traspaso antes).
- **Siempre llega al depósito** de la bodega principal (la central no tiene
  piso).

## 2. Crear (tienda)

```
POST /branch-transfers/returns                       (MANAGER, CASHIER)
{
  "items": [ { "variantId": 12, "quantity": 5 }, { "variantId": 13, "quantity": 2 } ],
  "location?": "warehouse" | "sales_floor",          // de dónde sale; por defecto "warehouse"
  "note?": "Fin de temporada"
}
→ 201 BranchTransfer   (type "central_return", status "in_transit")
```

- Cada variante **una sola vez** (la cantidad total) → si no, `400`.
- **No se puede devolver lo apartado**: en el piso, lo reservado por ventas
  en curso y por pedidos entre sucursales; en el depósito, lo apartado por
  pedidos que esperan el pago QR. Si no alcanza →
  `400 Stock insuficiente en el depósito de la tienda para la variante 12: disponible 3, solicitado 5`
  (si es por un pedido, agrega `(apartada para el pedido #N)`).
- En la respuesta, cada línea trae `fromWarehouse` / `fromSalesFloor`
  (cuánto salió de cada ubicación), igual que un pedido entre tiendas.
  `dispatchedQuantity` ya viene igual a `quantity`.

## 3. Recibir (central)

```
POST /branch-transfers/returns/:id/receive           (ADMIN, SUPERVISOR)
{
  "items": [ { "transferItemId": 101, "quantity": 5 }, { "transferItemId": 102, "quantity": 1 } ],
  "note?": "Vino una menos"
}
→ 201 BranchTransfer   (status "received")
```

- Mismas reglas que `POST /branch-transfers/receive/:id`: **todas** las
  líneas, una sola vez, `quantity` entre 0 y lo despachado; si llegó menos,
  la **nota es obligatoria** y queda "por revisar" (`pendingReview`).
- **No lleva `location`** (si se manda → `400`, campo no permitido): entra
  siempre al depósito de la bodega.
- No es una devolución (otro tipo) → `404`. Ya recibida o anulada → `409`.
- Ojo: **no** se usa `POST /branch-transfers/receive/:id` (ese es para que
  reciba una tienda; la central ahí da `403`).

## 4. Anular, perdido, faltantes

| Acción | Quién | Endpoint | Qué pasa |
|---|---|---|---|
| Anular | la tienda que la hizo, o la central (con **nota obligatoria**) | `POST /branch-transfers/cancel/:id` | Solo en camino. Todo vuelve a la tienda, **a la ubicación de donde salió** |
| Marcar perdido | ADMIN, SUPERVISOR | `POST /branch-transfers/mark-lost/:id` | Igual que un envío |
| Revisar faltante | ADMIN, SUPERVISOR | `POST /branch-transfers/review/:id` | `found_at_destination` → depósito de la bodega; `found_at_origin` → vuelve a la tienda, a donde salió; `lost` → nada |

Otra tienda que intente anularla → `403` ("Solo la tienda que hizo el
pedido, la reposición o la devolución puede anularlo").

## 5. Etapa y acciones

| Quién mira | `stage` | `stageLabel` | `allowedActions` |
|---|---|---|---|
| Tienda (en camino) | `in_transit` | En camino | `["cancel"]` |
| Central (en camino) | `to_receive` | Por recibir | `["receive", "cancel", "markLost"]` |
| Ambos (recibida) | `received` | Recibido | — (+ `review` para la central si hay faltante) |

⚠️ Para la central, la acción `receive` de una devolución va a
**`POST /branch-transfers/returns/:id/receive`** (no a `receive/:id`).
Distinguilo por `type === "central_return"`.

## 6. Listados y contadores

| Lista | Query |
|---|---|
| Devoluciones de la tienda | `GET /branch-transfers?type=central_return` (MANAGER/CASHIER: solo las suyas) |
| Devoluciones por recibir (central) | `GET /branch-transfers?type=central_return&status=in_transit` |
| De una tienda (central) | `...&type=central_return&sourceBranchId=<id>` |

`GET /branch-transfers/pending-count` trae un campo nuevo:

| Campo | Qué cuenta |
|---|---|
| `returnsToReceive` | devoluciones en camino a la central. Sin `branchId` (central): todas. Para una tienda siempre `0` (su devolución en camino ya cuenta en `inTransit`) |

**Contador de la central**: `replenishmentsPending + returnsToReceive + pendingReview`.

## 7. Stock y kardex

- La tienda deja de tener el stock **al crear** la devolución; la central lo
  tiene **al recibirla**. Mientras está en camino, la central lo ve en
  `inTransitStock` (`GET /variants?branchId=<bodega>`).
- Kardex (`GET /variants/:id/movements`) — tipos nuevos:

| `type` | Etiqueta (Excel) | Dónde | Cantidad |
|---|---|---|---|
| `devolucion_bodega` | Devolución a bodega | tienda (sale) | − |
| `devolucion_anulada` | Devolución anulada | tienda (vuelve al anular) | + |

  La entrada en la central es `recepcion` (como cualquier traslado), y los
  faltantes `aparecio_en_destino` / `aparecio_en_origen`.

## 8. Pantallas sugeridas

- **Tienda — "Devolver a bodega"**: buscador de variantes (stock del
  depósito o del piso según el selector de ubicación) → cantidades → nota →
  confirmar. Después, ir al detalle de la devolución.
- **Tienda — lista "Devoluciones"**: `type=central_return`, con botón
  "Anular" mientras `allowedActions` lo incluya.
- **Central — "Devoluciones por recibir"**: `type=central_return&status=in_transit`
  con badge `returnsToReceive`; el detalle muestra las líneas con el
  formulario de recepción (mismo componente que recibir un envío, sin el
  selector de ubicación).
