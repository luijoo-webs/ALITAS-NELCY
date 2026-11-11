import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { db } from '@/lib/supabase'
import { formatCOP } from '@/lib/format'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { ErrorState, Skeleton } from '@/components/shared/states'
import { Alert, Btn, Card, Input, Modal, Page, PageHeader, Select, Table, Textarea, errMsg } from '../components/ui'
import { fetchIngredients, type Ingredient } from './InventoryPage'

interface Supplier { id: string; name: string; nit: string | null; contact: string | null; phone: string | null; notes: string | null; is_active: boolean }

const unitsFor = (u: Ingredient['base_unit']) => (u === 'g' ? ['kg', 'g'] : u === 'ml' ? ['l', 'ml'] : ['unit'])

export function PurchasesPage() {
  useDocumentTitle('Compras')
  const qc = useQueryClient()
  const sup = useQuery({ queryKey: ['suppliers'], queryFn: async () => {
    const { data, error } = await db().from('suppliers').select('*').order('name')
    if (error) throw error
    return data as Supplier[]
  } })
  const ing = useQuery({ queryKey: ['ingredients'], queryFn: fetchIngredients })
  const purchases = useQuery({ queryKey: ['purchases'], queryFn: async () => {
    const { data, error } = await db().from('purchases').select('id, number, invoice_ref, purchased_at, total, suppliers(name), purchase_items(quantity, unit, line_total, ingredients(name))').order('purchased_at', { ascending: false }).limit(100)
    if (error) throw error
    return data as unknown as { id: string; number: number; invoice_ref: string | null; purchased_at: string; total: number; suppliers: { name: string } | null;
      purchase_items: { quantity: number; unit: string; line_total: number; ingredients: { name: string } | null }[] }[]
  } })
  const [newPurchase, setNewPurchase] = useState(false)
  const [editSup, setEditSup] = useState<Partial<Supplier> | null>(null)
  const [error, setError] = useState<string | null>(null)

  const saveSup = async () => {
    if (!editSup) return
    setError(null)
    const row = { name: editSup.name?.trim(), nit: editSup.nit || null, contact: editSup.contact || null, phone: editSup.phone || null, notes: editSup.notes || null, is_active: editSup.is_active ?? true }
    const { error } = editSup.id ? await db().from('suppliers').update(row).eq('id', editSup.id) : await db().from('suppliers').insert(row)
    if (error) return setError(errMsg(error))
    qc.invalidateQueries({ queryKey: ['suppliers'] }); setEditSup(null)
  }

  return (
    <Page>
      <PageHeader title="Compras" subtitle="Registrar una compra suma existencias y actualiza el costo promedio." actions={<Btn variant="accent" onClick={() => setNewPurchase(true)} disabled={!ing.data?.length}><Plus /> Registrar compra</Btn>} />
      {ing.data?.length === 0 && <div className="mt-4"><Alert tone="info">Primero crea los ingredientes en Inventario.</Alert></div>}
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Card title="Compras recientes">
          {purchases.error && <ErrorState error={purchases.error} />}
          {purchases.isPending && <Skeleton className="h-40" />}
          <Table head={['#', 'Fecha', 'Proveedor', 'Detalle', 'Total']} empty={purchases.data?.length === 0 && 'Sin compras registradas.'}>
            {(purchases.data ?? []).map((p) => (
              <tr key={p.id}>
                <td>{p.number}</td><td className="whitespace-nowrap text-xs text-piedra">{new Date(p.purchased_at).toLocaleDateString('es-CO')}</td>
                <td>{p.suppliers?.name ?? '—'}{p.invoice_ref && <span className="block text-xs text-piedra">Fact. {p.invoice_ref}</span>}</td>
                <td className="text-xs text-piedra">{p.purchase_items.map((i) => `${i.ingredients?.name} ${Number(i.quantity)} ${i.unit === 'unit' ? 'und' : i.unit}`).join(', ')}</td>
                <td className="price font-medium">{formatCOP(p.total)}</td>
              </tr>
            ))}
          </Table>
        </Card>
        <Card title="Proveedores" actions={<Btn size="sm" variant="outline" onClick={() => setEditSup({ is_active: true })}><Plus /> Proveedor</Btn>}>
          <ul className="divide-y divide-carbon/8 text-sm">
            {(sup.data ?? []).length === 0 && <li className="py-4 text-center text-piedra">Sin proveedores.</li>}
            {(sup.data ?? []).map((s) => (
              <li key={s.id} className="flex items-center justify-between py-2.5">
                <span><span className="font-medium">{s.name}</span><span className="block text-xs text-piedra">{[s.contact, s.phone].filter(Boolean).join(' · ')}</span></span>
                <Btn variant="ghost" size="sm" onClick={() => setEditSup(s)}><Pencil /></Btn>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {editSup && (
        <Modal open onClose={() => setEditSup(null)} title={editSup.id ? 'Editar proveedor' : 'Nuevo proveedor'}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Nombre" className="sm:col-span-2" value={editSup.name ?? ''} onChange={(e) => setEditSup({ ...editSup, name: e.target.value })} />
            <Input label="NIT" value={editSup.nit ?? ''} onChange={(e) => setEditSup({ ...editSup, nit: e.target.value })} />
            <Input label="Celular" value={editSup.phone ?? ''} onChange={(e) => setEditSup({ ...editSup, phone: e.target.value })} />
            <Input label="Contacto" className="sm:col-span-2" value={editSup.contact ?? ''} onChange={(e) => setEditSup({ ...editSup, contact: e.target.value })} />
            <Textarea label="Notas" className="sm:col-span-2" value={editSup.notes ?? ''} onChange={(e) => setEditSup({ ...editSup, notes: e.target.value })} />
            <div className="sm:col-span-2"><Alert>{error}</Alert></div>
            <Btn className="sm:col-span-2" onClick={saveSup}>Guardar</Btn>
          </div>
        </Modal>
      )}
      {newPurchase && ing.data && <PurchaseForm ingredients={ing.data.filter((i) => i.is_active)} suppliers={(sup.data ?? []).filter((s) => s.is_active)} onClose={() => setNewPurchase(false)} />}
    </Page>
  )
}

function PurchaseForm({ ingredients, suppliers, onClose }: { ingredients: Ingredient[]; suppliers: Supplier[]; onClose: () => void }) {
  const qc = useQueryClient()
  const [supplier, setSupplier] = useState('')
  const [invoice, setInvoice] = useState('')
  const [rows, setRows] = useState([{ ingredient_id: '', quantity: '', unit: '', line_total: '' }])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const total = rows.reduce((s, r) => s + (Number(r.line_total.replace(/\D/g, '')) || 0), 0)

  const save = async () => {
    setBusy(true); setError(null)
    try {
      const items = rows.filter((r) => r.ingredient_id).map((r) => {
        const ing = ingredients.find((i) => i.id === r.ingredient_id)!
        return { ingredient_id: r.ingredient_id, quantity: Number(r.quantity.replace(',', '.')), unit: r.unit || unitsFor(ing.base_unit)[0], line_total: Number(r.line_total.replace(/\D/g, '')) }
      })
      if (!items.length) throw new Error('Agrega al menos un ingrediente.')
      const { error } = await db().rpc('register_purchase', { p_supplier: supplier || null, p_invoice: invoice || null, p_items: items, p_notes: null })
      if (error) throw error
      await Promise.all(['purchases', 'ingredients', 'inv-alerts', 'menu'].map((k) => qc.invalidateQueries({ queryKey: [k] })))
      onClose()
    } catch (e) { setError(errMsg(e)) } finally { setBusy(false) }
  }

  return (
    <Modal open onClose={onClose} title="Registrar compra" wide>
      <div className="grid gap-4 sm:grid-cols-2">
        <Select label="Proveedor (opcional)" value={supplier} onChange={(e) => setSupplier(e.target.value)}><option value="">Sin proveedor</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
        <Input label="N.º de factura (opcional)" value={invoice} onChange={(e) => setInvoice(e.target.value)} />
      </div>
      <div className="mt-5 space-y-2">
        {rows.map((r, i) => {
          const ing = ingredients.find((x) => x.id === r.ingredient_id)
          const upd = (patch: Partial<typeof r>) => setRows((l) => l.map((x, j) => (j === i ? { ...x, ...patch } : x)))
          return (
            <div key={i} className="grid grid-cols-2 items-end gap-2 sm:grid-cols-[2fr_1fr_90px_1fr_auto]">
              <Select label={i === 0 ? 'Ingrediente' : undefined} className="col-span-2 sm:col-span-1" value={r.ingredient_id} onChange={(e) => upd({ ingredient_id: e.target.value, unit: '' })}>
                <option value="">Elige…</option>{ingredients.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              </Select>
              <Input label={i === 0 ? 'Cantidad' : undefined} inputMode="decimal" value={r.quantity} onChange={(e) => upd({ quantity: e.target.value })} />
              <Select label={i === 0 ? 'Unidad' : undefined} value={r.unit || (ing ? unitsFor(ing.base_unit)[0] : '')} onChange={(e) => upd({ unit: e.target.value })} disabled={!ing}>
                {ing && unitsFor(ing.base_unit).map((u) => <option key={u} value={u}>{u === 'unit' ? 'und' : u}</option>)}
              </Select>
              <Input label={i === 0 ? 'Valor total (COP)' : undefined} inputMode="numeric" value={r.line_total} onChange={(e) => upd({ line_total: e.target.value })} />
              <Btn variant="danger" size="sm" className="mb-1" onClick={() => setRows((l) => l.filter((_, j) => j !== i))} disabled={rows.length === 1}><Trash2 /></Btn>
            </div>
          )
        })}
        <Btn size="sm" variant="outline" onClick={() => setRows((l) => [...l, { ingredient_id: '', quantity: '', unit: '', line_total: '' }])}><Plus /> Otro ingrediente</Btn>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-lg font-semibold">Total: <span className="price">{formatCOP(total)}</span></p>
        <Btn variant="accent" onClick={save} disabled={busy}>{busy ? 'Guardando…' : 'Registrar compra'}</Btn>
      </div>
      <div className="mt-3"><Alert>{error}</Alert></div>
    </Modal>
  )
}
