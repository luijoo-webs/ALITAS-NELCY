import { forwardRef, useId, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

type Props = InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; hint?: string }

export const Field = forwardRef<HTMLInputElement, Props>(({ label, error, hint, className, id, ...props }, ref) => {
  const auto = useId()
  const inputId = id ?? auto
  const msgId = `${inputId}-msg`
  return (
    <div className={cn('grid gap-1.5', className)}>
      <label htmlFor={inputId} className="text-sm font-medium">{label}</label>
      <input
        ref={ref}
        id={inputId}
        aria-invalid={Boolean(error)}
        aria-describedby={error || hint ? msgId : undefined}
        className={cn(
          'h-12 rounded-[10px] border-2 bg-white px-3.5 text-[0.95rem] outline-none transition-colors placeholder:text-piedra/70 focus:border-alas',
          error ? 'border-alas' : 'border-carbon/25',
        )}
        {...props}
      />
      {(error || hint) && (
        <p id={msgId} className={cn('text-xs', error ? 'text-alas' : 'text-piedra')}>{error ?? hint}</p>
      )}
    </div>
  )
})

export function FormAlert({ tone = 'error', children }: { tone?: 'error' | 'success'; children: React.ReactNode }) {
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cn('rounded-md px-4 py-3 text-sm', tone === 'error' ? 'bg-alas/8 text-alas' : 'bg-emerald-600/10 text-emerald-800')}>
      {children}
    </div>
  )
}
