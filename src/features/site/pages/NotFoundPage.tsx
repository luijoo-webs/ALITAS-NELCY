import { ButtonLink } from '@/components/ui/button'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

export function NotFoundPage() {
  useDocumentTitle('Página no encontrada')
  return (
    <section className="grid min-h-[85svh] place-items-center bg-carbon px-4 pt-16 text-center text-hueso">
      <div>
        <p className="font-display text-[clamp(7rem,22vw,14rem)] font-black leading-none text-maiz [text-shadow:6px_6px_0_var(--color-carbon)]">404</p>
        <h1 className="h1 mt-2">Esta página se la comieron</h1>
        <p className="mt-4 text-lg text-hueso/85">Pero el menú sigue completo.</p>
        <ButtonLink to="/menu" variant="yellow" size="lg" className="mt-8">Ver el menú</ButtonLink>
      </div>
    </section>
  )
}
