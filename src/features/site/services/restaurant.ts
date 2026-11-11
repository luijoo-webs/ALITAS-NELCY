import { db } from '@/lib/supabase'
import type { BusinessHour, RestaurantSettings } from '@/types/domain'

export async function fetchSettings(): Promise<RestaurantSettings> {
  const { data, error } = await db()
    .from('restaurant_settings')
    .select('name, tagline, phone, whatsapp, public_email, address, neighborhood, city, maps_url, instagram_url, facebook_url, tiktok_url, orders_paused, paused_message, prep_time_minutes')
    .single()
  if (error) throw error
  return data
}

export async function fetchHours(): Promise<BusinessHour[]> {
  const { data, error } = await db().from('business_hours').select('id, weekday, opens_at, closes_at').order('weekday').order('opens_at')
  if (error) throw error
  return data
}

export async function fetchIsOpen(): Promise<boolean> {
  const { data, error } = await db().rpc('is_open_now')
  if (error) throw error
  return Boolean(data)
}
