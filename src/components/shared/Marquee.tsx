import type { CSSProperties } from 'react'
import { cn } from '@/lib/cn'

type Props = {
  items: readonly string[]
  className?: string
  reverse?: boolean
  /** segundos por vuelta */
  speed?: number
  /** inclinación de la cinta en grados */
  tilt?: number
  label?: string
}

/** Cinta de texto en movimiento continuo. El contenido se duplica para que el bucle no tenga saltos. */
export function Marquee({ items, className, reverse, speed = 32, tilt = 0, label }: Props) {
  const row = [...items, ...items, ...items]
  return (
    <div
      className={cn('relative overflow-hidden border-y-2 border-carbon py-3 md:py-4', className)}
      style={{ transform: tilt ? `rotate(${tilt}deg)` : undefined }}
      {...(label === '' ? { 'aria-hidden': true } : { role: 'img', 'aria-label': label ?? items.join(', ') })}
    >
      <div
        className={cn('flex w-max whitespace-nowrap font-display font-black uppercase leading-none', reverse ? 'animate-marquee-reverse' : 'animate-marquee')}
        style={{ '--marquee-speed': `${speed}s` } as CSSProperties}
        aria-hidden
      >
        {[0, 1].map((half) => (
          <span key={half} className="flex">
            {row.map((t, i) => (
              <span key={i} className="flex items-center gap-6 pr-6 text-[clamp(1.9rem,4vw,3.25rem)] md:gap-8 md:pr-8">
                {t}
                <Star className="size-[0.6em]" />
              </span>
            ))}
          </span>
        ))}
      </div>
    </div>
  )
}

export function Star({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <path d="M12 0l2.6 8.3L23 6l-6.2 6 6.2 6-8.4-2.3L12 24l-2.6-8.3L1 18l6.2-6L1 6l8.4 2.3z" />
    </svg>
  )
}
