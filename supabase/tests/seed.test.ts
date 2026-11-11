import { readFileSync } from 'node:fs'
import { beforeAll, describe, expect, it } from 'vitest'
import { asAdmin, asAnon, createDb, type Db } from './harness'

const SEED = readFileSync(new URL('../seed/catalogo-2026-11-11.sql', import.meta.url), 'utf8')
let db: Db

beforeAll(async () => {
  db = await createDb()
  await asAdmin(db)
  await db.exec(SEED)
  await db.exec(SEED) // idempotente: se puede volver a correr sin duplicar
})

describe('catálogo inicial', () => {
  it('carga categorías, productos, fotos y opciones sin duplicar', async () => {
    const { rows } = await db.query<Record<string, number>>(`select
      (select count(*)::int from public.categories) c, (select count(*)::int from public.products) p,
      (select count(*)::int from public.product_images) i, (select count(*)::int from public.modifier_options) o,
      (select count(*)::int from public.product_modifier_groups) l`)
    expect(rows[0]).toEqual({ c: 5, p: 45, i: 40, o: 9, l: 7 * 2 + 11 })
  })

  it('el público ve el menú con precios', async () => {
    await asAnon(db)
    const { rows } = await db.query<{ name: string; base_price: string }>(`select name, base_price from public.products where slug = 'combo-1'`)
    expect(rows[0]).toMatchObject({ name: 'Combo #1', base_price: '15000.00' })
    await asAdmin(db)
  })
})
