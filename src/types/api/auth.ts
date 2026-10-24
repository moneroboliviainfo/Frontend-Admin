export interface Permission {
  resource: string
  permissions: string[]
}

// Roles que vienen del backend (en minúsculas)
export type BackendRole = 'admin' | 'supervisor' | 'manager' | 'cashier'

// Roles normalizados para usar en el frontend (en mayúsculas)
export type Role = 'ADMIN' | 'SUPERVISOR' | 'MANAGER' | 'CASHIER'

// Mapeo de roles del backend a frontend
export const normalizeRole = (backendRole: BackendRole): Role => {
  const roleMap: Record<BackendRole, Role> = {
    admin: 'ADMIN',
    supervisor: 'SUPERVISOR',
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

    // 'billing_only': la sucursal solo emite facturas. Su staff no tiene
    // stock, ventas, caja ni traslados (el back responde 403).
    type?: BranchType
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

// Las 'billing_only' NO vienen en GET /branches sin parametro: hay que pedirlas
// aparte con ?type=billing_only (doc 07)
export type BranchType = 'store' | 'billing_only'

// Sucursal para selector (respuesta de GET /api/branches)
export interface BranchListItem {
  id: number
  name: string
  active: boolean
  createdAt: string
  siatBranch: unknown | null
  type?: BranchType
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
