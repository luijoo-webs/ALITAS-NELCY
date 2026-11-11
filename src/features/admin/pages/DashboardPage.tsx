import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Ban, ClipboardList, Package, Receipt, TrendingUp, UserPlus } from 'lucide-react'
import { ErrorState, Skeleton } from '@/components/shared/states'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { supabase } from '@/lib/supabase'
import { formatCOP } from '@/lib/format'
import { cn } from '@/lib/cn'
import { bogotaRange, fetchDashboard, type DashboardSummary } from '../services/admin'

const RANGES = [
  { days: 1, label: 'Hoy' },
  { days: 7, label: '7 días' },
  { days: 30, label: '30 días' },
] as const

const CHANNEL_LABEL: Record<string, string> = { web: 'Sitio web', counter: 'Mostrador', phone: 'Teléfono', whatsapp: 'WhatsApp' }

export function DashboardPage() {
  useDocumentTitle('Dashboard')
  const [days, setDays] = useState<number>(7)
  const { from, to } = useMemo(() => bogotaRange(days), [days])
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ['dashboard', days], queryFn: () => fetchDashboard(from, to), refetchInterval: 60_000 })

  // Pedidos nuevos o cambios de estado refrescan el dashboard al instante (RLS filtra el canal).
  useEffect(() => {
    if (!supabase) return
    const client = supabase
    const ch = client
      .channel('dashboard-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => qc.invalidateQueries({ queryKey: ['dashboard'] }))
      .subscribe()
    return () => { client.removeChannel(ch) }
  }, [qc])

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-piedra">{new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Bogota' })}</p>
          <h1 className="font-display text-4xl font-black uppercase">Dashboard</h1>
        </div>
        <div role="group" aria-label="Periodo" className="inline-flex rounded-lg border border-carbon/15 bg-white p-1">
          {RANGES.map((r) => (
            <button
              key={r.days}
              onClick={() => setDays(r.days)}
              aria-pressed={days === r.days}
              className={cn('rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors', days === r.days ? 'bg-carbon text-hueso' : 'text-carbon/70 hover:bg-carbon/5')}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {q.error && <ErrorState error={q.error} onRetry={() => q.refetch()} className="mt-8 bg-white" />}
      {q.isPending && !q.error && (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}
          <Skeleton className="h-72 sm:col-span-2 lg:col-span-4" />
        </div>
      )}
      {q.data && <Content data={q.data} from={from} days={days} />}
    </div>
  )
}

function Content({ data, from, days }: { data: DashboardSummary; from: Date; days: number }) {
  const empty = data.orders_count === 0 && data.cancelled_count === 0
  return (
    <>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={TrendingUp} label="Ventas" value={formatCOP(data.sales)} hint={`${data.delivered_count} pedidos entregados`} />
        <Kpi icon={ClipboardList} label="Pedidos" value={String(data.orders_count)} hint={data.cancelled_count ? `${data.cancelled_count} cancelados aparte` : 'Sin cancelaciones'} />
        <Kpi icon={Receipt} label="Ticket promedio" value={formatCOP(data.avg_ticket)} hint="Sobre pedidos entregados" />
        <Kpi icon={UserPlus} label="Clientes nuevos" value={String(data.new_customers)} hint="Registrados en el periodo" />
      </div>

      {empty && (
        <p className="mt-6 rounded-lg border border-dashed border-carbon/20 bg-white/60 px-4 py-3 text-sm text-piedra">
          Aún no hay pedidos en este periodo. Las cifras se llenan solas cuando entren pedidos del sitio o ventas manuales.
        </p>
      )}

      {days > 1 && (
        <Panel title="Ventas por día" className="mt-6">
          <SalesChart data={data.by_day} from={from} days={days} />
        </Panel>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Más vendidos">
          <BarList
            rows={data.top_products.map((p) => ({ label: p.name, value: Number(p.quantity), detail: `${p.quantity} und · ${formatCOP(p.sales)}` }))}
            empty="Sin ventas en el periodo."
          />
        </Panel>
        <Panel title="Ventas por canal">
          <BarList
            rows={data.by_channel.map((c) => ({ label: CHANNEL_LABEL[c.channel] ?? c.channel, value: Number(c.sales), detail: `${formatCOP(c.sales)} · ${c.orders} ped.` }))}
            empty="Sin ventas en el periodo."
          />
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Pedidos abiertos ahora">
          {data.open_by_status.length === 0 ? (
            <p className="py-6 text-center text-sm text-piedra">No hay pedidos en curso.</p>
          ) : (
            <ul className="divide-y divide-carbon/8">
              {data.open_by_status.map((s) => (
                <li key={s.code} className="flex items-center justify-between py-3 text-sm">
                  <span>{s.label}</span>
                  <span className="price rounded-md bg-carbon/6 px-2.5 py-0.5 font-semibold">{s.count}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Menú">
          <div className="grid grid-cols-2 gap-4">
            <Stat icon={Package} label="Productos activos" value={data.catalog.products} />
            <Stat icon={Ban} label="Agotados / pausados" value={data.catalog.unavailable} tone={data.catalog.unavailable > 0 ? 'warn' : undefined} />
          </div>
          <p className="mt-4 text-xs text-piedra">Las alertas de stock bajo de ingredientes llegan con el inventario (Fase 4).</p>
        </Panel>
      </div>
    </>
  )
}

function Kpi({ icon: Icon, label, value, hint }: { icon: typeof TrendingUp; label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border border-carbon/10 bg-white p-5">
      <div className="flex items-center justify-between text-sm font-medium text-piedra">
        {label}
        <span className="grid size-8 place-items-center rounded-lg bg-maiz/25 text-carbon"><Icon className="size-4" /></span>
      </div>
      <p className="price mt-3 font-display text-3xl font-black">{value}</p>
      <p className="mt-1 text-xs text-piedra">{hint}</p>
    </div>
  )
}

function Stat({ icon: Icon, label, value, tone }: { icon: typeof Package; label: string; value: number; tone?: 'warn' }) {
  return (
    <div className="rounded-lg bg-carbon/[0.03] p-4">
      <Icon className={cn('size-5', tone === 'warn' ? 'text-alas' : 'text-piedra')} />
      <p className="price mt-2 font-display text-3xl font-black">{value}</p>
      <p className="text-xs text-piedra">{label}</p>
    </div>
  )
}

function Panel({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-xl border border-carbon/10 bg-white p-5 sm:p-6', className)}>
      <h2 className="font-sans text-base font-semibold normal-case">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  )
}

function BarList({ rows, empty }: { rows: { label: string; value: number; detail: string }[]; empty: string }) {
  if (rows.length === 0) return <p className="py-6 text-center text-sm text-piedra">{empty}</p>
  const max = Math.max(...rows.map((r) => r.value), 1)
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="flex justify-between gap-3 text-sm">
            <span className="truncate font-medium">{r.label}</span>
            <span className="price shrink-0 text-piedra">{r.detail}</span>
          </div>
          <div className="mt-1.5 h-2 rounded-full bg-carbon/6">
            <div className="h-full rounded-full bg-alas" style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

/** Barras de ventas por día; los días sin ventas se muestran en cero. */
function SalesChart({ data, from, days }: { data: DashboardSummary['by_day']; from: Date; days: number }) {
  const series = useMemo(() => {
    const byDay = new Map(data.map((d) => [d.day, d]))
    return Array.from({ length: days }, (_, i) => {
      const date = new Date(from.getTime() + i * 86_400_000)
      const key = date.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }) // YYYY-MM-DD
      const d = byDay.get(key)
      return { key, date, sales: Number(d?.sales ?? 0), orders: d?.orders ?? 0 }
    })
  }, [data, from, days])
  const max = Math.max(...series.map((s) => s.sales), 1)
  const fmtDay = (d: Date) => d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', timeZone: 'America/Bogota' })

  return (
    <>
      <div className="flex h-56 items-end gap-[2px] border-b border-carbon/15" aria-hidden>
        {series.map((s) => (
          <div key={s.key} className="group relative flex h-full flex-1 items-end justify-center">
            <div
              className="w-full max-w-10 rounded-t-[4px] bg-alas transition-opacity group-hover:opacity-80"
              style={{ height: `${(s.sales / max) * 100}%`, minHeight: s.sales > 0 ? 2 : 0 }}
            />
            <div className="pointer-events-none absolute bottom-full z-10 mb-1 hidden whitespace-nowrap rounded-md bg-carbon px-2.5 py-1.5 text-xs text-hueso shadow-lg group-hover:block">
              <span className="font-semibold">{fmtDay(s.date)}</span> · {formatCOP(s.sales)} · {s.orders} ped.
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-xs text-piedra" aria-hidden>
        <span>{fmtDay(series[0].date)}</span>
        <span>{fmtDay(series[series.length - 1].date)}</span>
      </div>
      <table className="sr-only">
        <caption>Ventas por día</caption>
        <thead><tr><th>Día</th><th>Ventas</th><th>Pedidos</th></tr></thead>
        <tbody>{series.map((s) => <tr key={s.key}><td>{fmtDay(s.date)}</td><td>{formatCOP(s.sales)}</td><td>{s.orders}</td></tr>)}</tbody>
      </table>
    </>
  )
}
