import { useIsOpen } from '@/features/site/hooks/useRestaurant'
import { cn } from '@/lib/cn'

/** “Abierto ahora / Cerrado” calculado en el servidor (horario, cierres y pausa). */
export function OpenStatus({ className }: { className?: string }) {
  const { data: open, isSuccess } = useIsOpen()
  if (!isSuccess) return null
  return (
    <span className={cn('inline-flex items-center gap-2 text-sm font-medium', className)}>
      <span className={cn('size-2 rounded-full', open ? 'bg-emerald-400' : 'bg-piedra')} aria-hidden />
      {open ? 'Abierto ahora' : 'Cerrado en este momento'}
    </span>
  )
}
