import type { ReactNode } from 'react'
import { media } from '@/config/media'

export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="grid min-h-svh bg-hueso md:grid-cols-[1fr_1.1fr]">
      <div className="relative hidden md:block">
        <img src={media.local} alt="" className="absolute inset-0 size-full object-cover" />
        <div className="absolute inset-0 bg-carbon/55" />
      </div>
      <div className="flex items-center px-4 pb-16 pt-28 sm:px-8 md:pt-24">
        <div className="mx-auto w-full max-w-sm">
          <h1 className="h2">{title}</h1>
          {subtitle && <p className="mt-2 text-piedra">{subtitle}</p>}
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </section>
  )
}
