import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { env } from '@/config/env'

export const supabase: SupabaseClient | null = env
  ? createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null

export class NotConfiguredError extends Error {
  constructor() {
    super('Supabase no está configurado todavía.')
  }
}

/** Devuelve el cliente o lanza un error claro (lo muestran los estados de error de la UI). */
export function db(): SupabaseClient {
  if (!supabase) throw new NotConfiguredError()
  return supabase
}

export function publicImageUrl(path: string) {
  // Fotos iniciales del menú viven en public/static; las subidas desde el panel, en Storage.
  if (path.startsWith('static/')) return import.meta.env.BASE_URL + path
  return db().storage.from('product-images').getPublicUrl(path).data.publicUrl
}
