import { db } from '@/lib/supabase'
import type { Category, Product, Promotion } from '@/types/domain'

// RLS ya filtra: anon solo recibe categorías activas y productos no archivados.
const PRODUCT_FIELDS = `
  id, category_id, name, slug, description, base_price, is_available, is_featured,
  allergens, tags, sort_order,
  product_images ( id, storage_path, alt, sort_order ),
  product_variants ( id, name, price, is_default, sort_order ),
  product_modifier_groups ( sort_order, modifier_groups ( id, name, description, min_select, max_select,
    modifier_options ( id, name, price_delta, sort_order ) ) ),
  promotion_products ( promotions ( id, name, description, type, value, label, ends_at ) )
`

const bySort = <T extends { sort_order: number }>(a: T, b: T) => a.sort_order - b.sort_order

function normalize(p: Product): Product {
  return {
    ...p,
    base_price: Number(p.base_price),
    product_images: [...p.product_images].sort(bySort),
    product_variants: p.product_variants.map((v) => ({ ...v, price: Number(v.price) })).sort(bySort),
    product_modifier_groups: p.product_modifier_groups
      .filter((g) => g.modifier_groups)
      .sort(bySort)
      .map((g) => ({
        ...g,
        modifier_groups: {
          ...g.modifier_groups!,
          modifier_options: g.modifier_groups!.modifier_options
            .map((o) => ({ ...o, price_delta: Number(o.price_delta) }))
            .sort(bySort),
        },
      })),
    // RLS deja pasar solo promociones vigentes; las demás llegan como null.
    promotion_products: p.promotion_products.filter((pp) => pp.promotions),
  }
}

export async function fetchMenu(): Promise<Category[]> {
  const { data, error } = await db()
    .from('categories')
    .select(`id, name, slug, description, sort_order, products ( ${PRODUCT_FIELDS} )`)
    .order('sort_order')
  if (error) throw error
  return (data as unknown as Category[]).map((c) => ({
    ...c,
    products: c.products.map(normalize).sort(bySort),
  }))
}

export async function fetchActivePromotions(): Promise<(Promotion & { products: Pick<Product, 'id' | 'name' | 'slug'>[] })[]> {
  const { data, error } = await db()
    .from('promotions')
    .select('id, name, description, type, value, label, ends_at, promotion_products ( products ( id, name, slug ) )')
    .order('ends_at', { ascending: true, nullsFirst: false })
  if (error) throw error
  return (data as any[]).map(({ promotion_products, ...p }) => ({
    ...p,
    value: Number(p.value),
    products: promotion_products.map((pp: any) => pp.products).filter(Boolean),
  }))
}

/** Precio que se muestra: el de la variante por defecto o el mínimo de las variantes. */
export function displayPrice(p: Product): { amount: number; from: boolean } {
  if (p.product_variants.length === 0) return { amount: p.base_price, from: false }
  const prices = p.product_variants.map((v) => v.price)
  return { amount: Math.min(...prices), from: new Set(prices).size > 1 }
}
