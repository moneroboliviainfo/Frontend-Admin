export interface Subcategory {
  id: number
  name: string
  enabled: boolean
}

export interface Brand {
  id: number
  name: string
  enabled: boolean
}

export interface Product {
  id: number
  name: string
  description: string
  price: string
  enabled: boolean
  subcategory: Subcategory
  brand?: Brand
  discount?: number
  createdAt?: string
  updatedAt?: string
}

export interface CreateProductDto {
  name: string
  description: string
  price: string
  enabled?: boolean
  subcategory: number
  brand?: number
  discount?: number
  codigoProductoSin?: number
  unidadMedida?: number
}

export interface UpdateProductDto extends Partial<CreateProductDto> {}

export interface ProductsResponse {
  products: Product[]
  total: number
  page: number
  limit: number
}

export interface ProductsParams {
  limit?: number
  page?: number
  search?: string
}

export interface ProductsApiResponse {
  data: Product[]
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

// Tipos para productos SIN (SIAT)
export interface ProductoSIN {
  codigoProducto: number
  codigoActividad: string
  descripcionProducto: string
  nandina?: string[]
}

export interface ListaProductosSINResponse {
  id: number
  codigoAmbiente: number
  codigoPuntoVenta: number
  codigoSistema: string
  codigoSucursal: number
  codigoCuis: string
  nit: string
  createdAt: string
  listas: {
    id: number
    methodName: string
    payload: {
      RespuestaListaProductos: {
        transaccion: boolean
        listaCodigos: ProductoSIN[]
      }
    }
    createdAt: string
  }[]
}
