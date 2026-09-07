export interface Permission {
  resource: string
  permissions: string[]
}

// Roles que vienen del backend (en minúsculas)
export type BackendRole = 'admin' | 'manager' | 'cashier'

// Roles normalizados para usar en el frontend (en mayúsculas)
export type Role = 'ADMIN' | 'MANAGER' | 'CASHIER'

// Mapeo de roles del backend a frontend
export const normalizeRole = (backendRole: BackendRole): Role => {
  const roleMap: Record<BackendRole, Role> = {
    admin: 'ADMIN',
    manager: 'MANAGER',
    cashier: 'CASHIER'
  }

  return roleMap[backendRole] || 'CASHIER'
}

// Datos del usuario autenticado
export interface AuthUser {
  email: string
  name: string
  role: Role
  token: string
  branch?: {
    id: number
    name: string
  } | null
}

// Respuesta del login del backend
export interface LoginResponse {
  email: string
  name: string
  rol: BackendRole
  token: string
  branch?: {
    id: number
    name: string
  } | null
}

// Estado del contexto de autenticación
export interface AuthState {
  user: AuthUser | null
  isAuthenticated: boolean
  isLoading: boolean
}

// Sucursal para selector (respuesta de GET /api/branches)
export interface BranchListItem {
  id: number
  name: string
  active: boolean
  createdAt: string
  siatBranch: unknown | null
}

export interface BranchListResponse {
  data: BranchListItem[]
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

// Tipos legacy (mantener por compatibilidad temporal)
export type StaticRole = Role

export interface UserSession {
  email: string
  role?: Role
  permissions?: Permission[]
}
