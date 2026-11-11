import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({ db: () => { throw new Error('no db in tests') } }))
const { displayPrice } = await import('./catalog')

const base = { base_price: 15000, product_variants: [] } as never

describe('displayPrice', () => {
  it('sin variantes usa el precio base', () => {
    expect(displayPrice(base)).toEqual({ amount: 15000, from: false })
  })
  it('con variantes de distinto precio muestra "desde" el mínimo', () => {
    const p = { ...(base as object), product_variants: [{ price: 9000 }, { price: 5000 }] } as never
    expect(displayPrice(p)).toEqual({ amount: 5000, from: true })
  })
  it('con variantes del mismo precio no muestra "desde"', () => {
    const p = { ...(base as object), product_variants: [{ price: 5000 }, { price: 5000 }] } as never
    expect(displayPrice(p)).toEqual({ amount: 5000, from: false })
  })
})
