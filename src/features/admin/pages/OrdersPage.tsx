import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, BellOff, Clock, MessageCircle, Printer, Wifi, WifiOff } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatCOP, whatsappLink } from '@/lib/format'
import { cn } from '@/lib/cn'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { ErrorState, Skeleton } from '@/components/shared/states'
import { usePermissions } from '../hooks/usePermissions'
import { Alert, Badge, Btn, Modal, Page, PageHeader, Textarea, errMsg } from '../components/ui'
import { CHANNEL_LABEL, FULFILL_LABEL, fetchBoard, fetchStatuses, setPayment, setStatus, type OrderRow, type OrderStatus } from '../services/orders'

const COLUMNS = [
  { kind: 'new', title: 'Nuevos' },
  { kind: 'confirmed', title: 'Confirmados' },
  { kind: 'in_progress', title: 'En preparación' },
  { kind: 'ready', title: 'Listos' },
  { kind: 'out_for_delivery', title: 'En camino' },
]

const ago = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  return m < 1 ? 'ahora' : m < 60 ? `hace ${m} min` : `hace ${Math.floor(m / 60)} h ${m % 60} min`
}

/** Celular colombiano de 10 dígitos → formato wa.me con indicativo. */
export const waNumber = (phone: string | null) => {
  const d = (phone ?? '').replace(/\D/g, '')
  return d.length === 10 && d.startsWith('3') ? `57${d}` : d
}

function beep() {
  try {
    const ctx = new AudioContext()
    ;[0, 0.18].forEach((t) => {
      const o = ctx.createOscillator(), g = ctx.createGain()
      o.frequency.value = 880
      g.gain.setValueAtTime(0.25, ctx.currentTime + t)
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.15)
      o.connect(g).connect(ctx.destination)
      o.start(ctx.currentTime + t)
      o.stop(ctx.currentTime + t + 0.16)
    })
  } catch { /* sin audio disponible */ }
}

export function OrdersPage() {
  useDocumentTitle('Pedidos')
  const qc = useQueryClient()
  const board = useQuery({ queryKey: ['orders-board'], queryFn: fetchBoard, refetchInterval: 30_000 })
  const statuses = useQuery({ queryKey: ['order-statuses'], queryFn: fetchStatuses, staleTime: Infinity })
  const [live, setLive] = useState(false)
  const [notify, setNotify] = useState(() => typeof Notification !== 'undefined' && Notification.permission === 'granted')
  const [selected, setSelected] = useState<string | null>(null)
  const notifyRef = useRef(notify)
  notifyRef.current = notify

  // Tiempo real: pedido nuevo = sonido + aviso del navegador; si se cae, el refetch de 30 s cubre.
  useEffect(() => {
    if (!supabase) return
    const client = supabase
    const ch = client.channel('orders-board')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
        beep()
        const n = (payload.new as { number?: number }).number
        if (notifyRef.current && document.hidden) new Notification('Nuevo pedido', { body: n ? `Pedido #${n}` : 'Entró un pedido' })
        qc.invalidateQueries({ queryKey: ['orders-board'] })
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, () => qc.invalidateQueries({ queryKey: ['orders-board'] }))
      .subscribe((s) => setLive(s === 'SUBSCRIBED'))
    return () => { client.removeChannel(ch) }
  }, [qc])

  const kindOf = useMemo(() => new Map((statuses.data ?? []).map((s) => [s.code, s.kind])), [statuses.data])
  const orders = board.data ?? []
  const newCount = orders.filter((o) => o.status === 'new').length
  useEffect(() => { document.title = newCount ? `(${newCount}) Pedidos · Alitas Nelcy` : 'Pedidos · Alitas Nelcy' }, [newCount])

  const enableNotify = async () => {
    if (typeof Notification === 'undefined') return
    const p = await Notification.requestPermission()
    setNotify(p === 'granted')
    beep()
  }

  const closed = orders.filter((o) => ['delivered', 'cancelled'].includes(kindOf.get(o.status) ?? ''))
  const current = orders.find((o) => o.id === selected) ?? null

  return (
    <Page>
      <PageHeader
        title="Pedidos"
        subtitle="Los nuevos aparecen solos, con sonido."
        actions={<>
          <Badge tone={live ? 'green' : 'yellow'}>{live ? <><Wifi className="mr-1 size-3" /> En vivo</> : <><WifiOff className="mr-1 size-3" /> Sin conexión en vivo</>}</Badge>
          <Btn variant="outline" size="sm" onClick={enableNotify}>{notify ? <Bell /> : <BellOff />} {notify ? 'Avisos activos' : 'Activar avisos y sonido'}</Btn>
        </>}
      />
      {board.error && <ErrorState error={board.error} onRetry={() => board.refetch()} className="mt-6 bg-white" />}
      {board.isPending && <Skeleton className="mt-6 h-96" />}
      {board.data && (
        <>
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {COLUMNS.map((col) => {
              const list = orders.filter((o) => kindOf.get(o.status) === col.kind)
              return (
                <section key={col.kind} className="rounded-xl bg-carbon/[0.04] p-3">
                  <h2 className="mb-3 flex items-center justify-between px-1 font-sans text-sm font-semibold normal-case">
                    {col.title} <span className="rounded-md bg-white px-2 py-0.5 text-xs">{list.length}</span>
                  </h2>
                  <div className="space-y-2.5">
                    {list.length === 0 && <p className="px-1 py-6 text-center text-xs text-piedra">Vacío</p>}
                    {list.map((o) => <OrderCard key={o.id} o={o} onOpen={() => setSelected(o.id)} />)}
                  </div>
                </section>
              )
            })}
          </div>
          {closed.length > 0 && (
            <details className="mt-6 rounded-xl border border-carbon/10 bg-white p-4">
              <summary className="cursor-pointer text-sm font-semibold">Cerrados en las últimas 24 h ({closed.length})</summary>
              <ul className="mt-3 divide-y divide-carbon/8">
                {closed.map((o) => (
                  <li key={o.id}>
                    <button onClick={() => setSelected(o.id)} className="flex w-full items-center justify-between gap-3 py-2.5 text-left text-sm hover:bg-carbon/[0.02]">
                      <span>#{o.number} · {o.customer_name ?? 'Consumidor final'}</span>
                      <span className="flex items-center gap-2">
                        <Badge tone={o.status === 'cancelled' ? 'red' : 'green'}>{statuses.data?.find((s) => s.code === o.status)?.label}</Badge>
                        <span className="price">{formatCOP(o.total)}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
      {current && statuses.data && <OrderDetail o={current} statuses={statuses.data} kind={kindOf.get(current.status) ?? ''} onClose={() => setSelected(null)} />}
    </Page>
  )
}

function OrderCard({ o, onOpen }: { o: OrderRow; onOpen: () => void }) {
  const items = o.order_items.reduce((n, i) => n + i.quantity, 0)
  return (
    <button onClick={onOpen} className={cn('w-full rounded-lg border bg-white p-3 text-left shadow-sm transition-shadow hover:shadow-md', o.status === 'new' ? 'border-alas/50' : 'border-carbon/10')}>
      <div className="flex items-center justify-between">
        <span className="font-display text-xl font-black">#{o.number}</span>
        <span className="flex items-center gap-1 text-xs text-piedra"><Clock className="size-3" />{ago(o.created_at)}</span>
      </div>
      <p className="mt-1 truncate text-sm font-medium">{o.customer_name ?? 'Consumidor final'}</p>
      <div className="mt-2 flex flex-wrap gap-1">
        <Badge tone={o.fulfillment === 'delivery' ? 'blue' : 'neutral'}>{FULFILL_LABEL[o.fulfillment]}</Badge>
        <Badge>{CHANNEL_LABEL[o.channel]}</Badge>
        {o.payment_status === 'paid' && <Badge tone="green">Pagado</Badge>}
      </div>
      <div className="mt-2 flex items-center justify-between text-sm">
        <span className="text-piedra">{items} {items === 1 ? 'producto' : 'productos'}</span>
        <span className="price font-semibold">{formatCOP(o.total)}</span>
      </div>
    </button>
  )
}

function nextActions(o: OrderRow, kind: string): { code: string; label: string }[] {
  const ready = o.fulfillment === 'pickup' ? { code: 'ready_for_pickup', label: 'Listo para recoger' } : { code: 'ready', label: 'Listo' }
  switch (kind) {
    case 'new': return [{ code: 'confirmed', label: 'Confirmar pedido' }]
    case 'confirmed': return [{ code: 'preparing', label: 'En preparación' }, ready]
    case 'in_progress': return [ready]
    case 'ready': return o.fulfillment === 'delivery' ? [{ code: 'out_for_delivery', label: 'En camino' }, { code: 'delivered', label: 'Entregado' }] : [{ code: 'delivered', label: 'Entregado' }]
    case 'out_for_delivery': return [{ code: 'delivered', label: 'Entregado' }]
    default: return []
  }
}

function OrderDetail({ o, statuses, kind, onClose }: { o: OrderRow; statuses: OrderStatus[]; kind: string; onClose: () => void }) {
  const qc = useQueryClient()
  const { can } = usePermissions()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [reason, setReason] = useState('')
  const label = statuses.find((s) => s.code === o.status)?.label
  const open = !['delivered', 'cancelled'].includes(kind)

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setError(null)
    try { await fn(); await qc.invalidateQueries({ queryKey: ['orders-board'] }); await qc.invalidateQueries({ queryKey: ['dashboard'] }) }
    catch (e) { setError(errMsg(e)) }
    finally { setBusy(false) }
  }

  const waText = `Hola ${o.customer_name ?? ''}, te escribimos de Alitas Nelcy sobre tu pedido #${o.number}. Estado: ${label}.`

  return (
    <Modal open onClose={onClose} title={`Pedido #${o.number}`} wide>
      <div className="grid gap-6 md:grid-cols-[1.3fr_1fr]">
        <div>
          <div className="flex flex-wrap gap-1.5">
            <Badge tone={kind === 'cancelled' ? 'red' : kind === 'delivered' ? 'green' : 'yellow'}>{label}</Badge>
            <Badge tone="blue">{FULFILL_LABEL[o.fulfillment]}</Badge>
            <Badge>{CHANNEL_LABEL[o.channel]}</Badge>
            <Badge tone={o.payment_status === 'paid' ? 'green' : 'neutral'}>{o.payment_status === 'paid' ? 'Pagado' : 'Pago pendiente'}</Badge>
          </div>
          <ul className="mt-4 divide-y divide-carbon/8 rounded-lg border border-carbon/10 bg-white">
            {o.order_items.map((i) => (
              <li key={i.id} className="flex justify-between gap-3 px-4 py-3 text-sm">
                <div>
                  <p className="font-semibold">{i.quantity} × {i.name_snapshot}</p>
                  {i.order_item_modifiers.length > 0 && <p className="text-piedra">{i.order_item_modifiers.map((m) => m.name_snapshot).join(', ')}</p>}
                  {i.notes && <p className="text-alas-700">Nota: {i.notes}</p>}
                </div>
                <span className="price shrink-0">{formatCOP(i.line_total)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-3 space-y-1 text-sm">
            <Row k="Subtotal" v={formatCOP(o.subtotal)} />
            {Number(o.discount) > 0 && <Row k="Descuento" v={`−${formatCOP(o.discount)}`} />}
            {o.fulfillment === 'delivery' && <Row k={`Domicilio${o.delivery_zones ? ` (${o.delivery_zones.name})` : ''}`} v={formatCOP(o.delivery_fee)} />}
            <Row k="Total" v={formatCOP(o.total)} strong />
          </dl>
          {o.notes && <p className="mt-3 rounded-lg bg-maiz/20 px-3 py-2 text-sm">Nota del pedido: {o.notes}</p>}
        </div>

        <div className="space-y-4 text-sm">
          <div className="rounded-lg border border-carbon/10 bg-white p-4">
            <p className="font-semibold">{o.customer_name ?? 'Consumidor final'}</p>
            {o.customer_phone && <p><a className="underline" href={`tel:${o.customer_phone}`}>{o.customer_phone}</a></p>}
            {o.customer_email && <p className="text-piedra">{o.customer_email}</p>}
            {o.fulfillment === 'delivery' && <p className="mt-2">{o.address}, {o.neighborhood}{o.address_reference ? ` — ${o.address_reference}` : ''}</p>}
            <p className="mt-2">Pago: <strong>{o.payment_methods?.label ?? '—'}</strong>{o.cash_change_for ? ` · paga con ${formatCOP(o.cash_change_for)}` : ''}</p>
            <p className="mt-1 text-xs text-piedra">Entró {new Date(o.created_at).toLocaleString('es-CO', { timeZone: 'America/Bogota' })}</p>
          </div>

          <Alert>{error}</Alert>
          {open && can('orders.update_status') && (
            <div className="grid gap-2">
              {nextActions(o, kind).map((a, i) => (
                <Btn key={a.code} variant={i === 0 ? 'accent' : 'outline'} disabled={busy} onClick={() => run(() => setStatus(o.id, a.code))}>{a.label}</Btn>
              ))}
            </div>
          )}
          {can('payments.verify') && kind !== 'cancelled' && (
            <Btn variant="outline" className="w-full" disabled={busy} onClick={() => run(() => setPayment(o.id, o.payment_status === 'paid' ? 'pending' : 'paid'))}>
              {o.payment_status === 'paid' ? 'Marcar pago como pendiente' : 'Marcar como pagado'}
            </Btn>
          )}
          <div className="flex gap-2">
            {o.customer_phone && (
              <a href={whatsappLink(waNumber(o.customer_phone), waText)} target="_blank" rel="noreferrer" className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg border border-carbon/20 bg-white text-sm font-medium hover:bg-carbon/5">
                <MessageCircle className="size-4" /> WhatsApp
              </a>
            )}
            <Btn variant="outline" className="flex-1" onClick={() => printTicket(o, label ?? '')}><Printer /> Ticket</Btn>
          </div>
          {open && can('orders.cancel') && !cancelling && <Btn variant="danger" className="w-full" onClick={() => setCancelling(true)}>Cancelar pedido</Btn>}
          {cancelling && (
            <div className="space-y-2 rounded-lg border border-alas/30 bg-alas/5 p-3">
              <Textarea label="Motivo" value={reason} onChange={(e) => setReason(e.target.value)} />
              {o.inventory_state === 'consumed' ? (
                <div className="grid gap-2">
                  <Btn variant="accent" disabled={busy} onClick={() => run(() => setStatus(o.id, 'cancelled', true, reason))}>No se preparó: reintegrar insumos</Btn>
                  <Btn variant="outline" disabled={busy} onClick={() => run(() => setStatus(o.id, 'cancelled', false, reason))}>Ya se preparó: dejar como merma</Btn>
                </div>
              ) : (
                <Btn variant="accent" className="w-full" disabled={busy} onClick={() => run(() => setStatus(o.id, 'cancelled', true, reason))}>Confirmar cancelación</Btn>
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}

const Row = ({ k, v, strong }: { k: string; v: string; strong?: boolean }) => (
  <div className={cn('flex justify-between', strong && 'border-t border-carbon/10 pt-1 text-base font-semibold')}><dt>{k}</dt><dd className="price">{v}</dd></div>
)

/** Ticket para impresora térmica de 80 mm. */
function printTicket(o: OrderRow, label: string) {
  const w = window.open('', '_blank', 'width=380,height=640')
  if (!w) return
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))
  const lines = o.order_items.map((i) =>
    `<tr><td>${i.quantity}× ${esc(i.name_snapshot)}${i.order_item_modifiers.length ? `<br><small>${esc(i.order_item_modifiers.map((m) => m.name_snapshot).join(', '))}</small>` : ''}${i.notes ? `<br><small>Nota: ${esc(i.notes)}</small>` : ''}</td><td style="text-align:right">${formatCOP(i.line_total)}</td></tr>`).join('')
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Pedido #${o.number}</title>
    <style>body{font:13px monospace;width:72mm;margin:0 auto}h1{font-size:18px;text-align:center;margin:4px 0}table{width:100%;border-collapse:collapse}td{padding:3px 0;vertical-align:top}hr{border:0;border-top:1px dashed #000}</style></head>
    <body><h1>ALITAS NELCY</h1><p style="text-align:center">Pedido #${o.number} · ${esc(FULFILL_LABEL[o.fulfillment])}<br>${new Date(o.created_at).toLocaleString('es-CO', { timeZone: 'America/Bogota' })}<br>${esc(label)}</p><hr>
    <p>${esc(o.customer_name ?? 'Consumidor final')}${o.customer_phone ? `<br>${esc(o.customer_phone)}` : ''}${o.fulfillment === 'delivery' ? `<br>${esc(`${o.address ?? ''}, ${o.neighborhood ?? ''}`)}${o.address_reference ? `<br>${esc(o.address_reference)}` : ''}` : ''}</p><hr>
    <table>${lines}</table><hr>
    <table><tr><td>Subtotal</td><td style="text-align:right">${formatCOP(o.subtotal)}</td></tr>
    ${Number(o.discount) > 0 ? `<tr><td>Descuento</td><td style="text-align:right">-${formatCOP(o.discount)}</td></tr>` : ''}
    ${o.fulfillment === 'delivery' ? `<tr><td>Domicilio</td><td style="text-align:right">${formatCOP(o.delivery_fee)}</td></tr>` : ''}
    <tr><td><b>TOTAL</b></td><td style="text-align:right"><b>${formatCOP(o.total)}</b></td></tr></table>
    <p>Pago: ${esc(o.payment_methods?.label ?? '')}${o.cash_change_for ? ` · paga con ${formatCOP(o.cash_change_for)}` : ''}</p>
    ${o.notes ? `<p>Nota: ${esc(o.notes)}</p>` : ''}<script>window.onload=()=>{window.print()}</script></body></html>`)
  w.document.close()
}
