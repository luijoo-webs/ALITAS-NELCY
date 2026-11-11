import { beforeAll, describe, expect, it } from 'vitest'
import { asAdmin, asAnon, asUser, createDb, createUser, grantRole, type Db } from './harness'

// Flujo completo con datos de PRUEBA (no son productos ni precios reales del restaurante).
let db: Db
let admin: string, kitchen: string, stock: string
const P = '00000000-0000-0000-0000-0000000000a1'
const VAR = '00000000-0000-0000-0000-0000000000b1'
const OPT1 = '00000000-0000-0000-0000-0000000000d1'
const OPT2 = '00000000-0000-0000-0000-0000000000d2'
const ING_POLLO = '00000000-0000-0000-0000-0000000000e1'
const ING_SALSA = '00000000-0000-0000-0000-0000000000e2'

const q1 = async <T = any>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows[0]
// Lee como dueño de la base y deja la sesión así: cada paso vuelve a fijar su rol.
const stockOf = async (id: string) => { await asAdmin(db); return Number((await q1<{ s: string }>(`select stock_qty s from public.ingredients where id = $1`, [id])).s) }
const order = (extra: object = {}) => ({
  idempotency_key: `test-${Math.random().toString(36).slice(2)}`,
  channel: 'web', fulfillment: 'delivery',
  customer: { name: 'Cliente Prueba', phone: '3001234567', email: 'prueba@test.local' },
  address: { address: 'Calle 1 # 2-3', neighborhood: 'Barrio Prueba' },
  payment_method: 'cash',
  items: [{ product_id: P, variant_id: VAR, quantity: 2, options: [OPT1], unit_price: 1 }],
  ...extra,
})
const create = async (p: object) => (await q1<{ r: any }>(`select public.create_order($1::jsonb) r`, [JSON.stringify(p)])).r

beforeAll(async () => {
  db = await createDb()
  admin = await createUser(db, 'admin@test.local')
  kitchen = await createUser(db, 'cocina@test.local')
  stock = await createUser(db, 'bodega@test.local')
  await grantRole(db, admin, 'admin')
  await grantRole(db, kitchen, 'kitchen')
  await grantRole(db, stock, 'inventory')
  await asAdmin(db)
  await db.exec(`
    insert into public.business_hours (weekday, opens_at, closes_at) select d, '00:00', '23:59:59' from generate_series(0, 6) d;
    update public.payment_methods set is_active = true where code = 'cash';
    insert into public.delivery_zones (id, name, fee, min_order, free_from) values ('00000000-0000-0000-0000-0000000000f1', 'Zona prueba', 3000, 10000, 100000);
    insert into public.delivery_zone_neighborhoods (zone_id, neighborhood) values ('00000000-0000-0000-0000-0000000000f1', 'Barrio Prueba');
    insert into public.categories (id, name, slug) values ('00000000-0000-0000-0000-0000000000c1', 'Cat', 'cat');
    insert into public.products (id, category_id, name, slug, base_price, availability_mode) values ('${P}', '00000000-0000-0000-0000-0000000000c1', 'Producto prueba', 'producto-prueba', 10000, 'auto_by_stock');
    insert into public.product_variants (id, product_id, name, price, is_default) values ('${VAR}', '${P}', 'Grande', 20000, true);
    insert into public.modifier_groups (id, name, min_select, max_select) values ('00000000-0000-0000-0000-0000000000d0', 'Salsa', 1, 1);
    insert into public.modifier_options (id, group_id, name, price_delta) values ('${OPT1}', '00000000-0000-0000-0000-0000000000d0', 'Salsa A', 0), ('${OPT2}', '00000000-0000-0000-0000-0000000000d0', 'Salsa B', 1000);
    insert into public.product_modifier_groups (product_id, group_id) values ('${P}', '00000000-0000-0000-0000-0000000000d0');
    insert into public.ingredients (id, name, base_unit, min_stock, is_critical) values ('${ING_POLLO}', 'Pollo prueba', 'g', 500, true), ('${ING_SALSA}', 'Salsa prueba', 'ml', 0, false);
    insert into public.recipe_items (variant_id, ingredient_id, quantity) values ('${VAR}', '${ING_POLLO}', 300);
    insert into public.recipe_items (modifier_option_id, ingredient_id, quantity) values ('${OPT1}', '${ING_SALSA}', 50);
  `)
})

describe('compras e inventario', () => {
  it('cocina no puede registrar compras', async () => {
    await asUser(db, kitchen)
    await expect(db.query(`select public.register_purchase(null, 'F1', $1::jsonb)`, [JSON.stringify([{ ingredient_id: ING_POLLO, quantity: 1, unit: 'kg', line_total: 20000 }])])).rejects.toThrow(/permiso/)
  })

  it('una compra en kg suma en gramos y calcula el costo promedio ponderado', async () => {
    await asUser(db, stock)
    await db.query(`select public.register_purchase(null, 'F1', $1::jsonb)`, [JSON.stringify([
      { ingredient_id: ING_POLLO, quantity: 2, unit: 'kg', line_total: 40000 },  // 20 $/g
      { ingredient_id: ING_SALSA, quantity: 1, unit: 'l', line_total: 10000 },
    ])])
    await db.query(`select public.register_purchase(null, 'F2', $1::jsonb)`, [JSON.stringify([{ ingredient_id: ING_POLLO, quantity: 2000, unit: 'g', line_total: 60000 }])]) // 30 $/g
    expect(await stockOf(ING_POLLO)).toBe(4000)
    expect(Number((await q1(`select avg_cost from public.ingredients where id = $1`, [ING_POLLO])).avg_cost)).toBe(25)
  })

  it('rechaza unidades incompatibles (masa vs volumen)', async () => {
    await asUser(db, stock)
    await expect(db.query(`select public.register_purchase(null, null, $1::jsonb)`, [JSON.stringify([{ ingredient_id: ING_POLLO, quantity: 1, unit: 'l', line_total: 1 }])])).rejects.toThrow(/no compatible/)
  })

  it('el navegador no puede tocar el stock directamente', async () => {
    await asUser(db, admin)
    await expect(db.query(`update public.ingredients set stock_qty = 999999 where id = $1`, [ING_POLLO])).rejects.toThrow()
  })
})

describe('pedido web de principio a fin', () => {
  let first: any

  it('el servidor recalcula el total e ignora precios del navegador', async () => {
    await asAnon(db)
    first = await create(order())
    expect(Number(first.total)).toBe(2 * 20000 + 3000)
    expect(first.status).toBe('new')
  })

  it('reintentar con la misma clave devuelve el mismo pedido (doble clic)', async () => {
    await asAnon(db)
    const key = 'misma-clave-123'
    const a = await create(order({ idempotency_key: key }))
    const b = await create(order({ idempotency_key: key }))
    expect(b.id).toBe(a.id)
    expect(b.repeated).toBe(true)
  })

  it('rechaza barrio sin cobertura, opción obligatoria faltante y pedido mínimo', async () => {
    await asAnon(db)
    await expect(create(order({ address: { address: 'X 1', neighborhood: 'Otro barrio' } }))).rejects.toThrow(/Aún no llegamos/)
    await expect(create(order({ items: [{ product_id: P, quantity: 1, options: [] }] }))).rejects.toThrow(/Salsa/)
    await expect(create(order({ items: [{ product_id: P, quantity: 1, options: [OPT1, OPT2] }] }))).rejects.toThrow(/Salsa/)
    await asAdmin(db)
    await db.exec(`update public.delivery_zones set min_order = 50000`)
    await asAnon(db)
    await expect(create(order())).rejects.toThrow(/mínimo/)
    await asAdmin(db)
    await db.exec(`update public.delivery_zones set min_order = 10000`)
  })

  it('un anónimo no puede registrar ventas manuales', async () => {
    await asAnon(db)
    await expect(create(order({ channel: 'counter', fulfillment: 'pickup' }))).rejects.toThrow(/permiso/)
  })

  it('con el local cerrado no se aceptan pedidos web', async () => {
    await asAdmin(db)
    await db.exec(`update public.restaurant_settings set orders_paused = true`)
    await asAnon(db)
    await expect(create(order())).rejects.toThrow(/no estamos recibiendo/)
    await asAdmin(db)
    await db.exec(`update public.restaurant_settings set orders_paused = false`)
  })

  it('confirmar descuenta receta de la variante + salsa, una sola vez', async () => {
    const before = await stockOf(ING_POLLO)
    await asUser(db, kitchen)
    await db.query(`select public.set_order_status($1, 'confirmed')`, [first.id])
    await db.query(`select public.set_order_status($1, 'preparing')`, [first.id])
    expect(await stockOf(ING_POLLO)).toBe(before - 600)
    expect(await stockOf(ING_SALSA)).toBe(1000 - 100)
    await asUser(db, kitchen)
    await db.query(`select public.set_order_status($1, 'confirmed')`, [first.id]).catch(() => {}) // retroceso inválido
    expect(await stockOf(ING_POLLO)).toBe(before - 600)
  })

  it('no permite saltos inválidos de estado', async () => {
    await asAnon(db)
    const o = await create(order())
    await asUser(db, kitchen)
    await expect(db.query(`select public.set_order_status($1, 'delivered')`, [o.id])).rejects.toThrow(/No se puede pasar/)
  })

  it('cancelar un pedido confirmado reintegra el inventario; cocina no puede cancelar', async () => {
    await asAnon(db)
    const o = await create(order())
    await asUser(db, kitchen)
    await db.query(`select public.set_order_status($1, 'confirmed')`, [o.id])
    const after = await stockOf(ING_POLLO)
    await asUser(db, kitchen)
    await expect(db.query(`select public.set_order_status($1, 'cancelled')`, [o.id])).rejects.toThrow(/permiso/)
    await asUser(db, admin)
    await db.query(`select public.set_order_status($1, 'cancelled', true, 'Cliente desistió')`, [o.id])
    expect(await stockOf(ING_POLLO)).toBe(after + 600)
  })

  it('el seguimiento público no expone teléfono ni dirección', async () => {
    await asAnon(db)
    const t = (await q1(`select public.get_order_by_token($1) t`, [first.token])).t
    expect(t.status).toBe('preparing')
    expect(JSON.stringify(t)).not.toMatch(/3001234567|Calle 1/)
  })

  it('un insumo crítico en cero apaga el producto auto_by_stock y vuelve con la compra', async () => {
    await asUser(db, stock)
    await db.query(`select public.adjust_stock($1, 'count', 0, 'Conteo físico')`, [ING_POLLO])
    expect((await q1(`select is_available from public.products where id = $1`, [P])).is_available).toBe(false)
    expect((await q1(`select count(*)::int n from public.inventory_alerts where ingredient_id = $1 and status = 'open'`, [ING_POLLO])).n).toBe(1)
    await asAnon(db)
    await expect(create(order())).rejects.toThrow(/agotado/)
    await asUser(db, stock)
    await db.query(`select public.register_purchase(null, null, $1::jsonb)`, [JSON.stringify([{ ingredient_id: ING_POLLO, quantity: 1, unit: 'kg', line_total: 25000 }])])
    expect((await q1(`select is_available from public.products where id = $1`, [P])).is_available).toBe(true)
    expect((await q1(`select count(*)::int n from public.inventory_alerts where ingredient_id = $1 and status = 'open'`, [ING_POLLO])).n).toBe(0)
  })

  it('el reporte cuenta ventas entregadas y su costo de insumos', async () => {
    await asUser(db, kitchen)
    await db.query(`select public.set_order_status($1, 'ready')`, [first.id])
    await db.query(`select public.set_order_status($1, 'out_for_delivery')`, [first.id])
    await db.query(`select public.set_order_status($1, 'delivered')`, [first.id])
    await asUser(db, admin)
    const r = (await q1(`select public.sales_report(now() - interval '1 day', now() + interval '1 day') r`)).r
    expect(Number(r.gross_sales)).toBe(43000)
    expect(Number(r.cogs)).toBeGreaterThan(0)
    await asUser(db, kitchen)
    await expect(db.query(`select public.sales_report(now() - interval '1 day', now())`)).rejects.toThrow(/permiso/)
  })

  it('venta manual del personal con confirmación inmediata descuenta inventario', async () => {
    const before = await stockOf(ING_POLLO)
    await asUser(db, admin)
    const r = await create(order({ channel: 'counter', fulfillment: 'dine_in', customer: {}, address: {}, confirm: true }))
    expect(r.status).toBe('confirmed')
    expect(await stockOf(ING_POLLO)).toBe(before - 600)
  })
})

describe('primer superadmin', () => {
  it('el primer correo autorizado que confirma su cuenta recibe superadmin; el segundo no', async () => {
    await asAdmin(db)
    await db.exec(`insert into public.bootstrap_emails values ('dueno@test.local'), ('otro@test.local')`)
    const u1 = await createUser(db, 'dueno@test.local', { confirmed: false })
    await db.query(`update auth.users set email_confirmed_at = now() where id = $1`, [u1])
    const u2 = await createUser(db, 'otro@test.local')
    const roles = async (u: string) => (await db.query(`select r.code from public.user_roles ur join public.roles r on r.id = ur.role_id where ur.user_id = $1`, [u])).rows
    expect(await roles(u1)).toEqual([{ code: 'superadmin' }])
    expect(await roles(u2)).toEqual([])
  })
})
