import { z } from 'zod'

export const mediaFileSchema = z.object({
  id: z.string(),
  file: z.instanceof(File).nullable(),
  url: z.string().url('URL inválida'),
  type: z.enum(['image', 'video', 'document']),
  name: z.string().min(1, 'El nombre del archivo es requerido'),
  source: z.enum(['existing', 'new'])
})

export const variantSizeFormSchema = z.object({
  id: z.number().optional(),
  size: z.string().min(1, 'La talla es requerida'),
  quantity: z.number().int().min(0, 'El stock no puede ser negativo'),

  // Stock en bodega de esta talla (solo lo trae el backend al editar, no se manda de vuelta)
  warehouseStock: z.number().int().min(0).optional()
}).refine(
  data => {
    // Si tiene id (modo editar), permitir stock 0
    if (data.id !== undefined) {
      return true
    }

    // Si no tiene id (modo crear), requerir stock mayor a 0
    return data.quantity > 0
  },
  {
    message: 'El stock debe ser mayor a 0 al crear una nueva talla',
    path: ['quantity']
  }
)

export const variantFormSchema = z
  .object({
    colorId: z.string().min(1, 'Debes seleccionar un color'),
    customColorName: z.string().optional(),
    customColorCode: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/, 'Código hexadecimal inválido')
      .optional(),

    sizes: z
      .array(variantSizeFormSchema)
      .min(1, 'Debes agregar al menos una talla')
      .refine(
        sizes => {
          const sizeNames = sizes.map(s => s.size.toLowerCase().trim())

          return new Set(sizeNames).size === sizeNames.length
        },
        { message: 'No puedes tener tallas duplicadas' }
      ),

    mediaFiles: z
      .array(mediaFileSchema)
      .min(1, 'Debes agregar al menos un archivo multimedia')
      .refine(files => files.some(f => f.type === 'image'), { message: 'Debes incluir al menos una imagen' })
  })
  .refine(
    data => {
      if (data.colorId === 'custom') {
        return !!data.customColorName && !!data.customColorCode
      }

      return true
    },
    {
      message: 'Debes completar el nombre y código del color personalizado',
      path: ['customColorName']
    }
  )

export const newColorSchema = z.object({
  name: z.string().min(3, 'El nombre debe tener al menos 3 caracteres').max(50),
  code: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Código hexadecimal inválido')
})

export type VariantFormData = z.infer<typeof variantFormSchema>
export type MediaFile = z.infer<typeof mediaFileSchema>
export type VariantSizeForm = z.infer<typeof variantSizeFormSchema>
export type NewColorForm = z.infer<typeof newColorSchema>
