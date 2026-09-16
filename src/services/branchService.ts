import { apiClient } from '@/libs/axios'
import type {
  Branch,
  CreateBranchDto,
  UpdateBranchDto,
  BranchesParams,
  BranchesApiResponse,
  BranchesResponse
} from '@/types/api/branch'

class BranchServiceClass {
  async getBranches(params: BranchesParams = {}): Promise<BranchesResponse> {
    const { limit = 10, page = 1 } = params

    const searchParams = new URLSearchParams({
      limit: limit.toString(),
      page: page.toString()
    })

    const response = await apiClient.get<BranchesApiResponse>(`/api/branches?${searchParams.toString()}`)

    return {
      branches: response.data.data,
      total: response.data.meta.total,
      page: response.data.meta.page,
      limit: response.data.meta.limit
    }
  }

  async getBranchById(id: number): Promise<Branch> {
    const response = await apiClient.get<Branch>(`/api/branches/${id}`)

    return response.data
  }

  async createBranch(data: CreateBranchDto): Promise<Branch> {
    const response = await apiClient.post<Branch>('/api/branches', data)

    return response.data
  }

  async updateBranch(id: number, data: UpdateBranchDto): Promise<Branch> {
    const response = await apiClient.patch<Branch>(`/api/branches/${id}`, data)

    return response.data
  }
}

export const branchService = new BranchServiceClass()
