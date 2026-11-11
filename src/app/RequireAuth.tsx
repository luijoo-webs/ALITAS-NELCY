import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

/** Protección de navegación. La protección de datos la hace RLS en Supabase. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const { pathname } = useLocation()
  if (loading) return <div className="min-h-svh bg-hueso" />
  if (!user) return <Navigate to={`/ingresar?next=${encodeURIComponent(pathname)}`} replace />
  return children
}
