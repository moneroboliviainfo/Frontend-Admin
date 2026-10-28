export interface VariantSize {
  id?: number
  sku?: string
  size:
    | {
        id: number
        name: string
      }
    | string

  // OJO: `availableStock` es lo VENDIBLE del piso, no lo que hay fisicamente.
  // Ya resta los carritos del POS y lo apartado por pedidos. Para contar
  // prendas colgadas se usa `salesFloorStock`.
  availableStock?: number

  // Piso fisico de la sucursal consultada: lo que el cajero ve colgado
  salesFloorStock?: number

  // Deposito de la sucursal. Este si es fisico.
  warehouseStock?: number

  // Del deposito, lo apartado por pedidos con QR sin pagar: no se puede pasar
  // al piso. Disponible para mover = warehouseStock - heldInWarehouse.
  heldInWarehouse?: number

  // Ya descontado por pedidos que esta sucursal tiene que despachar, pero
  // todavia fisicamente en el local. En el conteo hay que sumarlo a lo
  // esperado o se registran sobrantes falsos. Un pedido sale primero del
  // deposito y solo lo que falta del piso: por eso van separados.
  pendingDispatchSalesFloor?: number
  pendingDispatchWarehouse?: number

  // Despachado desde la bodega central y todavia no recibido por esta sucursal
  inTransitStock?: number

  // Stock en la bodega principal. Viene siempre y NO depende del branchId
  // consultado: no hay que sumarlo al stock de la sucursal.
  centralWarehouseStock?: number

  // La talla ya esta en la reposicion pendiente de la sucursal consultada
  pendingReplenishment?: boolean
  quantity?: number
}

export interface Color {
  id: number
  name: string
  code: string
  enabled?: boolean
}

export interface Variant {
  id?: number
  multimedia: string[]
  pdfs: string[]
  color: Color
  colorName?: string
  colorCode?: string
  variants: VariantSize[]
  product?: any
  productId?: number
  createdAt?: string
  updatedAt?: string
}

export interface CreateVariantDto {
  multimedia: string[]
  pdfs: string[]
  variants: {
    size: string
    quantity: number
  }[]
  colorName: string
  colorCode: string
  productId: number

  // Solo lo manda un ADMIN (sucursal de bodega para el stock inicial); MANAGER/CASHIER no lo mandan.
  branchId?: number
}

export interface UpdateVariantDto extends Partial<CreateVariantDto> {}

export interface Brand {
  id: number
  name: string
  description: string
  enabled?: boolean
}

export interface CreateBrandDto {
  name: string
  description: string
}

export interface MultimediaUploadResponse {
  url: string
  filename?: string
  originalName?: string
}

export interface VariantsResponse {
  variants: Variant[]
  total?: number
}

export interface BrandsResponse {
  brands: Brand[]
  total?: number
}
export type AddStockRequest = {
  quantity: number
  variantId: number
  branchId?: number // va como query param, no en el body (lo separa variantService)
}

export type StockLocation = 'warehouse' | 'sales_floor'

// Sobrante de un conteo en una TIENDA: la nota es obligatoria y la bodega da 403
export type PositiveAdjustmentRequest = {
  variantId: number
  quantity: number
  location: StockLocation
  note: string
  branchId?: number
}

export type SubtractStockRequest = {
  variantId: number
  quantity: number
  reason?: string
  location?: StockLocation // default: 'warehouse' (bodega) si no se manda
  branchId?: number // idem AddStockRequest
}

export type AddStockResponse = {
  id: number
  quantity: number
  createdAt: string
  variant: {
    id: number
  }
}

// Varias variantes de un saque, mismo motivo, solo del deposito de la bodega
// principal (?branchId se ignora). Todo o nada: una linea sin stock, no se
// graba ninguna. Hasta 300 lineas, sin repetir variante.
export type SubtractStockBulkRequest = {
  items: { variantId: number; quantity: number }[]
  reason: string
}

export type SubtractStockBulkResponse = AddStockResponse[]

export type StockTransferDirection = 'warehouse_to_floor' | 'floor_to_warehouse'

export type TransferStockRequest = {
  variantId: number
  quantity: number
  direction: StockTransferDirection
  reason?: string
  branchId?: number // idem AddStockRequest — va como query param, no en el body
}

export type StockTransfer = {
  id: number
  direction: StockTransferDirection
  quantity: number
  createdAt: string
}
export interface MediaFile {
  id: string
  url: string
  type: 'image' | 'video' | 'document'
  name: string
  source: 'new' | 'existing'
  file?: File
}

export type StockMovementType =
  | 'ingreso'
  | 'venta'
  | 'ajuste'
  | 'traspaso'
  | 'envio_bodega'
  | 'salida_pedido'
  | 'envio_anulado'
  | 'pedido_anulado'
  | 'recepcion'
  | 'aparecio_en_destino'
  | 'aparecio_en_origen'

  // Devoluciones a la bodega principal: salen de la tienda y vuelven si se anula
  | 'devolucion_bodega'
  | 'devolucion_anulada'

export interface StockMovement {
  id: number
  type: StockMovementType

  // El signo distingue una baja de un ajuste positivo dentro de type 'ajuste'
  quantity: number
  location: StockLocation
  reason: string | null
  user: string | null
  orderId: number | null
  stockTransferId: number | null
  branchTransferId: number | null
  counterpartBranch: { id: number; name: string } | null
  createdAt: string
}

export interface StockMovementsResponse {
  data: StockMovement[]
  meta: {
    total: number
    page: number
    lastPage: number
    limit: number
    offset: number
    hasNextPage: boolean
    hasPreviousPage: boolean
  }
}

// --- Importacion por Excel (ADMIN, SUPERVISOR) ---

export interface ImportLine {

  // Filas del Excel que aportaron a esta linea (se suman si la variante se repite)
  rows: number[]
  variantId: number
  product: string
  color: string
  size: string
  quantity: number

  // Solo en el envio: lo que hay en la bodega para esa variante
  available?: number
}

export interface ImportStockResponse {
  dryRun: boolean
  totalUnits: number
  lines: ImportLine[]
  warnings?: string[]

  // Solo en el envio: null con dryRun=true, el envio creado con dryRun=false
  transfer?: { id: number } | null
  destination?: { id: number; name: string }
}

// El 400 con filas mal trae `errors`; los demas (archivo invalido, limite de
// 300, encabezados) traen solo `message`.
export interface ImportRowError {
  row: number
  message: string
}

// --- GET /variants/products: el mismo stock, paginado por PRODUCTO ---
//
// `GET /variants` pagina por color, asi que los colores de un mismo producto se
// parten entre paginas y una tabla agrupada por producto muestra el producto
// incompleto. Este endpoint devuelve cada producto con TODOS sus colores.

export interface VariantsMeta {
  total: number
  page: number
  lastPage: number
  limit: number
  offset: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

export interface ProductColorWithStock {
  id?: number
  color: Color
  variants: VariantSize[]
  multimedia?: string[]
  pdfs?: string[]
}

export interface ProductWithStock {
  id: number
  name: string
  productColors: ProductColorWithStock[]
  subcategory?: { id: number; name: string; category?: { id: number; name: string } }

  // null si no hay descuento vigente
  discount?: unknown | null
}
