import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Minus, Plus, Search, Trash2 } from 'lucide-react'
import { db } from '@/lib/supabase'
import { formatCOP } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { Product } from '@/types/domain'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { ErrorState, Skeleton } from '@/components/shared/states'
import { useMenu } from '@/features/menu/hooks/useMenu'
import { displayPrice } from '@/features/menu/services/catalog'
import { ProductDialog } from '@/features/menu/components/ProductDialog'
import type { CartLine } from '@/features/cart/CartContext'
import { Alert, Btn, Card, Input, Page, PageHeader, Select, Toggle, errMsg } from '../components/ui'
import { createOrder } from '../services/orders'

async function fetchOptions() {
  const [z, m] = await Promise.all([
    db().from('delivery_zone_neighborhoods').select('neighborhood, delivery_zones!inner(is_active)').eq('delivery_zones.is_active', true).order('neighborhood'),
    db().from('payment_methods').select('code, label').eq('is_active', true).order('sort_order'),
  ])
  if (z.error) throw z.error
  if (m.error) throw m.error
  return { hoods: (z.data as { neighborhood: string }[]).map((h) => h.neighborhood), methods: m.data as { code: string; label: string }[] }
}

export function ManualSalePage() {
  useDocumentTitle('Venta manual')
  const qc = useQueryClient()
  const menu = useMenu()
  const opts = useQuery({ queryKey: ['manual-sale-options'], queryFn: fetchOptions })
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Product | null>(null)
  const [lines, setLines] = useState<(Omit<CartLine, 'key'> & { key: string })[]>([])
  const [f, setF] = useState({ channel: 'counter' as 'counter' | 'phone' | 'whatsapp', fulfillment: 'dine_in' as 'dine_in' | 'pickup' | 'delivery',
    name: '', phone: '', address: '', neighborhood: '', method: '', cash: '', notes: '', confirm: true })
  const [key, setKey] = useState(() => crypto.randomUUID())
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ tone: 'error' | 'success'; text: string } | null>(null)

  const products = useMemo(() => (menu.data ?? []).flatMap((c) => c.products)
    .filter((p) => !search || p.name.toLowerCase().includes(search.toLowerCase())), [menu.data, search])
  const total = lines.reduce((s, l) => s + l.unit_price * l.quantity, 0)
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value })

  const submit = async () => {
    setBusy(true); setMsg(null)
    try {
      if (!lines.length) throw new Error('Agrega al menos un producto.')
      if (!f.method) throw new Error('Elige el método de pago.')
      const r = await createOrder({
        idempotency_key: key, channel: f.channel, fulfillment: f.fulfillment,
        customer: { name: f.name || undefined, phone: f.phone || undefined },
        address: f.fulfillment === 'delivery' ? { address: f.address, neighborhood: f.neighborhood } : undefined,
        payment_method: f.method, cash_change_for: f.method === 'cash' && f.cash ? Number(f.cash.replace(/\D/g, '')) : null, notes: f.notes,
        items: lines.map((l) => ({ product_id: l.product_id, variant_id: l.variant_id, quantity: l.quantity, options: l.options.map((o) => o.id), notes: l.notes })),
        confirm: f.confirm,
      })
      setMsg({ tone: 'success', text: `Pedido #${r.number} registrado por ${formatCOP(r.total)}${r.status === 'confirmed' ? ' y confirmado (inventario descontado).' : '.'}` })
      setLines([]); setKey(crypto.randomUUID()); setF((x) => ({ ...x, name: '', phone: '', address: '', neighborhood: '', cash: '', notes: '' }))
      qc.invalidateQueries({ queryKey: ['orders-board'] })
    } catch (e) { setMsg({ tone: 'error', text: errMsg(e) }) } finally { setBusy(false) }
  }

  return (
    <Page>
      <PageHeader title="Venta manual" subtitle="Pedidos por WhatsApp, teléfono o en el mostrador. Descuentan inventario igual que los del sitio." />
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-piedra" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar producto…" className="h-11 w-full rounded-lg border border-carbon/20 pl-9 pr-3 text-sm outline-none focus:border-carbon" />
          </label>
          {menu.error && <ErrorState error={menu.error} className="mt-4" />}
          {menu.isPending && <Skeleton className="mt-4 h-64" />}
          {menu.data && products.length === 0 && <p className="py-10 text-center text-sm text-piedra">No hay productos. Créalos en “Menú y productos”.</p>}
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {products.map((p) => (
              <button key={p.id} disabled={!p.is_available} onClick={() => setSelected(p)}
                className="rounded-lg border border-carbon/10 bg-white p-3 text-left text-sm transition-colors hover:border-carbon disabled:opacity-40">
                <p className="font-semibold leading-tight">{p.name}</p>
                <p className="price mt-1 text-piedra">{formatCOP(displayPrice(p).amount)}</p>
                {!p.is_available && <p className="text-xs text-alas">Agotado</p>}
              </button>
            ))}
          </div>
        </Card>

        <div className="space-y-4">
          <Card title="Pedido">
            {lines.length === 0 ? <p className="text-sm text-piedra">Toca un producto para agregarlo.</p> : (
              <ul className="divide-y divide-carbon/8 text-sm">
                {lines.map((l) => (
                  <li key={l.key} className="py-2">
                    <div className="flex justify-between gap-2"><span className="font-medium">{l.name}{l.variant_name ? ` · ${l.variant_name}` : ''}</span><span className="price">{formatCOP(l.unit_price * l.quantity)}</span></div>
                    {l.options.length > 0 && <p className="text-xs text-piedra">{l.options.map((o) => o.name).join(', ')}</p>}
                    <div className="mt-1 flex items-center gap-2">
                      <button className="grid size-7 place-items-center rounded border border-carbon/15" onClick={() => setLines((ls) => ls.map((x) => x.key === l.key ? { ...x, quantity: Math.max(1, x.quantity - 1) } : x))}><Minus className="size-3" /></button>
                      <span className="price w-6 text-center">{l.quantity}</span>
                      <button className="grid size-7 place-items-center rounded border border-carbon/15" onClick={() => setLines((ls) => ls.map((x) => x.key === l.key ? { ...x, quantity: Math.min(99, x.quantity + 1) } : x))}><Plus className="size-3" /></button>
                      <button className="ml-auto text-piedra hover:text-alas" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} aria-label="Quitar"><Trash2 className="size-4" /></button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 flex justify-between border-t border-carbon/10 pt-3 font-semibold"><span>Subtotal</span><span className="price">{formatCOP(total)}</span></p>
          </Card>

          <Card>
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <Select label="Canal" value={f.channel} onChange={set('channel')}><option value="counter">Mostrador</option><option value="whatsapp">WhatsApp</option><option value="phone">Teléfono</option></Select>
                <Select label="Entrega" value={f.fulfillment} onChange={set('fulfillment')}><option value="dine_in">En el local</option><option value="pickup">Recoge</option><option value="delivery">Domicilio</option></Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Cliente (opcional)" value={f.name} onChange={set('name')} />
                <Input label="Celular" type="tel" value={f.phone} onChange={set('phone')} />
              </div>
              {f.fulfillment === 'delivery' && (
                <>
                  <Select label="Barrio" value={f.neighborhood} onChange={set('neighborhood')}><option value="">Elige…</option>{opts.data?.hoods.map((h) => <option key={h}>{h}</option>)}</Select>
                  <Input label="Dirección" value={f.address} onChange={set('address')} />
                </>
              )}
              <Select label="Pago" value={f.method} onChange={set('method')}><option value="">Elige…</option>{opts.data?.methods.map((m) => <option key={m.code} value={m.code}>{m.label}</option>)}</Select>
              {opts.data && opts.data.methods.length === 0 && <Alert tone="info">Activa al menos un método de pago en Configuración.</Alert>}
              {f.method === 'cash' && <Input label="Paga con" inputMode="numeric" value={f.cash} onChange={set('cash')} />}
              <Input label="Nota" value={f.notes} onChange={set('notes')} />
              <Toggle checked={f.confirm} onChange={(v) => setF({ ...f, confirm: v })} label="Confirmar de una vez (descuenta inventario)" />
              {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
              <Btn variant="accent" className={cn('h-12 text-base')} disabled={busy || !lines.length} onClick={submit}>{busy ? 'Registrando…' : `Registrar venta · ${formatCOP(total)}`}</Btn>
            </div>
          </Card>
        </div>
      </div>
      <ProductDialog product={selected} onClose={() => setSelected(null)} onAdd={(l) => setLines((ls) => [...ls, { ...l, key: crypto.randomUUID() }])} />
    </Page>
  )
}
