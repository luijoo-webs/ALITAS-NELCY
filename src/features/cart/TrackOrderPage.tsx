import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, Circle, MessageCircle, XCircle } from 'lucide-react'
import { db } from '@/lib/supabase'
import { formatCOP, whatsappLink } from '@/lib/format'
import { cn } from '@/lib/cn'
import { buttonClass } from '@/components/ui/button'
import { ErrorState, Skeleton } from '@/components/shared/states'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useSettings } from '@/features/site/hooks/useRestaurant'

interface Tracked {
  number: number; status: string; status_label: string; kind: string; fulfillment: 'delivery' | 'pickup' | 'dine_in'; created_at: string
  subtotal: number; delivery_fee: number; discount: number; total: number
  payment_method: string | null; payment_instructions: string | null; payment_status: string
  items: { name: string; quantity: number; line_total: number; options: string[] }[]
  history: { status: string; at: string }[]
}

async function fetchTracked(token: string): Promise<Tracked | null> {
  const { data, error } = await db().rpc('get_order_by_token', { p_token: token })
  if (error) throw error
  return data
}

export function TrackOrderPage() {
  const { token = '' } = useParams()
  const { data: settings } = useSettings()
  const q = useQuery({
    queryKey: ['track', token], queryFn: () => fetchTracked(token), enabled: /^[0-9a-f-]{36}$/i.test(token),
    refetchInterval: (query) => (['delivered', 'cancelled'].includes(query.state.data?.kind ?? '') ? false : 15_000),
  })
  const o = q.data
  useDocumentTitle(o ? `Pedido #${o.number}` : 'Seguimiento')

  const steps = [
    { kind: 'new', label: 'Recibido' },
    { kind: 'confirmed', label: 'Confirmado' },
    { kind: 'in_progress', label: 'En preparación' },
    { kind: 'ready', label: o?.fulfillment === 'pickup' ? 'Listo para recoger' : 'Listo' },
    ...(o?.fulfillment === 'delivery' ? [{ kind: 'out_for_delivery', label: 'En camino' }] : []),
    { kind: 'delivered', label: 'Entregado' },
  ]
  const at = steps.findIndex((s) => s.kind === o?.kind)

  return (
    <section className="bg-hueso pb-20 pt-24 md:pt-32">
      <div className="container-page max-w-2xl">
        {q.error && <ErrorState error={q.error} />}
        {(q.isPending && q.fetchStatus !== 'idle') && <Skeleton className="h-96" />}
        {(q.data === null || (!q.isPending && !q.data && !q.error)) && <p className="py-20 text-center text-lg">No encontramos este pedido.</p>}
        {o && (
          <>
            <p className="kicker text-alas">¡Gracias por tu pedido!</p>
            <h1 className="h1 mt-2">Pedido #{o.number}</h1>
            <p className="mt-2 text-piedra">Esta página se actualiza sola. Guárdala para seguir tu pedido.</p>

            {o.kind === 'cancelled' ? (
              <div className="mt-8 flex items-center gap-3 rounded-xl bg-alas/10 p-5 font-semibold text-alas-700"><XCircle /> Este pedido fue cancelado.</div>
            ) : (
              <ol className="mt-8 space-y-0">
                {steps.map((s, i) => (
                  <li key={s.kind} className="flex items-center gap-3 py-2">
                    {i <= at ? <CheckCircle2 className="size-6 text-alas" /> : <Circle className="size-6 text-carbon/20" />}
                    <span className={cn('font-display text-xl font-extrabold uppercase', i > at && 'text-carbon/35', i === at && 'text-carbon')}>{s.label}</span>
                  </li>
                ))}
              </ol>
            )}

            <div className="mt-8 rounded-2xl border-2 border-carbon bg-white p-6 shadow-[var(--shadow-hard)]">
              <ul className="divide-y divide-carbon/10 text-sm">
                {o.items.map((i, k) => (
                  <li key={k} className="flex justify-between gap-3 py-2">
                    <span>{i.quantity} × {i.name}{i.options.length > 0 && <span className="block text-piedra">{i.options.join(', ')}</span>}</span>
                    <span className="price">{formatCOP(i.line_total)}</span>
                  </li>
                ))}
              </ul>
              <dl className="mt-3 space-y-1 border-t border-carbon/10 pt-3 text-sm">
                <div className="flex justify-between"><dt>Subtotal</dt><dd className="price">{formatCOP(o.subtotal)}</dd></div>
                {Number(o.discount) > 0 && <div className="flex justify-between"><dt>Descuento</dt><dd className="price">−{formatCOP(o.discount)}</dd></div>}
                {o.fulfillment === 'delivery' && <div className="flex justify-between"><dt>Domicilio</dt><dd className="price">{formatCOP(o.delivery_fee)}</dd></div>}
                <div className="flex justify-between pt-1 text-lg font-semibold"><dt>Total</dt><dd className="price">{formatCOP(o.total)}</dd></div>
              </dl>
              {o.payment_method && (
                <div className="mt-4 rounded-lg bg-carbon/5 p-4 text-sm">
                  <p>Pago: <strong>{o.payment_method}</strong> {o.payment_status === 'paid' && '· Pagado'}</p>
                  {o.payment_instructions && o.payment_status !== 'paid' && <p className="mt-1 text-piedra">{o.payment_instructions}</p>}
                </div>
              )}
            </div>
            {settings?.whatsapp && (
              <a href={whatsappLink(settings.whatsapp, `Hola, tengo una pregunta sobre mi pedido #${o.number}`)} target="_blank" rel="noreferrer" className={buttonClass({ variant: 'light' }, 'mt-6')}>
                <MessageCircle /> ¿Dudas? Escríbenos
              </a>
            )}
          </>
        )}
      </div>
    </section>
  )
}
