import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { db } from '@/lib/supabase'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { ErrorState, Skeleton } from '@/components/shared/states'
import { Alert, Badge, Card, Page, PageHeader, Table, errMsg } from '../components/ui'

interface UserRow { id: string; email: string; full_name: string | null; created_at: string; confirmed: boolean; roles: string[] }
interface Role { id: string; code: string; name: string; description: string | null }

export function UsersPage() {
  useDocumentTitle('Usuarios y roles')
  const qc = useQueryClient()
  const users = useQuery({ queryKey: ['admin-users'], queryFn: async () => {
    const { data, error } = await db().rpc('admin_list_users')
    if (error) throw error
    return data as UserRow[]
  } })
  const roles = useQuery({ queryKey: ['roles'], queryFn: async () => {
    const { data, error } = await db().from('roles').select('id, code, name, description').order('name')
    if (error) throw error
    return data as Role[]
  } })
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)

  const toggle = async (u: UserRow, r: Role) => {
    setError(null)
    const has = u.roles.includes(r.code)
    if (has && !confirm(`¿Quitar el rol ${r.name} a ${u.email}?`)) return
    const { error } = has
      ? await db().from('user_roles').delete().eq('user_id', u.id).eq('role_id', r.id)
      : await db().from('user_roles').insert({ user_id: u.id, role_id: r.id })
    if (error) setError(errMsg(error))
    qc.invalidateQueries({ queryKey: ['admin-users'] })
  }

  const list = (users.data ?? []).filter((u) => !search || `${u.email} ${u.full_name ?? ''}`.toLowerCase().includes(search.toLowerCase()))
  return (
    <Page>
      <PageHeader title="Usuarios y roles" subtitle="Para dar acceso a un empleado: que se registre en el sitio con su correo y luego asígnale un rol aquí." />
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {(roles.data ?? []).map((r) => (
          <div key={r.id} className="rounded-lg border border-carbon/10 bg-white p-3 text-xs"><p className="text-sm font-semibold">{r.name}</p><p className="mt-1 text-piedra">{r.description}</p></div>
        ))}
      </div>
      <Card className="mt-6" actions={<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar correo o nombre" className="h-10 w-64 rounded-lg border border-carbon/20 px-3 text-sm outline-none focus:border-carbon" />}>
        <Alert>{error}</Alert>
        {users.error && <ErrorState error={users.error} />}
        {users.isPending && <Skeleton className="h-40" />}
        {users.data && roles.data && (
          <Table head={['Usuario', 'Roles (toca para asignar o quitar)']} empty={list.length === 0 && 'Sin usuarios.'}>
            {list.map((u) => (
              <tr key={u.id}>
                <td><p className="font-medium">{u.full_name ?? '—'}</p><p className="text-xs text-piedra">{u.email} {!u.confirmed && <Badge tone="yellow">Sin confirmar</Badge>}</p></td>
                <td>
                  <div className="flex flex-wrap gap-1.5">
                    {roles.data.map((r) => {
                      const on = u.roles.includes(r.code)
                      return (
                        <button key={r.id} onClick={() => toggle(u, r)} className={on ? 'rounded-full bg-carbon px-2.5 py-1 text-xs font-medium text-hueso' : 'rounded-full border border-carbon/20 px-2.5 py-1 text-xs text-carbon/60 hover:border-carbon'}>
                          {r.name}
                        </button>
                      )
                    })}
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </Page>
  )
}
