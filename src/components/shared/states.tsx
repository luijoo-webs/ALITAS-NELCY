import { AlertTriangle, Settings2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { NotConfiguredError } from '@/lib/supabase'
import { cn } from '@/lib/cn'

export function ErrorState({ error, onRetry, className }: { error: unknown; onRetry?: () => void; className?: string }) {
  const notConfigured = error instanceof NotConfiguredError
  return (
    <div role="alert" className={cn('flex flex-col items-center gap-3 rounded-[var(--radius-card)] border border-carbon/10 px-6 py-10 text-center', className)}>
      {notConfigured ? <Settings2 className="size-6 text-piedra" /> : <AlertTriangle className="size-6 text-alas" />}
      <p className="font-semibold">{notConfigured ? 'Configuración pendiente' : 'No pudimos cargar esta información'}</p>
      <p className="max-w-sm text-sm text-piedra">
        {notConfigured
          ? 'Conecta el proyecto de Supabase (archivo .env.local) para ver los datos reales.'
          : 'Revisa tu conexión e inténtalo de nuevo.'}
      </p>
      {!notConfigured && onRetry && (
        <button onClick={onRetry} className="text-sm font-semibold text-alas underline underline-offset-4">
          Reintentar
        </button>
      )}
    </div>
  )
}

export function EmptyState({ icon, title, children, className }: { icon?: ReactNode; title: string; children?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center gap-3 px-6 py-14 text-center', className)}>
      {icon}
      <p className="font-semibold">{title}</p>
      {children && <div className="max-w-sm text-sm text-piedra">{children}</div>}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('animate-pulse rounded-[var(--radius-card)] bg-carbon/8', className)} />
}
