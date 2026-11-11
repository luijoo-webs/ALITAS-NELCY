import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ImagePlus, Pencil, Plus, Trash2 } from 'lucide-react'
import { db, publicImageUrl } from '@/lib/supabase'
import { formatCOP } from '@/lib/format'
import { cn } from '@/lib/cn'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { ErrorState, Skeleton } from '@/components/shared/states'
import { Alert, Badge, Btn, Card, Input, Modal, Page, PageHeader, Select, Table, Textarea, Toggle, errMsg, slugify } from '../components/ui'

interface Cat { id: string; name: string; slug: string; description: string | null; sort_order: number; is_active: boolean }
interface Variant { id?: string; name: string; price: number; is_default: boolean; is_active: boolean; sort_order: number }
interface Prod {
  id: string; category_id: string; name: string; slug: string; description: string | null; base_price: number
  is_available: boolean; availability_mode: 'manual' | 'auto_by_stock'; is_featured: boolean; is_archived: boolean
  allergens: string[]; sort_order: number
  product_variants: Variant[]; product_modifier_groups: { group_id: string }[]; product_images: { id: string; storage_path: string; sort_order: number }[]
}
interface Group { id: string; name: string; description: string | null; min_select: number; max_select: number; is_active: boolean
  modifier_options: { id: string; name: string; price_delta: number; is_active: boolean; sort_order: number }[] }
interface Promo { id: string; name: string; description: string | null; type: 'percent' | 'fixed' | 'label'; value: number; label: string | null
  starts_at: string | null; ends_at: string | null; is_active: boolean; promotion_products: { product_id: string }[] }

async function fetchCatalog() {
  const [c, p, g, pr] = await Promise.all([
    db().from('categories').select('*').order('sort_order'),
    db().from('products').select('*, product_variants(*), product_modifier_groups(group_id), product_images(id, storage_path, sort_order)').order('sort_order'),
    db().from('modifier_groups').select('*, modifier_options(*)').order('name'),
    db().from('promotions').select('*, promotion_products(product_id)').order('created_at', { ascending: false }),
  ])
  for (const r of [c, p, g, pr]) if (r.error) throw r.error
  return { cats: c.data as Cat[], prods: p.data as Prod[], groups: g.data as Group[], promos: pr.data as Promo[] }
}

const TABS = ['Productos', 'Categorías', 'Opciones', 'Promociones'] as const

export function CatalogPage() {
  useDocumentTitle('Menú y productos')
  const q = useQuery({ queryKey: ['admin-catalog'], queryFn: fetchCatalog })
  const [tab, setTab] = useState<(typeof TABS)[number]>('Productos')
  return (
    <Page>
      <PageHeader title="Menú y productos" subtitle="Lo que publiques aquí aparece en el sitio al instante." />
      <div className="mt-6 flex gap-1 overflow-x-auto rounded-lg bg-carbon/5 p-1">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={cn('rounded-md px-4 py-2 text-sm font-medium whitespace-nowrap', tab === t ? 'bg-white shadow-sm' : 'text-carbon/70')}>{t}</button>
        ))}
      </div>
      {q.error && <ErrorState error={q.error} className="mt-6 bg-white" />}
      {q.isPending && <Skeleton className="mt-6 h-80" />}
      {q.data && (
        <div className="mt-6">
          {tab === 'Productos' && <ProductsTab data={q.data} />}
          {tab === 'Categorías' && <CategoriesTab cats={q.data.cats} />}
          {tab === 'Opciones' && <GroupsTab groups={q.data.groups} />}
          {tab === 'Promociones' && <PromosTab promos={q.data.promos} prods={q.data.prods} />}
        </div>
      )}
    </Page>
  )
}

const useRefresh = () => {
  const qc = useQueryClient()
  return () => Promise.all([qc.invalidateQueries({ queryKey: ['admin-catalog'] }), qc.invalidateQueries({ queryKey: ['menu'] })])
}

/* ── Productos ───────────────────────────────────────────────────── */

function ProductsTab({ data }: { data: Awaited<ReturnType<typeof fetchCatalog>> }) {
  const [editing, setEditing] = useState<Prod | 'new' | null>(null)
  const [filter, setFilter] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const list = data.prods.filter((p) => (showArchived || !p.is_archived) && (!filter || p.category_id === filter))
  return (
    <Card actions={<div className="flex flex-wrap items-center gap-3">
      <Toggle checked={showArchived} onChange={setShowArchived} label="Ver archivados" />
      <Select value={filter} onChange={(e) => setFilter(e.target.value)}><option value="">Todas las categorías</option>{data.cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
      <Btn onClick={() => setEditing('new')} disabled={data.cats.length === 0}><Plus /> Producto</Btn>
    </div>}>
      {data.cats.length === 0 && <Alert tone="info">Primero crea una categoría (pestaña Categorías).</Alert>}
      <Table head={['Producto', 'Categoría', 'Precio', 'Estado', '']} empty={list.length === 0 && 'Aún no hay productos.'}>
        {list.map((p) => {
          const prices = p.product_variants.filter((v) => v.is_active).map((v) => Number(v.price))
          return (
            <tr key={p.id} className={cn(p.is_archived && 'opacity-50')}>
              <td className="font-medium">{p.name}{p.is_featured && <Badge tone="yellow">Destacado</Badge>}</td>
              <td className="text-piedra">{data.cats.find((c) => c.id === p.category_id)?.name}</td>
              <td className="price">{prices.length ? `${prices.length > 1 ? 'desde ' : ''}${formatCOP(Math.min(...prices))}` : formatCOP(p.base_price)}</td>
              <td>{p.is_archived ? <Badge>Archivado</Badge> : p.is_available ? <Badge tone="green">Disponible</Badge> : <Badge tone="red">Agotado</Badge>}
                {p.availability_mode === 'auto_by_stock' && <span className="ml-1 text-xs text-piedra">auto</span>}</td>
              <td className="text-right"><Btn variant="ghost" size="sm" onClick={() => setEditing(p)}><Pencil /> Editar</Btn></td>
            </tr>
          )
        })}
      </Table>
      {editing && <ProductEditor product={editing === 'new' ? null : editing} cats={data.cats} groups={data.groups} onClose={() => setEditing(null)} />}
    </Card>
  )
}

function ProductEditor({ product, cats, groups, onClose }: { product: Prod | null; cats: Cat[]; groups: Group[]; onClose: () => void }) {
  const refresh = useRefresh()
  const [f, setF] = useState(() => ({
    name: product?.name ?? '', slug: product?.slug ?? '', category_id: product?.category_id ?? cats[0]?.id ?? '',
    description: product?.description ?? '', base_price: String(product?.base_price ?? ''), sort_order: String(product?.sort_order ?? 0),
    is_available: product?.is_available ?? true, availability_mode: product?.availability_mode ?? 'manual',
    is_featured: product?.is_featured ?? false, is_archived: product?.is_archived ?? false, allergens: (product?.allergens ?? []).join(', '),
  }))
  const [variants, setVariants] = useState<Variant[]>(() => [...(product?.product_variants ?? [])].sort((a, b) => a.sort_order - b.sort_order).map((v) => ({ ...v, price: Number(v.price) })))
  const [groupIds, setGroupIds] = useState<string[]>(product?.product_modifier_groups.map((g) => g.group_id) ?? [])
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF((x) => ({ ...x, [k]: e.target.value }))

  const save = async () => {
    setBusy(true); setError(null)
    try {
      const price = Number(f.base_price)
      if (!f.name.trim() || !(price >= 0) || f.base_price === '') throw new Error('Nombre y precio son obligatorios.')
      if (variants.some((v) => !v.name.trim() || !(v.price >= 0))) throw new Error('Cada presentación necesita nombre y precio.')
      if (variants.length && !variants.some((v) => v.is_default)) variants[0].is_default = true
      const row = {
        name: f.name.trim(), slug: slugify(f.slug || f.name), category_id: f.category_id, description: f.description.trim() || null,
        base_price: price, sort_order: Number(f.sort_order) || 0, is_available: f.is_available, availability_mode: f.availability_mode,
        is_featured: f.is_featured, is_archived: f.is_archived, allergens: f.allergens.split(',').map((a) => a.trim()).filter(Boolean),
      }
      const { data: saved, error: e1 } = product
        ? await db().from('products').update(row).eq('id', product.id).select('id').single()
        : await db().from('products').insert(row).select('id').single()
      if (e1) throw e1
      const pid = saved.id as string

      // Presentaciones: borrar las quitadas, actualizar e insertar (default al final por el índice único)
      const keep = variants.filter((v) => v.id).map((v) => v.id!)
      const old = product?.product_variants.map((v) => v.id!) ?? []
      const removed = old.filter((id) => !keep.includes(id))
      if (removed.length) { const { error } = await db().from('product_variants').delete().in('id', removed); if (error) throw error }
      if (old.length) { const { error } = await db().from('product_variants').update({ is_default: false }).eq('product_id', pid); if (error) throw error }
      for (const [i, v] of variants.entries()) {
        const vr = { product_id: pid, name: v.name.trim(), price: v.price, is_active: v.is_active, sort_order: i, is_default: false }
        const { error } = v.id ? await db().from('product_variants').update(vr).eq('id', v.id) : await db().from('product_variants').insert(vr).select('id').single().then((r) => { if (r.data) v.id = r.data.id; return r })
        if (error) throw error
      }
      const def = variants.find((v) => v.is_default)
      if (def?.id) { const { error } = await db().from('product_variants').update({ is_default: true }).eq('id', def.id); if (error) throw error }

      // Grupos de opciones
      const { error: e2 } = await db().from('product_modifier_groups').delete().eq('product_id', pid)
      if (e2) throw e2
      if (groupIds.length) {
        const { error } = await db().from('product_modifier_groups').insert(groupIds.map((g, i) => ({ product_id: pid, group_id: g, sort_order: i })))
        if (error) throw error
      }

      // Imagen principal
      if (file) {
        if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 3 * 1024 * 1024) throw new Error('La imagen debe ser JPG, PNG o WEBP de máximo 3 MB.')
        const path = `${pid}/${Date.now()}.${file.type.split('/')[1]}`
        const up = await db().storage.from('product-images').upload(path, file, { contentType: file.type })
        if (up.error) throw up.error
        for (const img of product?.product_images ?? []) {
          await db().storage.from('product-images').remove([img.storage_path])
          await db().from('product_images').delete().eq('id', img.id)
        }
        const { error } = await db().from('product_images').insert({ product_id: pid, storage_path: path, alt: row.name, sort_order: 0 })
        if (error) throw error
      }
      await refresh()
      onClose()
    } catch (e) { setError(errMsg(e)) } finally { setBusy(false) }
  }

  const img = product?.product_images[0]
  return (
    <Modal open onClose={onClose} title={product ? 'Editar producto' : 'Nuevo producto'} wide>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Nombre" value={f.name} onChange={(e) => setF((x) => ({ ...x, name: e.target.value, slug: product ? x.slug : slugify(e.target.value) }))} />
        <Select label="Categoría" value={f.category_id} onChange={set('category_id')}>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
        <Textarea label="Descripción" className="sm:col-span-2" value={f.description} onChange={set('description')} maxLength={500} />
        <Input label="Precio base (COP)" inputMode="numeric" value={f.base_price} onChange={set('base_price')} hint="Se usa si no hay presentaciones." />
        <Input label="Orden" inputMode="numeric" value={f.sort_order} onChange={set('sort_order')} />
        <Input label="Alérgenos (separados por coma)" className="sm:col-span-2" value={f.allergens} onChange={set('allergens')} />
        <Select label="Disponibilidad" value={f.availability_mode} onChange={set('availability_mode')}>
          <option value="manual">Manual</option><option value="auto_by_stock">Automática por inventario</option>
        </Select>
        <div className="flex flex-col justify-end gap-2">
          <Toggle checked={f.is_available} onChange={(v) => setF((x) => ({ ...x, is_available: v }))} label="Disponible" />
          <Toggle checked={f.is_featured} onChange={(v) => setF((x) => ({ ...x, is_featured: v }))} label="Destacado en el inicio" />
          <Toggle checked={f.is_archived} onChange={(v) => setF((x) => ({ ...x, is_archived: v }))} label="Archivado (oculto)" />
        </div>
      </div>

      <div className="mt-6">
        <div className="flex items-center justify-between"><h3 className="font-sans text-sm font-semibold normal-case">Presentaciones (tamaños)</h3>
          <Btn size="sm" variant="outline" onClick={() => setVariants((v) => [...v, { name: '', price: 0, is_default: v.length === 0, is_active: true, sort_order: v.length }])}><Plus /> Agregar</Btn></div>
        <div className="mt-2 space-y-2">
          {variants.map((v, i) => (
            <div key={v.id ?? i} className="grid grid-cols-[1fr_120px_auto_auto] items-center gap-2">
              <Input placeholder="Nombre (ej. 6 alitas)" value={v.name} onChange={(e) => setVariants((l) => l.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
              <Input placeholder="Precio" inputMode="numeric" value={String(v.price || '')} onChange={(e) => setVariants((l) => l.map((x, j) => j === i ? { ...x, price: Number(e.target.value.replace(/\D/g, '')) } : x))} />
              <label className="flex items-center gap-1 text-xs"><input type="radio" name="def" checked={v.is_default} onChange={() => setVariants((l) => l.map((x, j) => ({ ...x, is_default: j === i })))} /> Pred.</label>
              <Btn variant="danger" size="sm" onClick={() => setVariants((l) => l.filter((_, j) => j !== i))} aria-label="Quitar"><Trash2 /></Btn>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6">
        <h3 className="font-sans text-sm font-semibold normal-case">Opciones que el cliente elige</h3>
        {groups.length === 0 ? <p className="mt-1 text-sm text-piedra">Crea grupos (ej. “Salsa”) en la pestaña Opciones.</p> : (
          <div className="mt-2 flex flex-wrap gap-2">
            {groups.map((g) => {
              const on = groupIds.includes(g.id)
              return <button key={g.id} type="button" onClick={() => setGroupIds((l) => on ? l.filter((x) => x !== g.id) : [...l, g.id])}
                className={cn('rounded-full border px-3 py-1.5 text-sm', on ? 'border-carbon bg-carbon text-hueso' : 'border-carbon/20')}>{g.name}</button>
            })}
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        {img && !file && <img src={publicImageUrl(img.storage_path)} alt="" className="size-20 rounded-lg object-cover" />}
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-carbon/30 px-4 py-3 text-sm">
          <ImagePlus className="size-4" /> {file ? file.name : img ? 'Cambiar foto' : 'Subir foto'}
          <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
      </div>

      <div className="mt-6 space-y-3"><Alert>{error}</Alert>
        <div className="flex justify-end gap-2"><Btn variant="outline" onClick={onClose}>Cancelar</Btn><Btn onClick={save} disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</Btn></div>
      </div>
    </Modal>
  )
}

/* ── Categorías ──────────────────────────────────────────────────── */

function CategoriesTab({ cats }: { cats: Cat[] }) {
  const refresh = useRefresh()
  const [edit, setEdit] = useState<Partial<Cat> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const save = async () => {
    setError(null)
    try {
      if (!edit?.name?.trim()) throw new Error('Escribe el nombre.')
      const row = { name: edit.name.trim(), slug: slugify(edit.name), description: edit.description || null, sort_order: Number(edit.sort_order) || 0, is_active: edit.is_active ?? true }
      const { error } = edit.id ? await db().from('categories').update(row).eq('id', edit.id) : await db().from('categories').insert(row)
      if (error) throw error
      await refresh(); setEdit(null)
    } catch (e) { setError(errMsg(e)) }
  }
  const remove = async (c: Cat) => {
    if (!confirm(`¿Eliminar la categoría "${c.name}"? Solo es posible si no tiene productos.`)) return
    const { error } = await db().from('categories').delete().eq('id', c.id)
    if (error) alert(errMsg(error)); else refresh()
  }
  return (
    <Card actions={<Btn onClick={() => setEdit({ is_active: true, sort_order: cats.length })}><Plus /> Categoría</Btn>}>
      <Table head={['Nombre', 'Orden', 'Estado', '']} empty={cats.length === 0 && 'Aún no hay categorías.'}>
        {cats.map((c) => (
          <tr key={c.id}><td className="font-medium">{c.name}</td><td>{c.sort_order}</td>
            <td>{c.is_active ? <Badge tone="green">Visible</Badge> : <Badge>Oculta</Badge>}</td>
            <td className="text-right"><Btn variant="ghost" size="sm" onClick={() => setEdit(c)}><Pencil /></Btn><Btn variant="danger" size="sm" onClick={() => remove(c)}><Trash2 /></Btn></td></tr>
        ))}
      </Table>
      {edit && (
        <Modal open onClose={() => setEdit(null)} title={edit.id ? 'Editar categoría' : 'Nueva categoría'}>
          <div className="grid gap-4">
            <Input label="Nombre" value={edit.name ?? ''} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            <Textarea label="Descripción" value={edit.description ?? ''} onChange={(e) => setEdit({ ...edit, description: e.target.value })} />
            <Input label="Orden" inputMode="numeric" value={String(edit.sort_order ?? 0)} onChange={(e) => setEdit({ ...edit, sort_order: Number(e.target.value) || 0 })} />
            <Toggle checked={edit.is_active ?? true} onChange={(v) => setEdit({ ...edit, is_active: v })} label="Visible en el menú" />
            <Alert>{error}</Alert>
            <Btn onClick={save}>Guardar</Btn>
          </div>
        </Modal>
      )}
    </Card>
  )
}

/* ── Grupos de opciones (salsas, principios, adicionales) ───────── */

function GroupsTab({ groups }: { groups: Group[] }) {
  const refresh = useRefresh()
  const [edit, setEdit] = useState<Group | null>(null)
  const [error, setError] = useState<string | null>(null)
  const blank: Group = { id: '', name: '', description: null, min_select: 0, max_select: 1, is_active: true, modifier_options: [] }
  const save = async () => {
    if (!edit) return
    setError(null)
    try {
      if (!edit.name.trim()) throw new Error('Escribe el nombre del grupo.')
      const row = { name: edit.name.trim(), description: edit.description, min_select: edit.min_select, max_select: edit.max_select, is_active: edit.is_active }
      const r = edit.id ? await db().from('modifier_groups').update(row).eq('id', edit.id).select('id').single() : await db().from('modifier_groups').insert(row).select('id').single()
      if (r.error) throw r.error
      const gid = r.data.id as string
      const old = groups.find((g) => g.id === gid)?.modifier_options.map((o) => o.id) ?? []
      const keep = edit.modifier_options.filter((o) => o.id).map((o) => o.id)
      const gone = old.filter((id) => !keep.includes(id))
      if (gone.length) { const { error } = await db().from('modifier_options').delete().in('id', gone); if (error) throw error }
      for (const [i, o] of edit.modifier_options.entries()) {
        if (!o.name.trim()) continue
        const orow = { group_id: gid, name: o.name.trim(), price_delta: o.price_delta || 0, is_active: o.is_active, sort_order: i }
        const { error } = o.id ? await db().from('modifier_options').update(orow).eq('id', o.id) : await db().from('modifier_options').insert(orow)
        if (error) throw error
      }
      await refresh(); setEdit(null)
    } catch (e) { setError(errMsg(e)) }
  }
  return (
    <Card actions={<Btn onClick={() => setEdit(blank)}><Plus /> Grupo de opciones</Btn>}>
      <Table head={['Grupo', 'Selección', 'Opciones', '']} empty={groups.length === 0 && 'Ej.: “Salsa” (obligatorio, elige 1) o “Adicionales” (opcional).'}>
        {groups.map((g) => (
          <tr key={g.id}><td className="font-medium">{g.name}</td><td>{g.min_select}–{g.max_select}</td>
            <td className="text-piedra">{g.modifier_options.map((o) => o.name).join(', ')}</td>
            <td className="text-right"><Btn variant="ghost" size="sm" onClick={() => setEdit({ ...g, modifier_options: [...g.modifier_options].sort((a, b) => a.sort_order - b.sort_order) })}><Pencil /></Btn></td></tr>
        ))}
      </Table>
      {edit && (
        <Modal open onClose={() => setEdit(null)} title={edit.id ? 'Editar grupo' : 'Nuevo grupo'}>
          <div className="grid gap-4">
            <Input label="Nombre (ej. Salsa)" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Mínimo a elegir" inputMode="numeric" value={String(edit.min_select)} onChange={(e) => setEdit({ ...edit, min_select: Number(e.target.value) || 0 })} />
              <Input label="Máximo a elegir" inputMode="numeric" value={String(edit.max_select)} onChange={(e) => setEdit({ ...edit, max_select: Math.max(1, Number(e.target.value) || 1) })} />
            </div>
            <div>
              <div className="flex items-center justify-between"><span className="text-sm font-semibold">Opciones</span>
                <Btn size="sm" variant="outline" onClick={() => setEdit({ ...edit, modifier_options: [...edit.modifier_options, { id: '', name: '', price_delta: 0, is_active: true, sort_order: edit.modifier_options.length }] })}><Plus /> Opción</Btn></div>
              <div className="mt-2 space-y-2">
                {edit.modifier_options.map((o, i) => (
                  <div key={o.id || i} className="grid grid-cols-[1fr_110px_auto] gap-2">
                    <Input placeholder="Nombre" value={o.name} onChange={(e) => setEdit({ ...edit, modifier_options: edit.modifier_options.map((x, j) => j === i ? { ...x, name: e.target.value } : x) })} />
                    <Input placeholder="+ precio" inputMode="numeric" value={String(o.price_delta || '')} onChange={(e) => setEdit({ ...edit, modifier_options: edit.modifier_options.map((x, j) => j === i ? { ...x, price_delta: Number(e.target.value.replace(/\D/g, '')) } : x) })} />
                    <Btn variant="danger" size="sm" onClick={() => setEdit({ ...edit, modifier_options: edit.modifier_options.filter((_, j) => j !== i) })}><Trash2 /></Btn>
                  </div>
                ))}
              </div>
            </div>
            <Toggle checked={edit.is_active} onChange={(v) => setEdit({ ...edit, is_active: v })} label="Activo" />
            <Alert>{error}</Alert>
            <Btn onClick={save}>Guardar</Btn>
          </div>
        </Modal>
      )}
    </Card>
  )
}

/* ── Promociones ─────────────────────────────────────────────────── */

function PromosTab({ promos, prods }: { promos: Promo[]; prods: Prod[] }) {
  const refresh = useRefresh()
  const [edit, setEdit] = useState<(Partial<Promo> & { productIds: string[] }) | null>(null)
  const [error, setError] = useState<string | null>(null)
  const toLocal = (iso: string | null | undefined) => (iso ? new Date(iso).toISOString().slice(0, 16) : '')
  const save = async () => {
    if (!edit) return
    setError(null)
    try {
      if (!edit.name?.trim()) throw new Error('Escribe el nombre.')
      const type = edit.type ?? 'percent'
      const row = { name: edit.name.trim(), description: edit.description || null, type, value: type === 'label' ? 0 : Number(edit.value) || 0, label: edit.label || null,
        starts_at: edit.starts_at || null, ends_at: edit.ends_at || null, is_active: edit.is_active ?? true }
      const r = edit.id ? await db().from('promotions').update(row).eq('id', edit.id).select('id').single() : await db().from('promotions').insert(row).select('id').single()
      if (r.error) throw r.error
      await db().from('promotion_products').delete().eq('promotion_id', r.data.id)
      if (edit.productIds.length) {
        const { error } = await db().from('promotion_products').insert(edit.productIds.map((p) => ({ promotion_id: r.data.id, product_id: p })))
        if (error) throw error
      }
      await refresh(); setEdit(null)
    } catch (e) { setError(errMsg(e)) }
  }
  return (
    <Card actions={<Btn onClick={() => setEdit({ type: 'percent', is_active: true, productIds: [] })}><Plus /> Promoción</Btn>}>
      <Table head={['Promoción', 'Descuento', 'Vigencia', 'Estado', '']} empty={promos.length === 0 && 'Sin promociones.'}>
        {promos.map((p) => (
          <tr key={p.id}><td className="font-medium">{p.name}</td>
            <td>{p.type === 'percent' ? `${p.value}%` : p.type === 'fixed' ? formatCOP(p.value) : p.label ?? 'Etiqueta'}</td>
            <td className="text-xs text-piedra">{p.ends_at ? `Hasta ${new Date(p.ends_at).toLocaleDateString('es-CO')}` : 'Sin fecha fin'}</td>
            <td>{p.is_active ? <Badge tone="green">Activa</Badge> : <Badge>Inactiva</Badge>}</td>
            <td className="text-right"><Btn variant="ghost" size="sm" onClick={() => setEdit({ ...p, productIds: p.promotion_products.map((x) => x.product_id) })}><Pencil /></Btn></td></tr>
        ))}
      </Table>
      {edit && (
        <Modal open onClose={() => setEdit(null)} title={edit.id ? 'Editar promoción' : 'Nueva promoción'}>
          <div className="grid gap-4">
            <Input label="Nombre" value={edit.name ?? ''} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <Select label="Tipo" value={edit.type} onChange={(e) => setEdit({ ...edit, type: e.target.value as Promo['type'] })}>
                <option value="percent">Porcentaje</option><option value="fixed">Valor fijo</option><option value="label">Solo etiqueta</option>
              </Select>
              {edit.type !== 'label' && <Input label={edit.type === 'percent' ? '% de descuento' : 'Descuento (COP)'} inputMode="numeric" value={String(edit.value ?? '')} onChange={(e) => setEdit({ ...edit, value: Number(e.target.value) })} />}
            </div>
            <Input label="Etiqueta visible (opcional, ej. 2x1)" value={edit.label ?? ''} onChange={(e) => setEdit({ ...edit, label: e.target.value })} maxLength={30} />
            <Textarea label="Descripción" value={edit.description ?? ''} onChange={(e) => setEdit({ ...edit, description: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Desde" type="datetime-local" value={toLocal(edit.starts_at)} onChange={(e) => setEdit({ ...edit, starts_at: e.target.value ? new Date(e.target.value).toISOString() : null })} />
              <Input label="Hasta" type="datetime-local" value={toLocal(edit.ends_at)} onChange={(e) => setEdit({ ...edit, ends_at: e.target.value ? new Date(e.target.value).toISOString() : null })} />
            </div>
            <div><span className="text-sm font-semibold">Productos</span>
              <div className="mt-2 flex max-h-40 flex-wrap gap-2 overflow-y-auto">
                {prods.filter((p) => !p.is_archived).map((p) => {
                  const on = edit.productIds.includes(p.id)
                  return <button key={p.id} type="button" onClick={() => setEdit({ ...edit, productIds: on ? edit.productIds.filter((x) => x !== p.id) : [...edit.productIds, p.id] })}
                    className={cn('rounded-full border px-3 py-1 text-sm', on ? 'border-carbon bg-carbon text-hueso' : 'border-carbon/20')}>{p.name}</button>
                })}
              </div></div>
            <Toggle checked={edit.is_active ?? true} onChange={(v) => setEdit({ ...edit, is_active: v })} label="Activa" />
            <Alert>{error}</Alert>
            <Btn onClick={save}>Guardar</Btn>
          </div>
        </Modal>
      )}
    </Card>
  )
}
