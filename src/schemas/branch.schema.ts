import { z } from 'zod'

export const siatBranchFormSchema = z.object({
  codigoSucursal: z.number({ invalid_type_error: 'Obligatorio' }),
  name: z.string().min(1, 'Obligatorio'),
  alias: z.string().min(1, 'Obligatorio'),
  razonSocial: z.string().min(1, 'Obligatorio'),
  actividadEconomica: z.string().min(1, 'Obligatorio'),
  address: z.string().min(1, 'Obligatorio'),
  departamento: z.string().min(1, 'Obligatorio'),
  municipio: z.string().min(1, 'Obligatorio'),
  telefono: z.string().min(1, 'Obligatorio'),
  active: z.boolean()
})

export type SiatBranchFormData = z.infer<typeof siatBranchFormSchema>

export const initialSiatBranchForm: SiatBranchFormData = {
  codigoSucursal: 0,
  name: '',
  alias: '',
  razonSocial: '',
  actividadEconomica: '',
  address: '',
  departamento: '',
  municipio: '',
  telefono: '',
  active: true
}
