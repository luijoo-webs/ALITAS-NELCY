import { useHours } from '../hooks/useRestaurant'
import { formatTime, weekdayName } from '@/lib/format'
import { cn } from '@/lib/cn'

// Lunes primero, domingo al final.
const ORDER = [1, 2, 3, 4, 5, 6, 0]

/** Horario desde Supabase. Agrupa días consecutivos con el mismo horario. */
export function HoursList({ className }: { className?: string }) {
  const { data: hours, isSuccess } = useHours()
  if (!isSuccess) return null
  if (hours.length === 0) return <p className={cn('text-sm opacity-70', className)}>Horario por confirmar.</p>

  const label = (d: number) =>
    hours
      .filter((h) => h.weekday === d)
      .map((h) => `${formatTime(h.opens_at)} – ${formatTime(h.closes_at)}`)
      .join(' · ') || 'Cerrado'

  const groups: { from: number; to: number; text: string }[] = []
  for (const d of ORDER) {
    const text = label(d)
    const last = groups.at(-1)
    if (last && last.text === text) last.to = d
    else groups.push({ from: d, to: d, text })
  }

  return (
    <dl className={cn('grid gap-1.5 text-sm', className)}>
      {groups.map((g) => (
        <div key={g.from} className="flex flex-wrap justify-between gap-x-4">
          <dt>{g.from === g.to ? weekdayName(g.from) : `${weekdayName(g.from)} a ${weekdayName(g.to).toLowerCase()}`}</dt>
          <dd className="price opacity-80">{g.text}</dd>
        </div>
      ))}
    </dl>
  )
}
