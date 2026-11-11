import type { CSSProperties, ElementType, ReactNode } from 'react'
import { useReveal } from '@/hooks/useReveal'
import { cn } from '@/lib/cn'

type Props = {
  as?: ElementType
  className?: string
  children: ReactNode
  /** fade: sube y aparece · wipe: la imagen se descubre de arriba abajo · pop: rebote tipo sticker */
  variant?: 'fade' | 'wipe' | 'pop'
  delay?: number
  /** rotación final (para stickers y fotos inclinadas) */
  rotate?: number
}

export function Reveal({ as: Tag = 'div', className, children, variant = 'fade', delay = 0, rotate }: Props) {
  const ref = useReveal<HTMLElement>()
  const cls = { fade: 'reveal', wipe: 'reveal-wipe', pop: 'reveal-pop' }[variant]
  const style = { '--d': `${delay}ms`, ...(rotate !== undefined && { '--r': `${rotate}deg` }) } as CSSProperties
  return (
    <Tag ref={ref} className={cn(cls, className)} style={style}>
      {children}
    </Tag>
  )
}
