import { useId } from 'react'
import { cn } from '@/lib/cn'

/** Sello circular con texto girando alrededor y un centro fijo. */
export function SpinBadge({ text, center, className }: { text: string; center: React.ReactNode; className?: string }) {
  const id = useId().replace(/:/g, '')
  return (
    <div className={cn('relative grid size-32 place-items-center rounded-full border-2 border-carbon bg-maiz text-carbon shadow-[var(--shadow-hard)] md:size-40', className)}>
      <svg viewBox="0 0 200 200" className="absolute inset-0 size-full animate-spin-slow" aria-hidden>
        <defs>
          <path id={id} d="M100,100 m-74,0 a74,74 0 1,1 148,0 a74,74 0 1,1 -148,0" />
        </defs>
        <text className="fill-carbon font-display text-[19px] font-black uppercase">
          {/* textLength = circunferencia (2π·74 ≈ 465): el texto rodea el sello sin montarse */}
          <textPath href={`#${id}`} textLength="462" lengthAdjust="spacing">{text}</textPath>
        </text>
      </svg>
      <div className="relative text-center font-display font-black uppercase leading-[0.85]">{center}</div>
    </div>
  )
}
