import { db } from '@/lib/supabase'
import type { ForgotInput, LoginInput, ProfileInput, RegisterInput } from '../schemas'

/** Traduce los errores más comunes de Supabase Auth. */
export function authErrorMessage(error: unknown): string {
  const msg = (error as { message?: string })?.message ?? ''
  if (/invalid login credentials/i.test(msg)) return 'Correo o contraseña incorrectos.'
  if (/email not confirmed/i.test(msg)) return 'Debes confirmar tu correo antes de ingresar. Revisa tu bandeja de entrada.'
  if (/already registered|already been registered/i.test(msg)) return 'Ya existe una cuenta con este correo.'
  if (/rate limit|too many/i.test(msg)) return 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.'
  if (/password/i.test(msg) && /weak|short|characters/i.test(msg)) return 'La contraseña es muy débil. Usa al menos 8 caracteres.'
  if (/same password|different from the old/i.test(msg)) return 'La nueva contraseña debe ser distinta de la anterior.'
  if (/no está configurado/i.test(msg)) return msg
  return 'No pudimos completar la operación. Inténtalo de nuevo.'
}

// Incluye la ruta base (GitHub Pages sirve en /ALITAS-NELCY/)
const origin = () => window.location.origin + import.meta.env.BASE_URL.replace(/\/$/, '')

export async function signIn({ email, password }: LoginInput) {
  const { error } = await db().auth.signInWithPassword({ email, password })
  if (error) throw error
}

export async function signUp({ email, password, full_name, phone }: RegisterInput) {
  const { data, error } = await db().auth.signUp({
    email,
    password,
    options: { data: { full_name, phone }, emailRedirectTo: `${origin()}/ingresar?verificado=1` },
  })
  if (error) throw error
  // Con confirmación de correo activa, Supabase devuelve un usuario sin identidades si el correo ya existía.
  if (data.user && data.user.identities?.length === 0) throw new Error('User already registered')
}

export async function resendConfirmation(email: string) {
  const { error } = await db().auth.resend({ type: 'signup', email, options: { emailRedirectTo: `${origin()}/ingresar?verificado=1` } })
  if (error) throw error
}

export async function requestPasswordReset({ email }: ForgotInput) {
  const { error } = await db().auth.resetPasswordForEmail(email, { redirectTo: `${origin()}/restablecer` })
  // No revelar si el correo existe: solo se propagan errores de límite de envíos.
  if (error && /rate limit|too many/i.test(error.message)) throw error
}

export async function updatePassword(password: string) {
  const { error } = await db().auth.updateUser({ password })
  if (error) throw error
}

export interface MyCustomer {
  id: string
  full_name: string
  phone: string | null
  email: string | null
}

export async function fetchMyCustomer(): Promise<MyCustomer | null> {
  const { data, error } = await db().from('customers').select('id, full_name, phone, email').maybeSingle()
  if (error) throw error
  return data
}

export async function updateMyCustomer(id: string, input: ProfileInput) {
  const { error } = await db()
    .from('customers')
    .update({ full_name: input.full_name, phone: input.phone || null })
    .eq('id', id)
  if (error) throw error
}
