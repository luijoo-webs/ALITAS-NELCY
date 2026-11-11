// Validación sin zod a propósito: este archivo va en el paquete inicial y zod pesa ~60 kB.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

const valid = Boolean(url && /^https:\/\/[^\s/]+/.test(url) && anonKey && anonKey.length >= 20)

// Barrera contra un error grave: si alguien pega la service_role (o una clave secreta) aquí, no arrancar.
if (anonKey && (anonKey.startsWith('sb_secret_') || jwtRole(anonKey) === 'service_role')) {
  throw new Error('VITE_SUPABASE_ANON_KEY contiene una clave secreta. Usa solo la anon/publishable key.')
}
function jwtRole(token: string): string | undefined {
  try {
    return JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).role
  } catch {
    return undefined
  }
}

/** null mientras no exista .env.local: la app muestra "configuración pendiente" en vez de romperse. */
export const env = valid ? { VITE_SUPABASE_URL: url!, VITE_SUPABASE_ANON_KEY: anonKey! } : null

if (!valid && import.meta.env.DEV) {
  console.warn('[config] Falta VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Copia .env.example a .env.local.')
}
