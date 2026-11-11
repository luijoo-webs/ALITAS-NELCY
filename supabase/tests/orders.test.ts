import { beforeAll, describe, expect, it } from 'vitest'
import { asAdmin, asAnon, asUser, createDb, createUser, grantRole, type Db } from './harness'

// Pedidos de prueba insertados como dueño de la base (en la Fase 5 los crea create_order).
let db: Db
let admin: string, kitchen: string, clientA: string, clientB: string
const FROM = '2026-11-01T05:00:00Z' // 1 nov 00:00 en Bogotá
const TO = '2026-11-08T05:00:00Z'

async function summary(from = FROM, to = TO) {
  const { rows } = await db.query<{ s: Record<string, any> }>(`select public.dashboard_summary($1, $2) as s`, [from, to])
  return rows[0].s
}

beforeAll(async () => {
  db = await createDb()
  admin = await createUser(db, 'admin@test.local')
  kitchen = await createUser(db, 'cocina@test.local')
  clientA = await createUser(db, 'a@test.local', { meta: { full_name: 'Cliente A' } })
  clientB = await createUser(db, 'b@test.local', { meta: { full_name: 'Cliente B' } })
  await grantRole(db, admin, 'admin')
  await grantRole(db, kitchen, 'kitchen')
})

describe('dashboard', () => {
  it('sin pedidos devuelve ceros y listas vacías, sin errores', async () => {
    await asUser(db, admin)
    const s = await summary()
    expect(s).toMatchObject({ sales: 0, orders_count: 0, delivered_count: 0, avg_ticket: 0, by_day: [], top_products: [], open_by_status: [] })
  })

  it('solo el personal con dashboard.read puede consultarlo', async () => {
    await asUser(db, clientA)
    await expect(summary()).rejects.toThrow(/permiso/)
    await asAnon(db)
    await expect(summary()).rejects.toThrow()
  })

  it('rechaza rangos inválidos', async () => {
    await asUser(db, admin)
    await expect(summary(TO, FROM)).rejects.toThrow(/Rango/)
  })

  it('cuenta ventas solo de pedidos entregados y agrupa por día de Bogotá', async () => {
    await asAdmin(db)
    const cA = (await db.query<{ id: string }>(`select id from public.customers where user_id = $1`, [clientA])).rows[0].id
    await db.query(
      `insert into public.orders (customer_id, channel, fulfillment, status, subtotal, total, created_at) values
        ($1, 'web',     'pickup', 'delivered', 30000, 30000, '2026-11-02T01:00:00Z'), -- 1 nov 20:00 Bogotá
        ($1, 'counter', 'pickup', 'delivered', 20000, 20000, '2026-11-02T18:00:00Z'),
        (null, 'phone', 'pickup', 'cancelled', 15000, 15000, '2026-11-03T18:00:00Z'),
        (null, 'web',   'pickup', 'preparing', 12000, 12000, '2026-11-03T19:00:00Z'),
        (null, 'web',   'pickup', 'delivered', 99000, 99000, '2026-10-20T18:00:00Z')  -- fuera del rango`,
      [cA],
    )
    await db.exec(`
      insert into public.order_items (order_id, name_snapshot, unit_price, quantity, line_total)
      select id, 'Combo 1', 10000, 3, 30000 from public.orders where total = 30000;
      insert into public.order_items (order_id, name_snapshot, unit_price, quantity, line_total)
      select id, 'Almuerzo', 10000, 2, 20000 from public.orders where total = 20000;
    `)

    await asUser(db, admin)
    const s = await summary()
    expect(Number(s.sales)).toBe(50000)
    expect(s.delivered_count).toBe(2)
    expect(s.orders_count).toBe(3) // excluye el cancelado
    expect(s.cancelled_count).toBe(1)
    expect(Number(s.avg_ticket)).toBe(25000)
    expect(s.by_day.map((d: any) => d.day)).toEqual(['2026-11-01', '2026-11-02'])
    expect(s.top_products[0]).toMatchObject({ name: 'Combo 1', quantity: 3 })
    expect(s.open_by_status).toEqual([{ code: 'preparing', label: 'En preparación', count: 1 }])
  })
})

describe('pedidos (RLS)', () => {
  it('un cliente ve solo sus pedidos; otro cliente no ve nada', async () => {
    await asUser(db, clientA)
    expect((await db.query(`select id from public.orders`)).rows).toHaveLength(2)
    expect((await db.query(`select id from public.order_items`)).rows).toHaveLength(2)
    await asUser(db, clientB)
    expect((await db.query(`select id from public.orders`)).rows).toHaveLength(0)
    expect((await db.query(`select id from public.order_items`)).rows).toHaveLength(0)
  })

  it('anónimo no ve pedidos', async () => {
    await asAnon(db)
    expect((await db.query(`select id from public.orders`)).rows).toHaveLength(0)
  })

  it('nadie escribe pedidos directamente desde el cliente, ni siquiera el personal', async () => {
    await asUser(db, admin)
    await expect(db.query(`insert into public.orders (channel, fulfillment) values ('web','pickup')`)).rejects.toThrow()
    await expect(db.query(`update public.orders set total = 1`)).rejects.toThrow()
    await asUser(db, clientA)
    await expect(db.query(`update public.orders set status = 'delivered'`)).rejects.toThrow()
  })

  it('el personal con orders.read ve todos los pedidos', async () => {
    await asUser(db, kitchen)
    expect((await db.query(`select id from public.orders`)).rows.length).toBe(5)
  })
})
