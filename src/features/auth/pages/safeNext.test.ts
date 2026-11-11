import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({ db: () => { throw new Error('no db') }, supabase: null }))
const { safeNext } = await import('./LoginPage')

describe('safeNext (evita redirecciones abiertas tras el login)', () => {
  it.each(['/cuenta', '/menu?categoria=combos', '/pedido/abc'])('acepta ruta interna %s', (v) => {
    expect(safeNext(v)).toBe(v)
  })
  it.each([null, '', 'https://evil.com', '//evil.com', '/\\evil.com', 'javascript:alert(1)', '/ evil'])('rechaza %s', (v) => {
    expect(safeNext(v)).toBe('/cuenta')
  })
})
