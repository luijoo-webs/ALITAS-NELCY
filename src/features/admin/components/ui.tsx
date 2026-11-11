// Piezas comunes del panel: encabezado, tarjetas, tablas, campos y modal.
import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/cn'

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-4xl font-black uppercase">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-piedra">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function Page({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-10 lg:py-10">{children}</div>
}

export function Card({ title, actions, children, className }: { title?: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-xl border border-carbon/10 bg-white p-5 sm:p-6', className)}>
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {title && <h2 className="font-sans text-base font-semibold normal-case">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  )
}

const btn = {
  primary: 'bg-carbon text-hueso hover:bg-carbon-700',
  accent: 'bg-alas text-hueso hover:bg-alas-700',
  outline: 'border border-carbon/20 bg-white hover:bg-carbon/5',
  ghost: 'hover:bg-carbon/5',
  danger: 'text-alas hover:bg-alas/10',
}
export function Btn({ variant = 'primary', size = 'md', className, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof btn; size?: 'sm' | 'md' }) {
  return (
    <button
      type="button"
      className={cn('inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4',
        size === 'sm' ? 'h-8 px-2.5 text-xs' : 'h-10 px-4 text-sm', btn[variant], className)}
      {...p}
    />
  )
}

const control = 'w-full rounded-lg border border-carbon/20 bg-white px-3 text-sm outline-none transition-colors focus:border-carbon disabled:bg-carbon/5'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { label?: string; hint?: string }>(
  ({ label, hint, className, ...p }, ref) => (
    <label className={cn('block', className)}>
      {label && <span className="mb-1 block text-xs font-medium text-carbon/70">{label}</span>}
      <input ref={ref} className={cn(control, 'h-10')} {...p} />
      {hint && <span className="mt-1 block text-xs text-piedra">{hint}</span>}
    </label>
  ),
)

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }>(
  ({ label, className, ...p }, ref) => (
    <label className={cn('block', className)}>
      {label && <span className="mb-1 block text-xs font-medium text-carbon/70">{label}</span>}
      <textarea ref={ref} rows={3} className={cn(control, 'py-2')} {...p} />
    </label>
  ),
)

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & { label?: string }>(
  ({ label, className, children, ...p }, ref) => (
    <label className={cn('block', className)}>
      {label && <span className="mb-1 block text-xs font-medium text-carbon/70">{label}</span>}
      <select ref={ref} className={cn(control, 'h-10')} {...p}>{children}</select>
    </label>
  ),
)

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <label className={cn('inline-flex cursor-pointer items-center gap-2 text-sm', disabled && 'opacity-50')}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn('relative h-6 w-10 rounded-full transition-colors', checked ? 'bg-carbon' : 'bg-carbon/20')}
      >
        <span className={cn('absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-[18px]' : 'translate-x-0.5')} />
      </button>
      {label}
    </label>
  )
}

const tones = {
  neutral: 'bg-carbon/8 text-carbon',
  green: 'bg-emerald-600/12 text-emerald-800',
  yellow: 'bg-maiz/30 text-carbon',
  red: 'bg-alas/12 text-alas-700',
  blue: 'bg-sky-600/12 text-sky-800',
}
export function Badge({ tone = 'neutral', children }: { tone?: keyof typeof tones; children: ReactNode }) {
  return <span className={cn('inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold', tones[tone])}>{children}</span>
}

export function Table({ head, children, empty }: { head: ReactNode[]; children: ReactNode; empty?: string | false }) {
  return (
    <div className="-mx-5 overflow-x-auto sm:-mx-6">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead className="border-b border-carbon/10 text-xs uppercase tracking-wide text-piedra">
          <tr>{head.map((h, i) => <th key={i} className="px-5 py-2 font-medium sm:px-6">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-carbon/8 [&_td]:px-5 [&_td]:py-3 sm:[&_td]:px-6">{children}</tbody>
      </table>
      {empty && <p className="px-6 py-10 text-center text-sm text-piedra">{empty}</p>}
    </div>
  )
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-carbon/50" />
        <Dialog.Content
          aria-describedby={undefined}
          className={cn('fixed inset-x-0 bottom-0 z-50 max-h-[92svh] overflow-y-auto rounded-t-2xl bg-[#fbf8f2] p-5 shadow-xl sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-[min(92vw,var(--w))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:p-6')}
          style={{ '--w': wide ? '880px' : '560px' } as React.CSSProperties}
        >
          <div className="mb-5 flex items-center justify-between gap-4">
            <Dialog.Title className="font-display text-2xl font-black uppercase">{title}</Dialog.Title>
            <Dialog.Close className="grid size-9 place-items-center rounded-lg hover:bg-carbon/5" aria-label="Cerrar"><X className="size-5" /></Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export function Alert({ tone = 'error', children }: { tone?: 'error' | 'success' | 'info'; children: ReactNode }) {
  if (!children) return null
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cn('rounded-lg px-4 py-3 text-sm',
      tone === 'error' ? 'bg-alas/10 text-alas-700' : tone === 'success' ? 'bg-emerald-600/10 text-emerald-800' : 'bg-carbon/5 text-carbon/80')}>
      {children}
    </div>
  )
}

/** Mensaje legible a partir de errores de Supabase/Postgres. */
export function errMsg(e: unknown): string {
  const m = (e as { message?: string; code?: string })?.message ?? String(e)
  const code = (e as { code?: string })?.code
  if (code === '42501' || /permission denied|row-level security/i.test(m)) return 'No tienes permiso para esta acción.'
  if (code === '23505' || /duplicate key/i.test(m)) return 'Ya existe un registro con ese nombre o código.'
  if (code === '23503' || /foreign key/i.test(m)) return 'No se puede: hay otros registros que dependen de este.'
  if (/check constraint/i.test(m)) return 'Algún valor no es válido. Revisa los campos.'
  return m
}

export const slugify = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
