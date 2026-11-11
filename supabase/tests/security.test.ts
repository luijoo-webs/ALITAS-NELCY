import { beforeAll, describe, expect, it } from 'vitest'
import { asAdmin, asAnon, asUser, createDb, createUser, grantRole, type Db } from './harness'

let db: Db
let owner: string, admin: string, kitchen: string, clientA: string, clientB: string

async function count(sql: string, params: unknown[] = []) {
  const { rows } = await db.query<{ n: number }>(`select count(*)::int as n from (${sql}) t`, params)
  return rows[0].n
}

beforeAll(async () => {
  db = await createDb()
  owner = await createUser(db, 'dueno@test.local')
  admin = await createUser(db, 'admin@test.local')
  kitchen = await createUser(db, 'cocina@test.local')
  clientA = await createUser(db, 'a@test.local', { meta: { full_name: 'Cliente A' } })
  clientB = await createUser(db, 'b@test.local', { meta: { full_name: 'Cliente B' } })

  await asAdmin(db)
  await db.query(`select public.bootstrap_superadmin('dueno@test.local')`)
  await grantRole(db, admin, 'admin')
  await grantRole(db, kitchen, 'kitchen')

  await db.exec(`
    insert into public.categories (id, name, slug) values
      ('00000000-0000-0000-0000-0000000000c1', 'Activa', 'activa');
    insert into public.categories (id, name, slug, is_active) values
      ('00000000-0000-0000-0000-0000000000c2', 'Oculta', 'oculta', false);
    insert into public.products (category_id, name, slug, base_price) values
      ('00000000-0000-0000-0000-0000000000c1', 'Visible', 'visible', 1000),
      ('00000000-0000-0000-0000-0000000000c2', 'En categoría oculta', 'en-oculta', 1000);
    insert into public.products (category_id, name, slug, base_price, is_archived) values
      ('00000000-0000-0000-0000-0000000000c1', 'Archivado', 'archivado', 1000, true);
  `)
})

describe('roles y permisos', () => {
  it('bootstrap no permite un segundo superadmin', async () => {
    await asAdmin(db)
    await expect(db.query(`select public.bootstrap_superadmin('admin@test.local')`)).rejects.toThrow(/Ya existe/)
  })

  it('anon y clientes no pueden ejecutar bootstrap_superadmin', async () => {
    await asUser(db, clientA)
    await expect(db.query(`select public.bootstrap_superadmin('a@test.local')`)).rejects.toThrow(/permission denied/)
  })

  it('permisos por rol', async () => {
    await asUser(db, kitchen)
    const k = (await db.query<{ c: string }>(`select public.my_permissions() as c`)).rows.map((r) => r.c)
    expect(k.sort()).toEqual(['orders.read', 'orders.update_status'])

    await asUser(db, admin)
    const a = (await db.query<{ c: string }>(`select public.my_permissions() as c`)).rows.map((r) => r.c)
    expect(a).toContain('catalog.manage')
    expect(a).not.toContain('users.manage')

    await asUser(db, owner)
    expect(await count(`select public.my_permissions()`)).toBe(
      await (async () => { await asAdmin(db); return count('select 1 from public.permissions') })(),
    )
  })

  it('un cliente no puede otorgarse roles', async () => {
    await asAdmin(db)
    const roleId = (await db.query<{ id: string }>(`select id from public.roles where code = 'admin'`)).rows[0].id
    await asUser(db, clientA)
    expect(await count(`select 1 from public.roles`)).toBe(0) // ni siquiera ve los roles
    await expect(
      db.query(`insert into public.user_roles (user_id, role_id) values ($1, $2)`, [clientA, roleId]),
    ).rejects.toThrow(/row-level security/)
  })

  it('quien gestiona usuarios sin ser superadmin no puede otorgar superadmin', async () => {
    await asAdmin(db)
    const manager = await createUser(db, 'rrhh@test.local')
    await db.exec(`insert into public.roles (code, name) values ('gestor', 'Gestor de usuarios')`)
    await db.exec(`insert into public.role_permissions select r.id, p.id from public.roles r, public.permissions p
                   where r.code = 'gestor' and p.code = 'users.manage'`)
    await grantRole(db, manager, 'gestor')

    await asUser(db, manager)
    await expect(
      db.query(`insert into public.user_roles (user_id, role_id) select $1, id from public.roles where code = 'superadmin'`, [manager]),
    ).rejects.toThrow(/superadministrador/)
    // Sí puede otorgar roles comunes
    await db.query(`insert into public.user_roles (user_id, role_id) select $1, id from public.roles where code = 'staff'`, [clientB])
    await asAdmin(db)
    await db.query(`delete from public.user_roles where user_id = $1`, [clientB])
  })

  it('no se puede quitar el último superadmin ni borrar roles de sistema', async () => {
    await asUser(db, owner)
    await expect(db.query(`delete from public.user_roles where user_id = $1`, [owner])).rejects.toThrow(/último/)
    await expect(db.query(`delete from public.roles where code = 'kitchen'`)).rejects.toThrow(/sistema/)
  })

  it('los cambios de roles quedan auditados', async () => {
    await asUser(db, owner)
    expect(await count(`select 1 from public.audit_logs where table_name = 'user_roles'`)).toBeGreaterThan(0)
    await asUser(db, admin)
    expect(await count(`select 1 from public.audit_logs`)).toBe(0) // admin no tiene audit.read
  })
})

describe('catálogo', () => {
  it('anon ve solo productos activos de categorías activas', async () => {
    await asAnon(db)
    const { rows } = await db.query<{ name: string }>(`select name from public.products`)
    expect(rows.map((r) => r.name)).toEqual(['Visible'])
    expect(await count(`select 1 from public.categories`)).toBe(1)
  })

  it('anon y cocina no pueden modificar el catálogo; admin sí', async () => {
    await asAnon(db)
    await expect(db.query(`update public.products set base_price = 1 returning id`)).resolves.toMatchObject({ rows: [] })
    await expect(
      db.query(`insert into public.categories (name, slug) values ('X', 'x')`),
    ).rejects.toThrow(/row-level security/)

    await asUser(db, kitchen)
    const r = await db.query(`update public.products set base_price = 1 returning id`)
    expect(r.rows).toHaveLength(0)

    await asUser(db, admin)
    const ok = await db.query(`update public.products set base_price = 2000 where slug = 'visible' returning id`)
    expect(ok.rows).toHaveLength(1)
    expect(await count(`select 1 from public.products`)).toBe(3) // admin ve también archivados
  })

  it('rechaza precios negativos y promociones inválidas', async () => {
    await asUser(db, admin)
    await expect(db.query(`update public.products set base_price = -1 where slug = 'visible'`)).rejects.toThrow(/check/)
    await expect(
      db.query(`insert into public.promotions (name, type, value) values ('Mala', 'percent', 150)`),
    ).rejects.toThrow(/check/)
  })
})

describe('clientes', () => {
  it('al confirmar el correo se crea el cliente vinculado', async () => {
    await asUser(db, clientA)
    const { rows } = await db.query<{ full_name: string; email_verified: boolean }>(
      `select full_name, email_verified from public.customers`,
    )
    expect(rows).toEqual([{ full_name: 'Cliente A', email_verified: true }])
  })

  it('un cliente no ve a otro cliente ni sus direcciones', async () => {
    await asUser(db, clientB)
    const b = (await db.query<{ id: string }>(`select id from public.customers`)).rows
    expect(b).toHaveLength(1)
    await db.query(`insert into public.customer_addresses (customer_id, address, neighborhood) values ($1, 'Calle 1 # 2-3', 'Centro')`, [b[0].id])

    await asUser(db, clientA)
    expect(await count(`select 1 from public.customer_addresses`)).toBe(0)
    await expect(
      db.query(`insert into public.customer_addresses (customer_id, address, neighborhood) values ($1, 'Calle 9 # 9-9', 'Centro')`, [b[0].id]),
    ).rejects.toThrow(/row-level security/)
  })

  it('un cliente no puede cambiar su user_id, email ni verificación', async () => {
    await asUser(db, clientA)
    await expect(db.query(`update public.customers set email = 'otro@test.local'`)).rejects.toThrow(/permission denied/)
    await expect(db.query(`update public.customers set user_id = $1`, [clientB])).rejects.toThrow(/permission denied/)
    const r = await db.query(`update public.customers set phone = '3001234567' returning id`)
    expect(r.rows).toHaveLength(1)
  })

  it('anon no puede leer clientes', async () => {
    await asAnon(db)
    await expect(db.query(`select * from public.customers`)).rejects.toThrow(/permission denied/)
  })

  it('pedidos de invitado: se vinculan solo después de verificar el correo', async () => {
    await asAdmin(db)
    await db.exec(`insert into public.customers (full_name, email) values ('Invitado', 'invitado@test.local')`)
    const uid = await createUser(db, 'invitado@test.local', { confirmed: false })

    await asUser(db, uid)
    expect(await count(`select 1 from public.customers`)).toBe(0) // sin verificar: nada

    await asAdmin(db)
    await db.query(`update auth.users set email_confirmed_at = now() where id = $1`, [uid])
    await asUser(db, uid)
    const { rows } = await db.query<{ full_name: string; email_verified: boolean }>(`select full_name, email_verified from public.customers`)
    expect(rows).toEqual([{ full_name: 'Invitado', email_verified: true }])
  })

  it('la zona de la dirección la calcula el servidor según el barrio', async () => {
    await asAdmin(db)
    await db.exec(`
      insert into public.delivery_zones (id, name, fee) values ('00000000-0000-0000-0000-00000000000a', 'Zona prueba', 3000);
      insert into public.delivery_zone_neighborhoods (zone_id, neighborhood) values ('00000000-0000-0000-0000-00000000000a', 'Los Fundadores');
    `)
    await asUser(db, clientA)
    const cid = (await db.query<{ id: string }>(`select id from public.customers`)).rows[0].id
    const { rows } = await db.query<{ delivery_zone_id: string | null }>(
      `insert into public.customer_addresses (customer_id, address, neighborhood, delivery_zone_id)
       values ($1, 'Trv 26 # 18D-02', '  los fundadores ', null) returning delivery_zone_id`,
      [cid],
    )
    expect(rows[0].delivery_zone_id).toBe('00000000-0000-0000-0000-00000000000a')
    // Intentar forzar otra zona no surte efecto
    const forced = await db.query<{ delivery_zone_id: string | null }>(
      `update public.customer_addresses set delivery_zone_id = null returning delivery_zone_id`,
    )
    expect(forced.rows[0].delivery_zone_id).toBe('00000000-0000-0000-0000-00000000000a')
  })
})

describe('configuración y horario', () => {
  it('anon lee la configuración pública pero no la privada', async () => {
    await asAnon(db)
    expect((await db.query<{ name: string }>(`select name from public.restaurant_settings`)).rows[0].name).toBe('Alitas Nelcy')
    expect(await count(`select 1 from public.restaurant_private_settings`)).toBe(0)
    expect(await count(`select 1 from public.payment_methods`)).toBe(0) // todos inactivos al inicio
  })

  it('no permite activar un método de pago en línea sin pasarela', async () => {
    await asUser(db, admin)
    await expect(
      db.query(`insert into public.payment_methods (code, label, is_online, is_active) values ('gw', 'Pasarela', true, true)`),
    ).rejects.toThrow(/check/)
  })

  it('is_open_now respeta horario, cierres y pausa (hora de Bogotá)', async () => {
    await asAdmin(db)
    // Miércoles 11/nov/2026. 12:00 Bogotá = 17:00 UTC
    const noon = '2026-11-11T17:00:00Z'
    const late = '2026-11-12T04:30:00Z' // 23:30 Bogotá
    const open = async (at: string) => (await db.query<{ o: boolean }>(`select public.is_open_now($1) as o`, [at])).rows[0].o

    expect(await open(noon)).toBe(false) // sin horario configurado → cerrado
    await db.exec(`insert into public.business_hours (weekday, opens_at, closes_at) values (3, '11:00', '22:00')`)
    expect(await open(noon)).toBe(true)
    expect(await open(late)).toBe(false)

    await db.exec(`update public.restaurant_settings set orders_paused = true`)
    expect(await open(noon)).toBe(false)
    await db.exec(`update public.restaurant_settings set orders_paused = false`)

    await db.exec(`insert into public.business_closures (closed_on, reason) values ('2026-11-11', 'Prueba')`)
    expect(await open(noon)).toBe(false)
  })
})
