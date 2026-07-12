import { apiClient } from '@/libs/axios'
import type {
  Product,
  CreateProductDto,
  UpdateProductDto,
  ProductsParams,
  ProductsResponse,
  ProductsApiResponse,
  ListaProductosSINResponse
} from '@/types/api/product'

class ProductServiceClass {
  async getProducts(params: ProductsParams = {}): Promise<ProductsResponse> {
    const { limit = 10, page = 1, search } = params

    const searchParams = new URLSearchParams({
      limit: limit.toString(),
      page: page.toString()
    })

    if (search) {
      searchParams.append('search', search)
    }

    const response = await apiClient.get<ProductsApiResponse>(`/api/products?${searchParams.toString()}`)

    return {
      products: response.data.data,
      total: response.data.meta.total,
      page: response.data.meta.page,
      limit: response.data.meta.limit
    }
  }

  async getProductById(id: number): Promise<Product> {
    const response = await apiClient.get<Product>(`/api/products/${id}`)

    return response.data
  }

  async createProduct(data: CreateProductDto): Promise<Product> {
    const response = await apiClient.post<Product>('/api/products', data)

    return response.data
  }

  async updateProduct(id: number, data: UpdateProductDto): Promise<Product> {
    const response = await apiClient.patch<Product>(`/api/products/${id}`, data)

    return response.data
  }

  async deleteProduct(id: number): Promise<void> {
    await apiClient.delete(`/api/products/${id}`)
  }

  // Obtener lista de productos SIN (SIAT)
  async getProductosSIN(): Promise<ListaProductosSINResponse> {
    const response = await apiClient.post<ListaProductosSINResponse>(
      '/api/catalogos/listas',
      { metodo: 'sincronizarListaProductosServicios' },
      { params: { codigoSucursal: 0, codigoPuntoVenta: 0 } }
    )

    return response.data
  }
}

export const productService = new ProductServiceClass()
