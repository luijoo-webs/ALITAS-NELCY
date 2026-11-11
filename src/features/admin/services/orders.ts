import { db } from '@/lib/supabase'

export interface OrderRow {
  id: string
  number: number
  public_token: string
  channel: 'web' | 'counter' | 'phone' | 'whatsapp'
  fulfillment: 'delivery' | 'pickup' | 'dine_in'
  status: string
  customer_name: string | null
  customer_phone: string | null
  customer_email: string | null
  address: string | null
  neighborhood: string | null
  address_reference: string | null
  subtotal: number
  delivery_fee: number
  discount: number
  total: number
  payment_status: 'pending' | 'paid' | 'failed' | 'refunded'
  cash_change_for: number | null
  notes: string | null
  inventory_state: string
  created_at: string
  payment_methods: { label: string; code: string; requires_proof: boolean } | null
  delivery_zones: { name: string } | null
  order_items: { id: string; name_snapshot: string; quantity: number; unit_price: number; line_total: number; notes: string | null;
    order_item_modifiers: { name_snapshot: string }[] }[]
}

export interface OrderStatus { code: string; label: string; kind: string; sort_order: number; is_active: boolean }

const FIELDS = `id, number, public_token, channel, fulfillment, status, customer_name, customer_phone, customer_email,
  address, neighborhood, address_reference, subtotal, delivery_fee, discount, total, payment_status, cash_change_for,
  notes, inventory_state, created_at,
  payment_methods ( label, code, requires_proof ), delivery_zones ( name ),
  order_items ( id, name_snapshot, quantity, unit_price, line_total, notes, order_item_modifiers ( name_snapshot ) )`

/** Pedidos abiertos + los cerrados de las últimas 24 h. */
export async function fetchBoard(): Promise<OrderRow[]> {
  const since = new Date(Date.now() - 24 * 3600_000).toISOString()
  const { data, error } = await db().from('orders').select(FIELDS)
    .or(`status.not.in.(delivered,cancelled),created_at.gte.${since}`)
    .order('created_at', { ascending: false }).limit(200)
  if (error) throw error
  return data as unknown as OrderRow[]
}

export async function fetchOrderHistory(from: string, to: string): Promise<OrderRow[]> {
  const { data, error } = await db().from('orders').select(FIELDS)
    .gte('created_at', from).lt('created_at', to).order('created_at', { ascending: false }).limit(500)
  if (error) throw error
  return data as unknown as OrderRow[]
}

export async function fetchStatuses(): Promise<OrderStatus[]> {
  const { data, error } = await db().from('order_statuses').select('*').order('sort_order')
  if (error) throw error
  return data as OrderStatus[]
}

export async function setStatus(id: string, status: string, restock = true, reason?: string) {
  const { error } = await db().rpc('set_order_status', { p_order: id, p_status: status, p_restock: restock, p_reason: reason ?? null })
  if (error) throw error
}

export async function setPayment(id: string, status: string) {
  const { error } = await db().rpc('set_order_payment', { p_order: id, p_status: status, p_reference: null })
  if (error) throw error
}

export interface CreateOrderPayload {
  idempotency_key: string
  channel: 'web' | 'counter' | 'phone' | 'whatsapp'
  fulfillment: 'delivery' | 'pickup' | 'dine_in'
  customer: { name?: string; phone?: string; email?: string }
  address?: { address?: string; neighborhood?: string; reference?: string }
  payment_method: string
  cash_change_for?: number | null
  notes?: string
  items: { product_id: string; variant_id: string | null; quantity: number; options: string[]; notes?: string }[]
  confirm?: boolean
}

export async function createOrder(p: CreateOrderPayload): Promise<{ id: string; number: number; token: string; total: number; status: string }> {
  const { data, error } = await db().rpc('create_order', { p })
  if (error) throw error
  return data
}

export const CHANNEL_LABEL = { web: 'Web', counter: 'Mostrador', phone: 'Teléfono', whatsapp: 'WhatsApp' } as const
export const FULFILL_LABEL = { delivery: 'Domicilio', pickup: 'Recoge', dine_in: 'En el local' } as const
