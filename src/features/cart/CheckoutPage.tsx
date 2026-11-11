import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Bike, Store } from 'lucide-react'
import { db } from '@/lib/supabase'
import { formatCOP } from '@/lib/format'
import { cn } from '@/lib/cn'
import { Button, ButtonLink } from '@/components/ui/button'
import { FormAlert } from '@/components/ui/field'
import { ErrorState, Skeleton } from '@/components/shared/states'
import { useAuth } from '@/contexts/AuthContext'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useIsOpen, useSettings } from '@/features/site/hooks/useRestaurant'
import { fetchMyCustomer } from '@/features/auth/services/auth'
import { createOrder } from '@/features/admin/services/orders'
import { useCart } from './CartContext'

interface Zone { id: string; name: string; fee: number; min_order: number; free_from: number | null; eta_minutes: number | null; delivery_zone_neighborhoods: { neighborhood: string }[] }
interface Method { code: string; label: string; instructions: string | null; available_for: 'delivery' | 'pickup' | 'both' }

async function fetchCheckoutData() {
  const [z, m] = await Promise.all([
    db().from('delivery_zones').select('id, name, fee, min_order, free_from, eta_minutes, delivery_zone_neighborhoods ( neighborhood )').eq('is_active', true).order('sort_order'),
    db().from('payment_methods').select('code, label, instructions, available_for').eq('is_active', true).order('sort_order'),
  ])
  if (z.error) throw z.error
  if (m.error) throw m.error
  return { zones: z.data as unknown as Zone[], methods: m.data as Method[] }
}

const newKey = () => crypto.randomUUID()

export function CheckoutPage() {
  useDocumentTitle('Finalizar pedido')
  const navigate = useNavigate()
  const { user } = useAuth()
  const cart = useCart()
  const { data: settings } = useSettings()
  const isOpen = useIsOpen()
  const data = useQuery({ queryKey: ['checkout-data'], queryFn: fetchCheckoutData })
  const me = useQuery({ queryKey: ['my-customer', user?.id], queryFn: fetchMyCustomer, enabled: Boolean(user) })

  const [fulfillment, setFulfillment] = useState<'delivery' | 'pickup'>('delivery')
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '', neighborhood: '', reference: '', notes: '', cash: '' })
  const [method, setMethod] = useState('')
  const [key] = useState(newKey) // idempotencia: la misma durante todo el checkout
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (me.data) setForm((f) => ({ ...f, name: f.name || me.data!.full_name, phone: f.phone || (me.data!.phone ?? ''), email: f.email || (me.data!.email ?? user?.email ?? '') }))
  }, [me.data, user?.email])

  const hoods = useMemo(() => (data.data?.zones ?? []).flatMap((z) => z.delivery_zone_neighborhoods.map((n) => ({ name: n.neighborhood, zone: z })))
    .sort((a, b) => a.name.localeCompare(b.name, 'es')), [data.data])
  const zone = hoods.find((h) => h.name === form.neighborhood)?.zone
  const methods = (data.data?.methods ?? []).filter((m) => m.available_for === 'both' || m.available_for === fulfillment)
  const fee = fulfillment === 'delivery' && zone ? (zone.free_from && cart.subtotal >= zone.free_from ? 0 : Number(zone.fee)) : 0
  const belowMin = fulfillment === 'delivery' && zone && cart.subtotal < Number(zone.min_order)
  const deliveryAvailable = hoods.length > 0
  useEffect(() => { if (!deliveryAvailable && data.data) setFulfillment('pickup') }, [deliveryAvailable, data.data])
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }))

  if (cart.lines.length === 0) {
    return (
      <section className="grid min-h-[70svh] place-items-center bg-hueso px-4 pt-20 text-center">
        <div>
          <h1 className="h2">Tu carrito está vacío</h1>
          <ButtonLink to="/menu" className="mt-6">Ver el menú</ButtonLink>
        </div>
      </section>
    )
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!method) return setError('Elige un método de pago.')
    setSending(true)
    try {
      const r = await createOrder({
        idempotency_key: key, channel: 'web', fulfillment,
        customer: { name: form.name, phone: form.phone, email: form.email },
        address: fulfillment === 'delivery' ? { address: form.address, neighborhood: form.neighborhood, reference: form.reference } : undefined,
        payment_method: method, cash_change_for: method === 'cash' && form.cash ? Number(form.cash.replace(/\D/g, '')) : null,
        notes: form.notes,
        items: cart.lines.map((l) => ({ product_id: l.product_id, variant_id: l.variant_id, quantity: l.quantity, options: l.options.map((o) => o.id), notes: l.notes })),
      })
      cart.clear()
      navigate(`/pedido/${r.token}`, { replace: true })
    } catch (err) {
      setError((err as { message?: string }).message ?? 'No pudimos registrar el pedido. Inténtalo de nuevo.')
    } finally {
      setSending(false)
    }
  }

  const input = 'h-12 w-full rounded-[10px] border-2 border-carbon/20 bg-white px-3 outline-none focus:border-carbon'
  return (
    <section className="bg-hueso pb-20 pt-24 md:pt-32">
      <div className="container-page">
        <h1 className="h1">Finalizar pedido</h1>
        {data.error && <ErrorState error={data.error} className="mt-6" />}
        {data.isPending && <Skeleton className="mt-6 h-96" />}
        {data.data && (
          <form onSubmit={submit} className="mt-8 grid gap-8 lg:grid-cols-[1.4fr_1fr]" noValidate>
            <div className="space-y-8">
              {isOpen.data === false && (
                <FormAlert>{settings?.orders_paused ? settings.paused_message || 'Por ahora no estamos recibiendo pedidos.' : 'En este momento estamos cerrados. Revisa nuestro horario.'}</FormAlert>
              )}
              <fieldset>
                <legend className="font-display text-2xl font-black uppercase">1. ¿Cómo lo quieres?</legend>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  {([['delivery', 'Domicilio', Bike], ['pickup', 'Recoger en el local', Store]] as const).map(([v, label, Icon]) => (
                    <button key={v} type="button" disabled={v === 'delivery' && !deliveryAvailable} onClick={() => setFulfillment(v)}
                      className={cn('flex flex-col items-center gap-2 rounded-xl border-2 p-4 font-semibold disabled:opacity-40', fulfillment === v ? 'border-carbon bg-white shadow-[var(--shadow-hard)]' : 'border-carbon/15')}>
                      <Icon className="size-6" /> {label}
                    </button>
                  ))}
                </div>
                {!deliveryAvailable && <p className="mt-2 text-sm text-piedra">Los domicilios aún no están habilitados en línea.</p>}
                {fulfillment === 'pickup' && settings?.address && <p className="mt-3 text-sm text-piedra">Recoges en {settings.address}, {settings.neighborhood}.</p>}
              </fieldset>

              <fieldset className="grid gap-4 sm:grid-cols-2">
                <legend className="mb-3 font-display text-2xl font-black uppercase">2. Tus datos</legend>
                <label className="sm:col-span-2"><span className="mb-1 block text-sm font-medium">Nombre</span><input required autoComplete="name" className={input} value={form.name} onChange={set('name')} /></label>
                <label><span className="mb-1 block text-sm font-medium">Celular</span><input required type="tel" autoComplete="tel" className={input} value={form.phone} onChange={set('phone')} /></label>
                <label><span className="mb-1 block text-sm font-medium">Correo (para el seguimiento)</span><input required type="email" autoComplete="email" className={input} value={form.email} onChange={set('email')} /></label>
                {fulfillment === 'delivery' && (
                  <>
                    <label className="sm:col-span-2"><span className="mb-1 block text-sm font-medium">Barrio</span>
                      <select required className={input} value={form.neighborhood} onChange={set('neighborhood')}>
                        <option value="">Elige tu barrio</option>
                        {hoods.map((h) => <option key={h.name} value={h.name}>{h.name}</option>)}
                      </select>
                      <span className="mt-1 block text-xs text-piedra">¿No aparece tu barrio? Aún no llegamos ahí: puedes recoger en el local.</span>
                    </label>
                    <label className="sm:col-span-2"><span className="mb-1 block text-sm font-medium">Dirección</span><input required autoComplete="street-address" className={input} value={form.address} onChange={set('address')} /></label>
                    <label className="sm:col-span-2"><span className="mb-1 block text-sm font-medium">Referencia (opcional)</span><input className={input} placeholder="Casa esquinera, portón negro…" value={form.reference} onChange={set('reference')} /></label>
                  </>
                )}
              </fieldset>

              <fieldset>
                <legend className="font-display text-2xl font-black uppercase">3. Pago</legend>
                {methods.length === 0 ? (
                  <p className="mt-3 text-sm text-piedra">El restaurante aún no ha habilitado métodos de pago en línea.</p>
                ) : (
                  <div className="mt-3 grid gap-2">
                    {methods.map((m) => (
                      <label key={m.code} className={cn('flex cursor-pointer items-start gap-3 rounded-xl border-2 p-4', method === m.code ? 'border-carbon bg-white' : 'border-carbon/15')}>
                        <input type="radio" name="pm" className="mt-1 accent-[var(--color-alas)]" checked={method === m.code} onChange={() => setMethod(m.code)} />
                        <span><span className="font-semibold">{m.label}</span>{m.instructions && <span className="mt-0.5 block text-sm text-piedra">{m.instructions}</span>}</span>
                      </label>
                    ))}
                  </div>
                )}
                {method === 'cash' && (
                  <label className="mt-3 block"><span className="mb-1 block text-sm font-medium">¿Con cuánto pagas? (opcional, para llevar el cambio)</span>
                    <input inputMode="numeric" className={input} value={form.cash} onChange={set('cash')} /></label>
                )}
                <label className="mt-4 block"><span className="mb-1 block text-sm font-medium">Nota para el restaurante (opcional)</span>
                  <textarea rows={2} className="w-full rounded-[10px] border-2 border-carbon/20 bg-white p-3 outline-none focus:border-carbon" value={form.notes} onChange={set('notes')} maxLength={500} /></label>
              </fieldset>
            </div>

            <aside className="h-fit rounded-2xl border-2 border-carbon bg-white p-6 shadow-[var(--shadow-hard)] lg:sticky lg:top-28">
              <h2 className="font-display text-2xl font-black uppercase">Resumen</h2>
              <ul className="mt-4 divide-y divide-carbon/10 text-sm">
                {cart.lines.map((l) => (
                  <li key={l.key} className="flex justify-between gap-3 py-2">
                    <span>{l.quantity} × {l.name}{l.variant_name ? ` · ${l.variant_name}` : ''}{l.options.length > 0 && <span className="block text-piedra">{l.options.map((o) => o.name).join(', ')}</span>}</span>
                    <span className="price shrink-0">{formatCOP(l.unit_price * l.quantity)}</span>
                  </li>
                ))}
              </ul>
              <dl className="mt-3 space-y-1 border-t border-carbon/10 pt-3 text-sm">
                <div className="flex justify-between"><dt>Subtotal</dt><dd className="price">{formatCOP(cart.subtotal)}</dd></div>
                {fulfillment === 'delivery' && <div className="flex justify-between"><dt>Domicilio{zone?.eta_minutes ? ` (~${zone.eta_minutes} min)` : ''}</dt><dd className="price">{zone ? formatCOP(fee) : 'Elige tu barrio'}</dd></div>}
                <div className="flex justify-between pt-2 text-lg font-semibold"><dt>Total estimado</dt><dd className="price">{formatCOP(cart.subtotal + fee)}</dd></div>
              </dl>
              <p className="mt-1 text-xs text-piedra">El total final lo confirma el sistema al enviar (incluye promociones vigentes).</p>
              {belowMin && <p className="mt-3 text-sm font-medium text-alas">El pedido mínimo para tu zona es {formatCOP(zone!.min_order)}.</p>}
              {error && <div className="mt-4"><FormAlert>{error}</FormAlert></div>}
              <Button type="submit" size="lg" className="mt-5 w-full" disabled={sending || isOpen.data === false || methods.length === 0 || Boolean(belowMin)}>
                {sending ? 'Enviando…' : 'Confirmar pedido'}
              </Button>
            </aside>
          </form>
        )}
      </div>
    </section>
  )
}
