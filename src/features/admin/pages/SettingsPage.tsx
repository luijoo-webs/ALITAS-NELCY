import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { db } from '@/lib/supabase'
import { formatCOP, weekdayName } from '@/lib/format'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { ErrorState, Skeleton } from '@/components/shared/states'
import { Alert, Badge, Btn, Card, Input, Modal, Page, PageHeader, Select, Table, Textarea, Toggle, errMsg } from '../components/ui'

interface Zone { id: string; name: string; fee: number; min_order: number; free_from: number | null; eta_minutes: number | null; is_active: boolean; sort_order: number; delivery_zone_neighborhoods: { id: string; neighborhood: string }[] }
interface Method { id: string; code: string; label: string; instructions: string | null; requires_proof: boolean; available_for: 'delivery' | 'pickup' | 'both'; is_active: boolean; is_online: boolean }

async function fetchAll() {
  const [s, ps, h, c, z, m] = await Promise.all([
    db().from('restaurant_settings').select('*').single(),
    db().from('restaurant_private_settings').select('*').single(),
    db().from('business_hours').select('*').order('weekday').order('opens_at'),
    db().from('business_closures').select('*').gte('closed_on', new Date().toISOString().slice(0, 10)).order('closed_on'),
    db().from('delivery_zones').select('*, delivery_zone_neighborhoods(id, neighborhood)').order('sort_order'),
    db().from('payment_methods').select('*').order('sort_order'),
  ])
  for (const r of [s, ps, h, c, z, m]) if (r.error) throw r.error
  return { settings: s.data, priv: ps.data, hours: h.data as { id: string; weekday: number; opens_at: string; closes_at: string }[],
    closures: c.data as { id: string; closed_on: string; reason: string | null }[], zones: z.data as Zone[], methods: m.data as Method[] }
}

export function SettingsPage() {
  useDocumentTitle('Configuración')
  const q = useQuery({ queryKey: ['admin-settings'], queryFn: fetchAll })
  return (
    <Page>
      <PageHeader title="Configuración" subtitle="Datos del local, horario, domicilios y formas de pago." />
      {q.error && <ErrorState error={q.error} className="mt-6 bg-white" />}
      {q.isPending && <Skeleton className="mt-6 h-96" />}
      {q.data && (
        <div className="mt-6 space-y-6">
          <OrdersCard data={q.data} />
          <InfoCard settings={q.data.settings} />
          <HoursCard hours={q.data.hours} closures={q.data.closures} />
          <ZonesCard zones={q.data.zones} />
          <MethodsCard methods={q.data.methods} />
        </div>
      )}
    </Page>
  )
}

function useSave() {
  const qc = useQueryClient()
  const [msg, setMsg] = useState<{ tone: 'error' | 'success'; text: string } | null>(null)
  const run = async (fn: () => PromiseLike<{ error: unknown }>, ok = 'Guardado.') => {
    setMsg(null)
    const { error } = await fn()
    if (error) { setMsg({ tone: 'error', text: errMsg(error) }); return false }
    await Promise.all([qc.invalidateQueries({ queryKey: ['admin-settings'] }), qc.invalidateQueries({ queryKey: ['settings'] }),
      qc.invalidateQueries({ queryKey: ['hours'] }), qc.invalidateQueries({ queryKey: ['is-open'] }), qc.invalidateQueries({ queryKey: ['checkout-data'] })])
    setMsg({ tone: 'success', text: ok })
    return true
  }
  return { msg, run }
}

function OrdersCard({ data }: { data: Awaited<ReturnType<typeof fetchAll>> }) {
  const { msg, run } = useSave()
  const [pausedMsg, setPausedMsg] = useState(data.settings.paused_message ?? '')
  const [prep, setPrep] = useState(String(data.settings.prep_time_minutes ?? ''))
  const [emails, setEmails] = useState((data.priv.notification_emails ?? []).join(', '))
  return (
    <Card title="Recepción de pedidos">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-3">
          <Toggle checked={!data.settings.orders_paused} label={data.settings.orders_paused ? 'Pedidos en línea PAUSADOS' : 'Recibiendo pedidos en línea'}
            onChange={(v) => run(() => db().from('restaurant_settings').update({ orders_paused: !v }).eq('id', true))} />
          <Toggle checked={data.priv.auto_confirm_orders} label="Confirmar automáticamente los pedidos web"
            onChange={(v) => run(() => db().from('restaurant_private_settings').update({ auto_confirm_orders: v }).eq('id', true))} />
        </div>
        <div className="space-y-3">
          <Input label="Mensaje cuando está en pausa" value={pausedMsg} onChange={(e) => setPausedMsg(e.target.value)} />
          <Input label="Tiempo de preparación (min)" inputMode="numeric" value={prep} onChange={(e) => setPrep(e.target.value)} />
          <Input label="Correos que reciben avisos (separados por coma)" value={emails} onChange={(e) => setEmails(e.target.value)} />
          <Btn onClick={async () => {
            const ok = await run(() => db().from('restaurant_settings').update({ paused_message: pausedMsg || null, prep_time_minutes: prep ? Number(prep) : null }).eq('id', true))
            if (ok) await run(() => db().from('restaurant_private_settings').update({ notification_emails: emails.split(',').map((e: string) => e.trim().toLowerCase()).filter(Boolean) }).eq('id', true))
          }}>Guardar</Btn>
        </div>
      </div>
      {msg && <div className="mt-4"><Alert tone={msg.tone}>{msg.text}</Alert></div>}
    </Card>
  )
}

const INFO_FIELDS = [
  ['name', 'Nombre'], ['tagline', 'Lema'], ['phone', 'Teléfono'], ['whatsapp', 'WhatsApp (solo dígitos con 57)'], ['public_email', 'Correo público'],
  ['address', 'Dirección'], ['neighborhood', 'Barrio'], ['city', 'Ciudad'], ['maps_url', 'Enlace de Google Maps'],
  ['instagram_url', 'Instagram'], ['facebook_url', 'Facebook'], ['tiktok_url', 'TikTok'],
] as const

function InfoCard({ settings }: { settings: Record<string, string | null> }) {
  const { msg, run } = useSave()
  const [f, setF] = useState<Record<string, string>>(() => Object.fromEntries(INFO_FIELDS.map(([k]) => [k, settings[k] ?? ''])))
  return (
    <Card title="Datos del restaurante">
      <div className="grid gap-4 sm:grid-cols-2">
        {INFO_FIELDS.map(([k, label]) => <Input key={k} label={label} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />)}
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Btn onClick={() => run(() => db().from('restaurant_settings').update(Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v.trim() || (k === 'name' ? 'Alitas Nelcy' : null)]))).eq('id', true))}>Guardar</Btn>
      </div>
      {msg && <div className="mt-4"><Alert tone={msg.tone}>{msg.text}</Alert></div>}
    </Card>
  )
}

function HoursCard({ hours, closures }: { hours: { id: string; weekday: number; opens_at: string; closes_at: string }[]; closures: { id: string; closed_on: string; reason: string | null }[] }) {
  const { msg, run } = useSave()
  const [n, setN] = useState({ weekday: '1', opens_at: '11:00', closes_at: '22:00' })
  const [c, setC] = useState({ closed_on: '', reason: '' })
  return (
    <Card title="Horario">
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <ul className="divide-y divide-carbon/8 text-sm">
            {[1, 2, 3, 4, 5, 6, 0].map((d) => {
              const list = hours.filter((h) => h.weekday === d)
              return (
                <li key={d} className="flex items-start justify-between gap-3 py-2">
                  <span className="w-24 font-medium">{weekdayName(d)}</span>
                  <span className="flex-1 space-y-1">
                    {list.length === 0 && <span className="text-piedra">Cerrado</span>}
                    {list.map((h) => (
                      <span key={h.id} className="flex items-center justify-between gap-2">
                        {h.opens_at.slice(0, 5)} – {h.closes_at.slice(0, 5)}
                        <button className="text-piedra hover:text-alas" aria-label="Quitar" onClick={() => run(() => db().from('business_hours').delete().eq('id', h.id))}><Trash2 className="size-4" /></button>
                      </span>
                    ))}
                  </span>
                </li>
              )
            })}
          </ul>
          <div className="mt-3 grid grid-cols-[1fr_1fr_1fr_auto] items-end gap-2">
            <Select label="Día" value={n.weekday} onChange={(e) => setN({ ...n, weekday: e.target.value })}>{[1, 2, 3, 4, 5, 6, 0].map((d) => <option key={d} value={d}>{weekdayName(d)}</option>)}</Select>
            <Input label="Abre" type="time" value={n.opens_at} onChange={(e) => setN({ ...n, opens_at: e.target.value })} />
            <Input label="Cierra" type="time" value={n.closes_at} onChange={(e) => setN({ ...n, closes_at: e.target.value })} />
            <Btn onClick={() => run(() => db().from('business_hours').insert({ weekday: Number(n.weekday), opens_at: n.opens_at, closes_at: n.closes_at }))}><Plus /></Btn>
          </div>
          <p className="mt-1 text-xs text-piedra">Si cierras después de medianoche, agrega dos franjas (hasta 23:59 y desde 00:00 del día siguiente).</p>
        </div>
        <div>
          <h3 className="font-sans text-sm font-semibold normal-case">Cierres especiales</h3>
          <ul className="mt-2 divide-y divide-carbon/8 text-sm">
            {closures.length === 0 && <li className="py-2 text-piedra">Ninguno programado.</li>}
            {closures.map((x) => (
              <li key={x.id} className="flex justify-between py-2">{new Date(`${x.closed_on}T12:00:00`).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}{x.reason ? ` · ${x.reason}` : ''}
                <button className="text-piedra hover:text-alas" aria-label="Quitar" onClick={() => run(() => db().from('business_closures').delete().eq('id', x.id))}><Trash2 className="size-4" /></button></li>
            ))}
          </ul>
          <div className="mt-3 grid grid-cols-[1fr_1fr_auto] items-end gap-2">
            <Input label="Fecha" type="date" value={c.closed_on} onChange={(e) => setC({ ...c, closed_on: e.target.value })} />
            <Input label="Motivo" value={c.reason} onChange={(e) => setC({ ...c, reason: e.target.value })} />
            <Btn disabled={!c.closed_on} onClick={() => run(() => db().from('business_closures').insert({ closed_on: c.closed_on, reason: c.reason || null }))}><Plus /></Btn>
          </div>
        </div>
      </div>
      {msg && <div className="mt-4"><Alert tone={msg.tone}>{msg.text}</Alert></div>}
    </Card>
  )
}

function ZonesCard({ zones }: { zones: Zone[] }) {
  const { msg, run } = useSave()
  const [edit, setEdit] = useState<(Partial<Zone> & { hoods: string }) | null>(null)
  const save = async () => {
    if (!edit) return
    const row = { name: edit.name?.trim(), fee: Number(edit.fee) || 0, min_order: Number(edit.min_order) || 0, free_from: edit.free_from ? Number(edit.free_from) : null,
      eta_minutes: edit.eta_minutes ? Number(edit.eta_minutes) : null, is_active: edit.is_active ?? true, sort_order: Number(edit.sort_order) || 0 }
    const r = edit.id ? await db().from('delivery_zones').update(row).eq('id', edit.id).select('id').single() : await db().from('delivery_zones').insert(row).select('id').single()
    if (r.error) return run(async () => ({ error: r.error }))
    const id = r.data.id
    const hoods = [...new Set(edit.hoods.split(/[\n,]/).map((h) => h.trim()).filter((h) => h.length >= 2))]
    const ok = await run(() => db().from('delivery_zone_neighborhoods').delete().eq('zone_id', id))
    if (ok && hoods.length) await run(() => db().from('delivery_zone_neighborhoods').insert(hoods.map((neighborhood) => ({ zone_id: id, neighborhood }))))
    if (ok) setEdit(null)
  }
  return (
    <Card title="Zonas de domicilio" actions={<Btn size="sm" onClick={() => setEdit({ is_active: true, hoods: '' })}><Plus /> Zona</Btn>}>
      <Table head={['Zona', 'Tarifa', 'Mínimo', 'Barrios', '']} empty={zones.length === 0 && 'Sin zonas: el sitio solo ofrecerá recoger en el local.'}>
        {zones.map((z) => (
          <tr key={z.id}><td className="font-medium">{z.name} {!z.is_active && <Badge>Inactiva</Badge>}</td><td className="price">{formatCOP(z.fee)}</td><td className="price">{formatCOP(z.min_order)}</td>
            <td className="text-xs text-piedra">{z.delivery_zone_neighborhoods.length} barrios</td>
            <td className="text-right"><Btn variant="ghost" size="sm" onClick={() => setEdit({ ...z, hoods: z.delivery_zone_neighborhoods.map((n) => n.neighborhood).join('\n') })}><Pencil /></Btn></td></tr>
        ))}
      </Table>
      {msg && <div className="mt-4"><Alert tone={msg.tone}>{msg.text}</Alert></div>}
      {edit && (
        <Modal open onClose={() => setEdit(null)} title={edit.id ? 'Editar zona' : 'Nueva zona'}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Nombre" className="sm:col-span-2" value={edit.name ?? ''} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            <Input label="Tarifa de domicilio" inputMode="numeric" value={String(edit.fee ?? '')} onChange={(e) => setEdit({ ...edit, fee: Number(e.target.value) })} />
            <Input label="Pedido mínimo" inputMode="numeric" value={String(edit.min_order ?? '')} onChange={(e) => setEdit({ ...edit, min_order: Number(e.target.value) })} />
            <Input label="Domicilio gratis desde (opcional)" inputMode="numeric" value={String(edit.free_from ?? '')} onChange={(e) => setEdit({ ...edit, free_from: e.target.value ? Number(e.target.value) : null })} />
            <Input label="Tiempo estimado (min)" inputMode="numeric" value={String(edit.eta_minutes ?? '')} onChange={(e) => setEdit({ ...edit, eta_minutes: e.target.value ? Number(e.target.value) : null })} />
            <Textarea label="Barrios (uno por línea)" className="sm:col-span-2" rows={6} value={edit.hoods} onChange={(e) => setEdit({ ...edit, hoods: e.target.value })} />
            <Toggle checked={edit.is_active ?? true} onChange={(v) => setEdit({ ...edit, is_active: v })} label="Activa" />
            <div className="flex justify-end gap-2 sm:col-span-2">
              {edit.id && <Btn variant="danger" onClick={async () => { if (confirm('¿Eliminar esta zona?') && await run(() => db().from('delivery_zones').delete().eq('id', edit.id!))) setEdit(null) }}>Eliminar</Btn>}
              <Btn onClick={save}>Guardar</Btn>
            </div>
          </div>
        </Modal>
      )}
    </Card>
  )
}

function MethodsCard({ methods }: { methods: Method[] }) {
  const { msg, run } = useSave()
  const [edit, setEdit] = useState<Method | null>(null)
  useEffect(() => { if (edit) setEdit(methods.find((m) => m.id === edit.id) ?? null) }, [methods]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Card title="Métodos de pago">
      <p className="mb-3 text-sm text-piedra">Pagos sin pasarela: el personal verifica la transferencia o el efectivo. Las pasarelas en línea se activan cuando se elija proveedor.</p>
      <Table head={['Método', 'Disponible para', 'Estado', '']}>
        {methods.map((m) => (
          <tr key={m.id}><td className="font-medium">{m.label}</td><td>{{ both: 'Domicilio y recogida', delivery: 'Solo domicilio', pickup: 'Solo recogida' }[m.available_for]}</td>
            <td><Toggle checked={m.is_active} disabled={m.is_online} label={m.is_active ? 'Activo' : 'Inactivo'} onChange={(v) => run(() => db().from('payment_methods').update({ is_active: v }).eq('id', m.id))} /></td>
            <td className="text-right"><Btn variant="ghost" size="sm" onClick={() => setEdit(m)}><Pencil /></Btn></td></tr>
        ))}
      </Table>
      {msg && <div className="mt-4"><Alert tone={msg.tone}>{msg.text}</Alert></div>}
      {edit && (
        <Modal open onClose={() => setEdit(null)} title={edit.label}>
          <div className="grid gap-4">
            <Input label="Nombre visible" value={edit.label} onChange={(e) => setEdit({ ...edit, label: e.target.value })} />
            <Textarea label="Instrucciones para el cliente (ej. número Nequi, llave Bre-B)" value={edit.instructions ?? ''} onChange={(e) => setEdit({ ...edit, instructions: e.target.value })} />
            <Select label="Disponible para" value={edit.available_for} onChange={(e) => setEdit({ ...edit, available_for: e.target.value as Method['available_for'] })}>
              <option value="both">Domicilio y recogida</option><option value="delivery">Solo domicilio</option><option value="pickup">Solo recogida</option>
            </Select>
            <Btn onClick={async () => { if (await run(() => db().from('payment_methods').update({ label: edit.label, instructions: edit.instructions || null, available_for: edit.available_for }).eq('id', edit.id))) setEdit(null) }}>Guardar</Btn>
          </div>
        </Modal>
      )}
    </Card>
  )
}
