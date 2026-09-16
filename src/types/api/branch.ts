export interface SiatBranch {
  codigoSucursal: number
  name: string
  alias: string
  razonSocial: string
  actividadEconomica: string
  address: string
  departamento: string
  municipio: string
  telefono: string
  active?: boolean
}

export interface Branch {
  id: number
  name: string
  active: boolean
  createdAt: string
  siatBranch: SiatBranch | null
}

export interface CreateBranchDto {
  name: string
  siatBranch?: SiatBranch
}

export interface UpdateBranchDto {
  name?: string
  active?: boolean
  siatBranch?: SiatBranch
}

export interface BranchesParams {
  limit?: number
  page?: number
}

export interface BranchesApiResponse {
  data: Branch[]
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

export interface BranchesResponse {
  branches: Branch[]
  total: number
  page: number
  limit: number
}
