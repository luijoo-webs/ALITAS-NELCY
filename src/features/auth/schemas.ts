import { z } from 'zod'

const email = z.email('Escribe un correo válido').trim().toLowerCase()
const password = z.string().min(8, 'Mínimo 8 caracteres').max(72, 'Máximo 72 caracteres')
const phone = z
  .string()
  .trim()
  .regex(/^\+?[0-9 ]{7,20}$/, 'Escribe un teléfono válido (solo números)')

export const loginSchema = z.object({ email, password: z.string().min(1, 'Escribe tu contraseña') })

export const registerSchema = z
  .object({
    full_name: z.string().trim().min(2, 'Escribe tu nombre').max(120),
    phone,
    email,
    password,
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Las contraseñas no coinciden' })

export const forgotSchema = z.object({ email })

export const resetSchema = z
  .object({ password, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Las contraseñas no coinciden' })

export const profileSchema = z.object({
  full_name: z.string().trim().min(2, 'Escribe tu nombre').max(120),
  phone: phone.or(z.literal('')),
})

export type LoginInput = z.infer<typeof loginSchema>
export type RegisterInput = z.infer<typeof registerSchema>
export type ForgotInput = z.infer<typeof forgotSchema>
export type ResetInput = z.infer<typeof resetSchema>
export type ProfileInput = z.infer<typeof profileSchema>
