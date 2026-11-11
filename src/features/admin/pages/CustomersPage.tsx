import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { db } from '@/lib/supabase'
import { formatCOP } from '@/lib/format'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { ErrorState, Skeleton } from '@/components/shared/states'
import { Badge, Card, Page, PageHeader, Table } from '../components/ui'

interface Customer { id: string; full_name: string; phone: string | null; email: string | null; user_id: string | null; created_at: string;
  orders: { total: number; status: string; created_at: string }[] }

async function fetchCustomers(): Promise<Customer[]> {
  const { data, error } = await db().from('customers').select('id, full_name, phone, email, user_id, created_at, orders(total, status, created_at)')
    .order('created_at', { ascending: false }).limit(500)
  if (error) throw error
  return data as unknown as Customer[]
}

export function CustomersPage() {
  useDocumentTitle('Clientes')
  const q = useQuery({ queryKey: ['admin-customers'], queryFn: fetchCustomers })
  const [search, setSearch] = useState('')
  const list = (q.data ?? []).filter((c) => !search || `${c.full_name} ${c.phone ?? ''} ${c.email ?? ''}`.toLowerCase().includes(search.toLowerCase()))
  return (
    <Page>
      <PageHeader title="Clientes" subtitle="Clientes con cuenta e invitados que han pedido." />
      <Card className="mt-6" actions={<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar nombre, celular o correo" className="h-10 w-64 rounded-lg border border-carbon/20 px-3 text-sm outline-none focus:border-carbon" />}>
        {q.error && <ErrorState error={q.error} />}
        {q.isPending && <Skeleton className="h-64" />}
        {q.data && (
          <Table head={['Cliente', 'Contacto', 'Pedidos', 'Comprado', 'Último pedido']} empty={list.length === 0 && 'Aún no hay clientes.'}>
            {list.map((c) => {
              const delivered = c.orders.filter((o) => o.status === 'delivered')
              const last = c.orders.map((o) => o.created_at).sort().at(-1)
              return (
                <tr key={c.id}>
                  <td className="font-medium">{c.full_name} {c.user_id ? <Badge tone="green">Cuenta</Badge> : <Badge>Invitado</Badge>}</td>
                  <td className="text-xs text-piedra">{c.phone}<br />{c.email}</td>
                  <td>{c.orders.length}</td>
                  <td className="price">{formatCOP(delivered.reduce((s, o) => s + Number(o.total), 0))}</td>
                  <td className="text-xs text-piedra">{last ? new Date(last).toLocaleDateString('es-CO') : '—'}</td>
                </tr>
              )
            })}
          </Table>
        )}
      </Card>
    </Page>
  )
}
