import { useMemo, useState } from 'react'
import { Search, UtensilsCrossed } from 'lucide-react'
import type { Product } from '@/types/domain'
import { EmptyState, ErrorState, Skeleton } from '@/components/shared/states'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { cn } from '@/lib/cn'
import { Reveal } from '@/components/shared/Reveal'
import { SpinBadge } from '@/components/shared/SpinBadge'
import { useMenu } from '../hooks/useMenu'
import { ProductCard } from '../components/ProductCard'
import { ProductDialog } from '../components/ProductDialog'

const normalize = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

export function MenuPage() {
  useDocumentTitle('Menú')
  const { data: categories, isPending, error, refetch } = useMenu()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState<string | null>(null)
  const [selected, setSelected] = useState<Product | null>(null)

  const visible = useMemo(() => {
    const q = normalize(query.trim())
    return (categories ?? [])
      .filter((c) => !active || c.id === active)
      .map((c) => ({
        ...c,
        products: q ? c.products.filter((p) => normalize(`${p.name} ${p.description ?? ''}`).includes(q)) : c.products,
      }))
      .filter((c) => c.products.length > 0)
  }, [categories, query, active])

  const hasProducts = (categories ?? []).some((c) => c.products.length > 0)

  return (
    <>
      <section className="relative overflow-hidden bg-carbon pb-14 pt-28 text-hueso md:pb-20 md:pt-40">
        <div className="container-page relative">
          <p className="fade-in kicker text-maiz">El menú</p>
          <h1 className="display mt-3 max-w-3xl">
            <span className="line-mask"><span style={{ '--d': '100ms' } as React.CSSProperties}>Alitas primero.</span></span>
            <span className="line-mask"><span className="text-maiz" style={{ '--d': '220ms' } as React.CSSProperties}>Almuerzos de la casa.</span></span>
          </h1>
          <p className="fade-in mt-5 max-w-xl text-lg text-hueso/85" style={{ '--d': '400ms' } as React.CSSProperties}>
            Combos con papas a la francesa y cinco salsas propias, y almuerzos de comida corriente.
          </p>
          <div className="pointer-events-none absolute -bottom-6 right-6 hidden animate-float lg:block" style={{ '--r': '-10deg' } as React.CSSProperties}>
            <SpinBadge text="Pide ✱ Recoge ✱ Disfruta ✱ " center={<span className="text-3xl">¡Ñam!</span>} />
          </div>
        </div>
      </section>

      <div className="sticky top-16 z-30 border-b-2 border-carbon bg-crema md:top-20">
        <div className="container-page flex flex-col gap-3 py-3 sm:flex-row sm:items-center">
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:flex-1 sm:px-0">
            <CategoryChip active={!active} onClick={() => setActive(null)}>Todo</CategoryChip>
            {categories?.filter((c) => c.products.length > 0).map((c) => (
              <CategoryChip key={c.id} active={active === c.id} onClick={() => setActive(c.id)}>
                {c.name}
              </CategoryChip>
            ))}
          </div>
          <label className="relative sm:w-64">
            <span className="sr-only">Buscar en el menú</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-piedra" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar…"
              className="h-11 w-full rounded-[10px] border-2 border-carbon bg-hueso pl-9 pr-3 text-sm outline-none transition-shadow focus:shadow-[var(--shadow-hard)]"
            />
          </label>
        </div>
      </div>

      <div className="container-page py-10 md:py-14">
        {isPending && (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="aspect-[4/3.6]" />)}
          </div>
        )}
        {error && <ErrorState error={error} onRetry={() => refetch()} />}
        {categories && !hasProducts && (
          <EmptyState icon={<UtensilsCrossed className="size-7 text-piedra" />} title="Estamos actualizando el menú">
            Muy pronto verás aquí todos nuestros productos.
          </EmptyState>
        )}
        {hasProducts && visible.length === 0 && (
          <EmptyState title="Sin resultados">No encontramos productos para “{query}”.</EmptyState>
        )}

        <div className="space-y-20">
          {visible.map((c) => (
            <section key={c.id} id={c.slug} aria-labelledby={`cat-${c.id}`} className="scroll-mt-44">
              <Reveal className="mb-8 flex items-end gap-4 border-b-2 border-carbon pb-4">
                <h2 id={`cat-${c.id}`} className="h1">{c.name}</h2>
                <span className="mb-2 rounded-full border-2 border-carbon bg-maiz px-3 py-0.5 font-display text-lg font-black">{c.products.length}</span>
              </Reveal>
              {c.description && <p className="-mt-4 mb-8 max-w-2xl text-piedra">{c.description}</p>}
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {c.products.map((p, i) => (
                  <Reveal key={p.id} delay={(i % 3) * 80}><ProductCard product={p} onOpen={setSelected} /></Reveal>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>

      <ProductDialog product={selected} onClose={() => setSelected(null)} />
    </>
  )
}

function CategoryChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'h-11 shrink-0 rounded-[10px] border-2 border-carbon px-4 font-display text-lg font-extrabold uppercase tracking-wide transition-[background-color,color,transform]',
        active ? 'bg-carbon text-maiz' : 'bg-hueso hover:-translate-y-0.5',
      )}
    >
      {children}
    </button>
  )
}
