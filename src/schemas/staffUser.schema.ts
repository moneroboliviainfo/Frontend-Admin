import { z } from 'zod'

export const createUserFormSchema = z
  .object({
    name: z.string().min(3, 'El nombre debe tener al menos 3 caracteres'),
    email: z.string().email('Email inválido'),
    password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
    rol: z.enum(['admin', 'supervisor', 'manager', 'cashier']),
    branchId: z.number().optional()
  })
  .refine(data => data.rol === 'admin' || data.rol === 'supervisor' || typeof data.branchId === 'number', {
    message: 'La sucursal es obligatoria para Encargado/Cajero',
    path: ['branchId']
  })

export type CreateUserFormData = z.infer<typeof createUserFormSchema>

export const resetPasswordFormSchema = z.object({
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres')
})

export type ResetPasswordFormData = z.infer<typeof resetPasswordFormSchema>

export const changeMyPasswordFormSchema = z
  .object({
    currentPassword: z.string().min(1, 'Ingresá tu contraseña actual'),
    newPassword: z.string().min(6, 'La nueva contraseña debe tener al menos 6 caracteres'),
    confirmPassword: z.string().min(1, 'Repetí la nueva contraseña')
  })
  .refine(data => data.newPassword === data.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword']
  })

export type ChangeMyPasswordFormData = z.infer<typeof changeMyPasswordFormSchema>
