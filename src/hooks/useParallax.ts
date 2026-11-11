import { useEffect, useRef } from 'react'

/**
 * Mueve el elemento según el scroll: translate = (progreso − 0.5) × amount.
 * progreso = 0 cuando el elemento entra por abajo, 1 cuando sale por arriba.
 * axis 'x' sirve para filas de fotos que se deslizan de lado.
 */
export function useParallax<T extends HTMLElement>(amount = 80, axis: 'x' | 'y' = 'y') {
  const ref = useRef<T>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let frame = 0
    const update = () => {
      frame = 0
      const r = el.getBoundingClientRect()
      const vh = window.innerHeight
      if (r.bottom < -200 || r.top > vh + 200) return
      const progress = Math.min(1, Math.max(0, (vh - r.top) / (vh + r.height)))
      const v = (progress - 0.5) * amount
      el.style.transform = axis === 'x' ? `translate3d(${v}px,0,0)` : `translate3d(0,${v}px,0)`
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [amount, axis])
  return ref
}
