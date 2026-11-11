// Tipos de las filas que usa el frontend. Reflejan supabase/migrations.
// shortcut: escritos a mano; al conectar el proyecto, reemplazar por
// `npx supabase gen types typescript --project-id <id> > src/types/database.types.ts`.

export interface RestaurantSettings {
  name: string
  tagline: string | null
  phone: string | null
  whatsapp: string | null
  public_email: string | null
  address: string | null
  neighborhood: string | null
  city: string | null
  maps_url: string | null
  instagram_url: string | null
  facebook_url: string | null
  tiktok_url: string | null
  orders_paused: boolean
  paused_message: string | null
  prep_time_minutes: number | null
}

export interface BusinessHour {
  id: string
  weekday: number
  opens_at: string
  closes_at: string
}

export interface ProductImage {
  id: string
  storage_path: string
  alt: string | null
  sort_order: number
}

export interface ProductVariant {
  id: string
  name: string
  price: number
  is_default: boolean
  sort_order: number
}

export interface ModifierOption {
  id: string
  name: string
  price_delta: number
  sort_order: number
}

export interface ModifierGroup {
  id: string
  name: string
  description: string | null
  min_select: number
  max_select: number
  modifier_options: ModifierOption[]
}

export interface Promotion {
  id: string
  name: string
  description: string | null
  type: 'percent' | 'fixed' | 'label'
  value: number
  label: string | null
  ends_at: string | null
}

export interface Product {
  id: string
  category_id: string
  name: string
  slug: string
  description: string | null
  base_price: number
  is_available: boolean
  is_featured: boolean
  allergens: string[]
  tags: string[]
  sort_order: number
  product_images: ProductImage[]
  product_variants: ProductVariant[]
  product_modifier_groups: { sort_order: number; modifier_groups: ModifierGroup | null }[]
  promotion_products: { promotions: Promotion | null }[]
}

export interface Category {
  id: string
  name: string
  slug: string
  description: string | null
  sort_order: number
  products: Product[]
}
