import { db } from '@/lib/supabase'

export async function fetchMyPermissions(): Promise<string[]> {
  const { data, error } = await db().rpc('my_permissions')
  if (error) throw error
  return (data as string[] | null) ?? []
}

export interface DashboardSummary {
  sales: number
  delivered_count: number
  orders_count: number
  cancelled_count: number
  avg_ticket: number
  new_customers: number
  by_day: { day: string; sales: number; orders: number }[]
  by_channel: { channel: 'web' | 'counter' | 'phone' | 'whatsapp'; sales: number; orders: number }[]
  top_products: { name: string; quantity: number; sales: number }[]
  open_by_status: { code: string; label: string; count: number }[]
  catalog: { products: number; unavailable: number }
}

export async function fetchDashboard(from: Date, to: Date): Promise<DashboardSummary> {
  const { data, error } = await db().rpc('dashboard_summary', { p_from: from.toISOString(), p_to: to.toISOString() })
  if (error) throw error
  return data as DashboardSummary
}

const BOGOTA_OFFSET_MS = 5 * 60 * 60 * 1000 // Colombia no tiene horario de verano: UTC−5 fijo

/** Rango de `days` días calendario en Bogotá que termina en la próxima medianoche (incluye hoy). */
export function bogotaRange(days: number, now = new Date()) {
  const local = new Date(now.getTime() - BOGOTA_OFFSET_MS)
  const startToday = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) + BOGOTA_OFFSET_MS
  const to = new Date(startToday + 86_400_000)
  const from = new Date(startToday - (days - 1) * 86_400_000)
  return { from, to }
}
