import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { Link, type LinkProps } from 'react-router-dom'
import { cn } from '@/lib/cn'

const base =
  'inline-flex items-center justify-center gap-2 rounded-[10px] font-display font-extrabold uppercase tracking-[0.06em] disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-[1.1em] [&_svg]:shrink-0'

const variants = {
  primary: 'btn-hard border-2 border-carbon bg-alas text-hueso hover:bg-alas-700',
  yellow: 'btn-hard border-2 border-carbon bg-maiz text-carbon hover:bg-maiz-300',
  light: 'btn-hard border-2 border-carbon bg-hueso text-carbon hover:bg-crema',
  dark: 'btn-hard border-2 border-carbon bg-carbon text-hueso hover:bg-carbon-700',
  outline: 'border-2 border-current transition-colors hover:bg-current/10',
  ghost: 'transition-colors hover:bg-carbon/5',
}
const sizes = {
  sm: 'h-10 px-4 text-[0.95rem]',
  md: 'h-12 px-6 text-[1.05rem]',
  lg: 'h-14 px-7 text-[1.2rem]',
}

export type ButtonStyle = { variant?: keyof typeof variants; size?: keyof typeof sizes }
export const buttonClass = ({ variant = 'primary', size = 'md' }: ButtonStyle = {}, className?: string) =>
  cn(base, variants[variant], sizes[size], className)

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & ButtonStyle>(
  ({ variant, size, className, ...props }, ref) => (
    <button ref={ref} className={buttonClass({ variant, size }, className)} {...props} />
  ),
)

export function ButtonLink({ variant, size, className, ...props }: LinkProps & ButtonStyle) {
  return <Link className={buttonClass({ variant, size }, className)} {...props} />
}
