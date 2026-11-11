import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Pencil, Plus, SlidersHorizontal, Trash2 } from 'lucide-react'
import { db } from '@/lib/supabase'
import { formatCOP } from '@/lib/format'
import { cn } from '@/lib/cn'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { ErrorState, Skeleton } from '@/components/shared/states'
import { usePermissions } from '../hooks/usePermissions'
import { Alert, Badge, Btn, Card, Input, Modal, Page, PageHeader, Select, Table, Toggle, errMsg } from '../components/ui'

export interface Ingredient { id: string; name: string; category: string | null; base_unit: 'g' | 'ml' | 'unit'; stock_qty: number; min_stock: number; avg_cost: number; is_critical: boolean; is_active: boolean; main_supplier_id: string | null }
const UNIT = { g: 'g', ml: 'ml', unit: 'und' }
const qtyFmt = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 })
export const fmtQty = (q: number, u: Ingredient['base_unit']) =>
  u !== 'unit' && Math.abs(q) >= 1000 ? `${qtyFmt.format(q / 1000)} ${u === 'g' ? 'kg' : 'l'}` : `${qtyFmt.format(q)} ${UNIT[u]}`

export async function fetchIngredients(): Promise<Ingredient[]> {
  const { data, error } = await db().from('ingredients').select('*').order('name')
  if (error) throw error
  return (data as Ingredient[]).map((i) => ({ ...i, stock_qty: Number(i.stock_qty), min_stock: Number(i.min_stock), avg_cost: Number(i.avg_cost) }))
}

const TABS = ['Ingredientes', 'Recetas', 'Movimientos', 'Alertas'] as const

export function InventoryPage() {
  useDocumentTitle('Inventario')
  const ing = useQuery({ queryKey: ['ingredients'], queryFn: fetchIngredients })
  const alerts = useQuery({ queryKey: ['inv-alerts'], queryFn: async () => {
    const { data, error } = await db().from('inventory_alerts').select('id, type, message, created_at').eq('status', 'open').order('created_at', { ascending: false })
    if (error) throw error
    return data as { id: string; type: string; message: string; created_at: string }[]
  } })
  const [tab, setTab] = useState<(typeof TABS)[number]>('Ingredientes')
  return (
    <Page>
      <PageHeader title="Inventario" subtitle="Existencias por ingrediente. Se descuentan solas al confirmar cada pedido según su receta." />
      <div className="mt-6 flex gap-1 overflow-x-auto rounded-lg bg-carbon/5 p-1">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={cn('flex items-center gap-1.5 whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium', tab === t ? 'bg-white shadow-sm' : 'text-carbon/70')}>
            {t}{t === 'Alertas' && (alerts.data?.length ?? 0) > 0 && <span className="rounded-full bg-alas px-1.5 text-xs text-hueso">{alerts.data!.length}</span>}
          </button>
        ))}
      </div>
      {ing.error && <ErrorState error={ing.error} className="mt-6 bg-white" />}
      {ing.isPending && <Skeleton className="mt-6 h-80" />}
      {ing.data && (
        <div className="mt-6">
          {tab === 'Ingredientes' && <IngredientsTab list={ing.data} />}
          {tab === 'Recetas' && <RecipesTab ingredients={ing.data} />}
          {tab === 'Movimientos' && <MovementsTab ingredients={ing.data} />}
          {tab === 'Alertas' && (
            <Card title="Alertas abiertas">
              {(alerts.data ?? []).length === 0 ? <p className="py-6 text-center text-sm text-piedra">Sin alertas. Todo en orden.</p> : (
                <ul className="divide-y divide-carbon/8">
                  {alerts.data!.map((a) => (
                    <li key={a.id} className="flex items-start gap-3 py-3 text-sm">
                      <AlertTriangle className={cn('mt-0.5 size-4 shrink-0', a.type === 'low_stock' ? 'text-mostaza' : 'text-alas')} />
                      <span className="flex-1">{a.message}</span>
                      <span className="text-xs text-piedra">{new Date(a.created_at).toLocaleString('es-CO', { timeZone: 'America/Bogota' })}</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-xs text-piedra">Las alertas se cierran solas cuando el stock se recupera (compra o conteo).</p>
            </Card>
          )}
        </div>
      )}
    </Page>
  )
}

function IngredientsTab({ list }: { list: Ingredient[] }) {
  const qc = useQueryClient()
  const { can } = usePermissions()
  const [edit, setEdit] = useState<Partial<Ingredient> | null>(null)
  const [adjust, setAdjust] = useState<Ingredient | null>(null)
  const [error, setError] = useState<string | null>(null)
  const value = list.reduce((s, i) => s + Math.max(0, i.stock_qty) * i.avg_cost, 0)
  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ['ingredients'] }), qc.invalidateQueries({ queryKey: ['inv-alerts'] })])

  const save = async () => {
    if (!edit) return
    setError(null)
    try {
      if (!edit.name?.trim()) throw new Error('Escribe el nombre.')
      const row = { name: edit.name.trim(), category: edit.category || null, min_stock: Number(edit.min_stock) || 0, is_critical: edit.is_critical ?? false, is_active: edit.is_active ?? true }
      const { error } = edit.id ? await db().from('ingredients').update(row).eq('id', edit.id) : await db().from('ingredients').insert({ ...row, base_unit: edit.base_unit ?? 'g' })
      if (error) throw error
      await refresh(); setEdit(null)
    } catch (e) { setError(errMsg(e)) }
  }

  return (
    <Card title={`Valor del inventario: ${formatCOP(value)}`} actions={can('inventory.manage') && <Btn onClick={() => setEdit({ base_unit: 'g', is_active: true })}><Plus /> Ingrediente</Btn>}>
      <Table head={['Ingrediente', 'Existencia', 'Mínimo', 'Costo prom.', 'Estado', '']} empty={list.length === 0 && 'Crea los ingredientes (pollo, papa, salsas, empaques…) y luego registra una compra para darles existencia.'}>
        {list.map((i) => (
          <tr key={i.id} className={cn(!i.is_active && 'opacity-50')}>
            <td className="font-medium">{i.name}{i.is_critical && <span className="ml-1 text-xs text-alas">● crítico</span>}<span className="block text-xs text-piedra">{i.category}</span></td>
            <td className="price">{fmtQty(i.stock_qty, i.base_unit)}</td>
            <td className="price text-piedra">{fmtQty(i.min_stock, i.base_unit)}</td>
            <td className="price text-piedra">{formatCOP(i.avg_cost * (i.base_unit === 'unit' ? 1 : 1000))}/{i.base_unit === 'unit' ? 'und' : i.base_unit === 'g' ? 'kg' : 'l'}</td>
            <td>{i.stock_qty < 0 ? <Badge tone="red">Negativo</Badge> : i.stock_qty === 0 ? <Badge tone="red">Agotado</Badge> : i.stock_qty <= i.min_stock ? <Badge tone="yellow">Bajo</Badge> : <Badge tone="green">OK</Badge>}</td>
            <td className="whitespace-nowrap text-right">
              {can('inventory.adjust') && <Btn variant="ghost" size="sm" onClick={() => setAdjust(i)}><SlidersHorizontal /> Ajustar</Btn>}
              {can('inventory.manage') && <Btn variant="ghost" size="sm" onClick={() => setEdit(i)}><Pencil /></Btn>}
            </td>
          </tr>
        ))}
      </Table>
      {edit && (
        <Modal open onClose={() => setEdit(null)} title={edit.id ? 'Editar ingrediente' : 'Nuevo ingrediente'}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Nombre" className="sm:col-span-2" value={edit.name ?? ''} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            <Input label="Categoría (ej. Proteínas, Salsas, Empaques)" value={edit.category ?? ''} onChange={(e) => setEdit({ ...edit, category: e.target.value })} />
            <Select label="Unidad base" value={edit.base_unit} disabled={Boolean(edit.id)} onChange={(e) => setEdit({ ...edit, base_unit: e.target.value as Ingredient['base_unit'] })}>
              <option value="g">Gramos (se compra en g o kg)</option><option value="ml">Mililitros (ml o l)</option><option value="unit">Unidades</option>
            </Select>
            <Input label={`Stock mínimo (${UNIT[edit.base_unit ?? 'g']})`} inputMode="decimal" value={String(edit.min_stock ?? '')} onChange={(e) => setEdit({ ...edit, min_stock: Number(e.target.value) })} />
            <div className="flex flex-col justify-end gap-2">
              <Toggle checked={edit.is_critical ?? false} onChange={(v) => setEdit({ ...edit, is_critical: v })} label="Crítico (en 0 apaga productos automáticos)" />
              <Toggle checked={edit.is_active ?? true} onChange={(v) => setEdit({ ...edit, is_active: v })} label="Activo" />
            </div>
            <div className="sm:col-span-2"><Alert>{error}</Alert></div>
            <Btn className="sm:col-span-2" onClick={save}>Guardar</Btn>
          </div>
        </Modal>
      )}
      {adjust && <AdjustModal ing={adjust} onClose={() => setAdjust(null)} onDone={refresh} />}
    </Card>
  )
}

function AdjustModal({ ing, onClose, onDone }: { ing: Ingredient; onClose: () => void; onDone: () => void }) {
  const [type, setType] = useState('count')
  const [qty, setQty] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const save = async () => {
    setError(null)
    const { error } = await db().rpc('adjust_stock', { p_ingredient: ing.id, p_type: type, p_qty: Number(qty.replace(',', '.')), p_reason: reason })
    if (error) return setError(errMsg(error))
    onDone(); onClose()
  }
  return (
    <Modal open onClose={onClose} title={`Ajustar: ${ing.name}`}>
      <div className="grid gap-4">
        <p className="text-sm">Existencia actual: <strong>{fmtQty(ing.stock_qty, ing.base_unit)}</strong></p>
        <Select label="Tipo" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="count">Conteo físico (escribo lo que hay)</option>
          <option value="waste">Merma / dañado (resta)</option>
          <option value="adjustment_out">Salida por ajuste (resta)</option>
          <option value="adjustment_in">Entrada por ajuste (suma)</option>
        </Select>
        <Input label={`Cantidad en ${UNIT[ing.base_unit]}`} inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} />
        <Input label="Motivo (obligatorio)" value={reason} onChange={(e) => setReason(e.target.value)} />
        <Alert>{error}</Alert>
        <Btn onClick={save} disabled={!qty || reason.trim().length < 3}>Registrar</Btn>
      </div>
    </Modal>
  )
}

/* ── Recetas ─────────────────────────────────────────────────────── */

interface Target { key: string; label: string; field: 'product_id' | 'variant_id' | 'modifier_option_id'; id: string }

function RecipesTab({ ingredients }: { ingredients: Ingredient[] }) {
  const qc = useQueryClient()
  const { can } = usePermissions()
  const targets = useQuery({ queryKey: ['recipe-targets'], queryFn: async (): Promise<Target[]> => {
    const [p, o] = await Promise.all([
      db().from('products').select('id, name, product_variants(id, name)').eq('is_archived', false).order('name'),
      db().from('modifier_options').select('id, name, modifier_groups(name)').order('name'),
    ])
    if (p.error) throw p.error
    if (o.error) throw o.error
    const out: Target[] = []
    for (const pr of p.data as { id: string; name: string; product_variants: { id: string; name: string }[] }[]) {
      if (pr.product_variants.length === 0) out.push({ key: `p:${pr.id}`, label: pr.name, field: 'product_id', id: pr.id })
      else for (const v of pr.product_variants) out.push({ key: `v:${v.id}`, label: `${pr.name} · ${v.name}`, field: 'variant_id', id: v.id })
    }
    for (const op of o.data as unknown as { id: string; name: string; modifier_groups: { name: string } | null }[]) out.push({ key: `o:${op.id}`, label: `Opción: ${op.modifier_groups?.name ?? ''} · ${op.name}`, field: 'modifier_option_id', id: op.id })
    return out
  } })
  const [sel, setSel] = useState('')
  const target = targets.data?.find((t) => t.key === sel)
  const items = useQuery({ queryKey: ['recipe', sel], enabled: Boolean(target), queryFn: async () => {
    const { data, error } = await db().from('recipe_items').select('id, ingredient_id, quantity, waste_pct').eq(target!.field, target!.id)
    if (error) throw error
    return data as { id: string; ingredient_id: string; quantity: number; waste_pct: number }[]
  } })
  const [n, setN] = useState({ ingredient_id: '', quantity: '', waste_pct: '0' })
  const [error, setError] = useState<string | null>(null)
  const byId = new Map(ingredients.map((i) => [i.id, i]))
  const cost = (items.data ?? []).reduce((s, r) => s + Number(r.quantity) * (1 + Number(r.waste_pct) / 100) * (byId.get(r.ingredient_id)?.avg_cost ?? 0), 0)
  const refresh = () => qc.invalidateQueries({ queryKey: ['recipe', sel] })

  const add = async () => {
    if (!target) return
    setError(null)
    const { error } = await db().from('recipe_items').insert({ [target.field]: target.id, ingredient_id: n.ingredient_id, quantity: Number(n.quantity.replace(',', '.')), waste_pct: Number(n.waste_pct) || 0 })
    if (error) return setError(errMsg(error))
    setN({ ingredient_id: '', quantity: '', waste_pct: '0' }); refresh()
  }
  const del = async (id: string) => { const { error } = await db().from('recipe_items').delete().eq('id', id); if (error) setError(errMsg(error)); else refresh() }

  return (
    <Card title="Receta por producto, presentación u opción">
      <p className="mb-3 text-sm text-piedra">Cantidades por <strong>una</strong> unidad vendida, en la unidad base del ingrediente. Si una presentación tiene receta, se usa esa; las opciones (ej. la salsa) suman la suya.</p>
      <Select value={sel} onChange={(e) => setSel(e.target.value)}>
        <option value="">Elige qué quieres configurar…</option>
        {targets.data?.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
      </Select>
      {target && (
        <div className="mt-5">
          <Table head={['Ingrediente', 'Cantidad', 'Merma', 'Costo', '']} empty={items.data?.length === 0 && 'Sin ingredientes todavía.'}>
            {(items.data ?? []).map((r) => {
              const i = byId.get(r.ingredient_id)
              return (
                <tr key={r.id}><td>{i?.name}</td><td className="price">{i ? fmtQty(Number(r.quantity), i.base_unit) : r.quantity}</td><td>{Number(r.waste_pct)}%</td>
                  <td className="price">{formatCOP(Number(r.quantity) * (1 + Number(r.waste_pct) / 100) * (i?.avg_cost ?? 0))}</td>
                  <td className="text-right">{can('recipes.manage') && <Btn variant="danger" size="sm" onClick={() => del(r.id)}><Trash2 /></Btn>}</td></tr>
              )
            })}
          </Table>
          <p className="mt-3 text-right text-sm">Costo estimado por unidad: <strong className="price">{formatCOP(cost)}</strong></p>
          {can('recipes.manage') && (
            <div className="mt-4 grid grid-cols-[1fr_120px_90px_auto] items-end gap-2">
              <Select label="Ingrediente" value={n.ingredient_id} onChange={(e) => setN({ ...n, ingredient_id: e.target.value })}>
                <option value="">Elige…</option>{ingredients.filter((i) => i.is_active).map((i) => <option key={i.id} value={i.id}>{i.name} ({UNIT[i.base_unit]})</option>)}
              </Select>
              <Input label="Cantidad" inputMode="decimal" value={n.quantity} onChange={(e) => setN({ ...n, quantity: e.target.value })} />
              <Input label="Merma %" inputMode="decimal" value={n.waste_pct} onChange={(e) => setN({ ...n, waste_pct: e.target.value })} />
              <Btn onClick={add} disabled={!n.ingredient_id || !n.quantity}><Plus /></Btn>
            </div>
          )}
          <div className="mt-3"><Alert>{error}</Alert></div>
        </div>
      )}
    </Card>
  )
}

function MovementsTab({ ingredients }: { ingredients: Ingredient[] }) {
  const [filter, setFilter] = useState('')
  const q = useQuery({ queryKey: ['movements', filter], queryFn: async () => {
    let r = db().from('inventory_movements').select('id, ingredient_id, type, qty_base, balance_after, unit_cost, reason, created_at, orders(number), purchases(number)').order('created_at', { ascending: false }).limit(200)
    if (filter) r = r.eq('ingredient_id', filter)
    const { data, error } = await r
    if (error) throw error
    return data as unknown as { id: number; ingredient_id: string; type: string; qty_base: number; balance_after: number; unit_cost: number; reason: string | null; created_at: string; orders: { number: number } | null; purchases: { number: number } | null }[]
  } })
  const byId = new Map(ingredients.map((i) => [i.id, i]))
  const TYPE: Record<string, string> = { purchase: 'Compra', sale_consumption: 'Venta', sale_reversal: 'Reintegro', adjustment_in: 'Ajuste +', adjustment_out: 'Ajuste −', waste: 'Merma', count: 'Conteo' }
  return (
    <Card title="Kardex (últimos 200 movimientos)" actions={<Select value={filter} onChange={(e) => setFilter(e.target.value)}><option value="">Todos los ingredientes</option>{ingredients.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</Select>}>
      {q.error && <ErrorState error={q.error} />}
      <Table head={['Fecha', 'Ingrediente', 'Tipo', 'Cantidad', 'Saldo', 'Referencia']} empty={q.data?.length === 0 && 'Sin movimientos.'}>
        {(q.data ?? []).map((m) => {
          const i = byId.get(m.ingredient_id)
          return (
            <tr key={m.id}>
              <td className="whitespace-nowrap text-xs text-piedra">{new Date(m.created_at).toLocaleString('es-CO', { timeZone: 'America/Bogota', dateStyle: 'short', timeStyle: 'short' })}</td>
              <td>{i?.name}</td><td><Badge tone={Number(m.qty_base) >= 0 ? 'green' : 'neutral'}>{TYPE[m.type] ?? m.type}</Badge></td>
              <td className="price">{i ? fmtQty(Number(m.qty_base), i.base_unit) : m.qty_base}</td>
              <td className="price text-piedra">{i ? fmtQty(Number(m.balance_after), i.base_unit) : m.balance_after}</td>
              <td className="text-xs text-piedra">{m.orders ? `Pedido #${m.orders.number}` : m.purchases ? `Compra #${m.purchases.number}` : m.reason}</td>
            </tr>
          )
        })}
      </Table>
    </Card>
  )
}
