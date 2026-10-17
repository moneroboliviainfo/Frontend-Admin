export interface VariantSize {
  id?: number
  size:
    | {
        id: number
        name: string
      }
    | string
  availableStock?: number
  warehouseStock?: number
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
