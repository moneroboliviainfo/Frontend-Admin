export interface Settings {
  id: number

  // Plazo para que el cliente retire su pedido (1 a 365)
  branchRequestPickupDays: number

  // Dias que la prenda queda apartada en pedidos SIN cobro (0 a 365, 0 = sin apartado).
  // No puede superar el plazo de retiro.
  branchRequestHoldDays: number
  updatedAt: string | null
  updatedBy: { id: number; name: string } | null
}

export interface UpdateSettingsRequest {
  branchRequestPickupDays?: number
  branchRequestHoldDays?: number
}
