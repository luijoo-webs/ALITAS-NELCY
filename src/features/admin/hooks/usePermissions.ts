import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { fetchMyPermissions } from '../services/admin'

/** Permisos del usuario para mostrar u ocultar opciones. La seguridad real está en RLS. */
export function usePermissions() {
  const { user } = useAuth()
  const q = useQuery({ queryKey: ['my-permissions', user?.id], queryFn: fetchMyPermissions, enabled: Boolean(user), staleTime: 5 * 60_000 })
  const perms = q.data ?? []
  return { ...q, perms, can: (code: string) => perms.includes(code), isStaff: perms.length > 0 }
}
