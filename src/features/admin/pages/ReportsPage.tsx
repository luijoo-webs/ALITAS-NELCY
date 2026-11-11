import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, Plus, Trash2 } from 'lucide-react'
import { db } from '@/lib/supabase'
import { formatCOP } from '@/lib/format'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { ErrorState, Skeleton } from '@/components/shared/states'
import { usePermissions } from '../hooks/usePermissions'
import { Alert, Btn, Card, Input, Page, PageHeader, Table, errMsg } from '../components/ui'
import { CHANNEL_LABEL } from '../services/orders'

interface Report {
  gross_sales: number; delivery_fees: number; discounts: number; orders: number; cogs: number; gross_margin: number; waste: number; expenses: number; operating_profit: number
  inventory_value: number
  by_payment: { method: string; sales: number; orders: number }[]
  by_channel: { channel: keyof typeof CHANNEL_LABEL; sales: number; orders: number }[]
  by_product: { name: string; quantity: number; sales: number }[]
  by_day: { day: string; sales: number; orders: number }[]
}

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
const bogotaStart = (d: string) => new Date(`${d}T00:00:00-05:00`)

/** CSV con separador ; (Excel en español) y BOM para tildes. */
export function toCsv(rows: (string | number)[][]) {
  return '﻿' + rows.map((r) => r.map((c) => {
    const s = String(c)
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }).join(';')).join('\n')
}
function download(name: string, rows: (string | number)[][]) {
  const url = URL.createObjectURL(new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' }))
  const a = Object.assign(document.createElement('a'), { href: url, download: name })
  a.click()
  URL.revokeObjectURL(url)
}

export function ReportsPage() {
  useDocumentTitle('Reportes')
  const { can } = usePermissions()
  const [from, setFrom] = useState(() => today().slice(0, 8) + '01')
  const [to, setTo] = useState(today)
  const range = useMemo(() => ({ from: bogotaStart(from), to: new Date(bogotaStart(to).getTime() + 86_400_000) }), [from, to])
  const q = useQuery({ queryKey: ['report', from, to], queryFn: async () => {
    const { data, error } = await db().rpc('sales_report', { p_from: range.from.toISOString(), p_to: range.to.toISOString() })
    if (error) throw error
    return data as Report
  } })
  const r = q.data

  return (
    <Page>
      <PageHeader title="Reportes" subtitle="Ventas = pedidos entregados. Utilidad operativa estimada: no incluye impuestos." actions={
        <div className="flex items-end gap-2">
          <Input label="Desde" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
          <Input label="Hasta" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
        </div>
      } />
      {q.error && <ErrorState error={q.error} className="mt-6 bg-white" />}
      {q.isPending && <Skeleton className="mt-6 h-80" />}
      {r && (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['Ventas brutas', r.gross_sales, `${r.orders} pedidos entregados`],
              ['Costo de insumos (CMV)', r.cogs, 'Según recetas y costo promedio'],
              ['Margen bruto', r.gross_margin, 'Ventas sin domicilios − CMV'],
              ['Utilidad operativa est.', r.operating_profit, `Gastos ${formatCOP(r.expenses)} · Mermas ${formatCOP(r.waste)}`],
            ].map(([k, v, h]) => (
              <div key={k as string} className="rounded-xl border border-carbon/10 bg-white p-5">
                <p className="text-sm font-medium text-piedra">{k}</p>
                <p className="price mt-2 font-display text-3xl font-black">{formatCOP(v as number)}</p>
                <p className="mt-1 text-xs text-piedra">{h}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-piedra">Valor actual del inventario: {formatCOP(r.inventory_value)} · Domicilios cobrados: {formatCOP(r.delivery_fees)} · Descuentos: {formatCOP(r.discounts)}</p>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Card title="Por producto" actions={<Btn size="sm" variant="outline" onClick={() => download(`ventas-producto-${from}-${to}.csv`, [['Producto', 'Cantidad', 'Ventas'], ...r.by_product.map((p) => [p.name, p.quantity, Number(p.sales)])])}><Download /> CSV</Btn>}>
              <Table head={['Producto', 'Cant.', 'Ventas']} empty={r.by_product.length === 0 && 'Sin ventas.'}>
                {r.by_product.map((p) => <tr key={p.name}><td>{p.name}</td><td>{p.quantity}</td><td className="price">{formatCOP(p.sales)}</td></tr>)}
              </Table>
            </Card>
            <div className="space-y-6">
              <Card title="Por método de pago">
                <Table head={['Método', 'Pedidos', 'Ventas']} empty={r.by_payment.length === 0 && 'Sin ventas.'}>
                  {r.by_payment.map((p) => <tr key={p.method}><td>{p.method}</td><td>{p.orders}</td><td className="price">{formatCOP(p.sales)}</td></tr>)}
                </Table>
              </Card>
              <Card title="Por canal">
                <Table head={['Canal', 'Pedidos', 'Ventas']} empty={r.by_channel.length === 0 && 'Sin ventas.'}>
                  {r.by_channel.map((p) => <tr key={p.channel}><td>{CHANNEL_LABEL[p.channel] ?? p.channel}</td><td>{p.orders}</td><td className="price">{formatCOP(p.sales)}</td></tr>)}
                </Table>
              </Card>
            </div>
          </div>
          <Card title="Por día" className="mt-6" actions={<Btn size="sm" variant="outline" onClick={() => download(`ventas-dia-${from}-${to}.csv`, [['Día', 'Pedidos', 'Ventas'], ...r.by_day.map((d) => [d.day, d.orders, Number(d.sales)])])}><Download /> CSV</Btn>}>
            <Table head={['Día', 'Pedidos', 'Ventas']} empty={r.by_day.length === 0 && 'Sin ventas.'}>
              {r.by_day.map((d) => <tr key={d.day}><td>{new Date(`${d.day}T12:00:00`).toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })}</td><td>{d.orders}</td><td className="price">{formatCOP(d.sales)}</td></tr>)}
            </Table>
          </Card>
        </>
      )}
      {can('expenses.manage') && <ExpensesCard from={from} to={to} />}
    </Page>
  )
}

function ExpensesCard({ from, to }: { from: string; to: string }) {
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ['expenses', from, to], queryFn: async () => {
    const { data, error } = await db().from('expenses').select('*').gte('spent_on', from).lte('spent_on', to).order('spent_on', { ascending: false })
    if (error) throw error
    return data as { id: string; category: string; description: string | null; amount: number; spent_on: string }[]
  } })
  const [n, setN] = useState({ category: '', description: '', amount: '', spent_on: today() })
  const [error, setError] = useState<string | null>(null)
  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ['expenses'] }), qc.invalidateQueries({ queryKey: ['report'] })])
  const add = async () => {
    setError(null)
    const { error } = await db().from('expenses').insert({ category: n.category.trim(), description: n.description || null, amount: Number(n.amount.replace(/\D/g, '')), spent_on: n.spent_on })
    if (error) return setError(errMsg(error))
    setN({ ...n, description: '', amount: '' }); refresh()
  }
  return (
    <Card title="Gastos operativos" className="mt-6">
      <div className="grid grid-cols-2 items-end gap-2 sm:grid-cols-[1fr_1.5fr_1fr_1fr_auto]">
        <Input label="Categoría" placeholder="Arriendo, servicios…" value={n.category} onChange={(e) => setN({ ...n, category: e.target.value })} />
        <Input label="Descripción" value={n.description} onChange={(e) => setN({ ...n, description: e.target.value })} />
        <Input label="Valor" inputMode="numeric" value={n.amount} onChange={(e) => setN({ ...n, amount: e.target.value })} />
        <Input label="Fecha" type="date" value={n.spent_on} onChange={(e) => setN({ ...n, spent_on: e.target.value })} />
        <Btn onClick={add} disabled={n.category.trim().length < 2 || !n.amount}><Plus /></Btn>
      </div>
      <div className="mt-3"><Alert>{error}</Alert></div>
      <Table head={['Fecha', 'Categoría', 'Descripción', 'Valor', '']} empty={q.data?.length === 0 && 'Sin gastos en el periodo.'}>
        {(q.data ?? []).map((e) => (
          <tr key={e.id}><td className="text-xs">{e.spent_on}</td><td>{e.category}</td><td className="text-piedra">{e.description}</td><td className="price">{formatCOP(e.amount)}</td>
            <td className="text-right"><Btn variant="danger" size="sm" onClick={async () => { if (confirm('¿Eliminar este gasto?')) { await db().from('expenses').delete().eq('id', e.id); refresh() } }}><Trash2 /></Btn></td></tr>
        ))}
      </Table>
    </Card>
  )
}
