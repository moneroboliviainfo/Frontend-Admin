// Sucursal donde vale un descuento, tal como la devuelve el back
export interface DiscountBranch {
  id: number
  name: string
}

export interface BaseDiscount {
  description: string
  isActive: boolean

  // OBSOLETOS desde el 06/11/2026. En la respuesta son un resumen ("aplica en
  // ese canal de ALGUNA sucursal"), no sirven para saber si aplica en una
  // sucursal concreta. En create solo cuentan si no viene la lista del mismo
  // canal, asi que no se mandan mas: van inStoreBranchIds / onlineBranchIds.
  appliesOnline?: boolean
  appliesInStore?: boolean

  // Sucursales donde vale, por canal. Omitir una lista AL CREAR = todas las
  // tiendas de ese canal; [] = ninguna. Solo acepta sucursales tipo tienda:
  // la bodega principal o una de solo facturacion dan 400
  inStoreBranchIds?: number[]
  onlineBranchIds?: number[]

  value: number
}

export interface PermanentDiscountRequest extends BaseDiscount {}

export interface SeasonalDiscountRequest extends BaseDiscount {
  startDate: string
  endDate: string
}

export interface DiscountResponse {
  id: number
  description: string
  isActive: boolean

  // Resumen: true = aplica en ese canal de ALGUNA sucursal (ver BaseDiscount)
  appliesOnline: boolean
  appliesInStore: boolean

  // Las sucursales reales donde vale, por canal
  inStoreBranches?: DiscountBranch[]
  onlineBranches?: DiscountBranch[]

  value: number
  startDate?: string
  endDate?: string
  createdAt?: string
  updatedAt?: string
}

// El PATCH acepta los mismos campos que el POST, todos opcionales. OJO con las
// listas: la que se manda REEMPLAZA la anterior entera, la que se omite no
// cambia. Para quitar una sucursal hay que mandar la lista sin ella, no [].
export interface UpdatePermanentDiscountRequest extends Partial<BaseDiscount> {}

export interface UpdateSeasonalDiscountRequest extends Partial<BaseDiscount> {
  startDate?: string
  endDate?: string
}

export interface AddDiscountsToProductsRequest {
  productsIds: number[]
  discountId: number
}

export interface AddDiscountsToProductsResponse {
  success: boolean
  message?: string
  updatedProducts?: number
}

export interface RemoveDiscountRequest {
  discount: null
}
export interface ApplyDiscountToAllRequest {
  discountId: number
}
