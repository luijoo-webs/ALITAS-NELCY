import { useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, MessageCircle } from 'lucide-react'
import type { Product } from '@/types/domain'
import { ButtonLink, buttonClass } from '@/components/ui/button'
import { Reveal } from '@/components/shared/Reveal'
import { Marquee, Star } from '@/components/shared/Marquee'
import { SpinBadge } from '@/components/shared/SpinBadge'
import { OpenStatus } from '@/components/shared/OpenStatus'
import { media, SAUCES, SAUCE_NAMES } from '@/config/media'
import { formatCOP, whatsappLink } from '@/lib/format'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useParallax } from '@/hooks/useParallax'
import { useMenu, usePromotions } from '@/features/menu/hooks/useMenu'
import { ProductCard } from '@/features/menu/components/ProductCard'
import { ProductDialog } from '@/features/menu/components/ProductDialog'
import { useSettings } from '../hooks/useRestaurant'
import { VisitSection } from '../components/VisitSection'

export function HomePage() {
  useDocumentTitle()
  const [selected, setSelected] = useState<Product | null>(null)

  return (
    <>
      <Hero />
      <CrossedTapes />
      <MenuParts />
      <FeaturedSection onOpen={setSelected} />
      <GallerySection />
      <SaucesSection />
      <PromotionsSection />
      <VisitSection />
      <FinalCta />
      <ProductDialog product={selected} onClose={() => setSelected(null)} />
    </>
  )
}

/* ── Hero ─────────────────────────────────────────────────────────── */

function Hero() {
  const { data: settings } = useSettings()
  const bg = useParallax<HTMLDivElement>(160)
  const lines: { text: string; className?: string }[] = [
    { text: 'Alitas' },
    { text: 'crocantes,' },
    { text: 'cinco salsas', className: 'text-hueso' },
    { text: 'de la casa', className: 'text-hueso' },
  ]

  return (
    <section className="relative isolate overflow-hidden bg-carbon pt-16 text-hueso md:pt-20">
      <div ref={bg} data-parallax className="absolute -inset-y-24 inset-x-0 -z-10">
        <img src={media.combo4} alt="" className="size-full animate-kenburns object-cover" {...{ fetchpriority: 'high' }} />
      </div>
      <div className="absolute inset-0 -z-10 bg-carbon/60" aria-hidden />

      <div className="container-page relative flex min-h-[calc(100svh-4rem)] flex-col justify-end pb-16 pt-14 md:min-h-[calc(100svh-5rem)] md:pb-24">
        <p className="fade-in kicker flex flex-wrap items-center gap-3 text-hueso/90" style={{ '--d': '100ms' } as CSSProperties}>
          Alitas <Star className="size-3.5 text-maiz" /> Almuerzos <Star className="size-3.5 text-maiz" /> Valledupar
        </p>

        <h1 className="display mt-4 text-maiz">
          {lines.map((l, i) => (
            <span key={l.text} className="line-mask">
              <span className={l.className} style={{ '--d': `${200 + i * 110}ms` } as CSSProperties}>{l.text}</span>
            </span>
          ))}
        </h1>

        <p className="fade-in mt-6 max-w-md text-lg leading-relaxed text-hueso/85" style={{ '--d': '750ms' } as CSSProperties}>
          Combos con papas a la francesa y almuerzos de comida corriente en Los Fundadores. Desde 2022.
        </p>

        <div className="fade-in mt-8 flex flex-wrap items-center gap-4" style={{ '--d': '880ms' } as CSSProperties}>
          <ButtonLink to="/menu" size="lg">
            Ver el menú <ArrowRight />
          </ButtonLink>
          {settings?.whatsapp && (
            <a href={whatsappLink(settings.whatsapp, 'Hola, quiero hacer un pedido')} target="_blank" rel="noreferrer" className={buttonClass({ variant: 'yellow', size: 'lg' })}>
              <MessageCircle /> WhatsApp
            </a>
          )}
          <OpenStatus className="ml-1 text-hueso/90" />
        </div>

        <div className="pointer-events-none absolute bottom-10 right-4 hidden animate-float sm:block md:bottom-20 md:right-8" style={{ '--r': '8deg' } as CSSProperties}>
          <SpinBadge
            text="Desde 2022 ✱ Los Fundadores ✱ Valledupar ✱ "
            center={<><span className="block text-5xl md:text-6xl">5</span><span className="block text-lg md:text-xl">salsas</span></>}
          />
        </div>
      </div>
    </section>
  )
}

function CrossedTapes() {
  return (
    <div className="relative z-10 -my-6 overflow-hidden py-8 md:-my-8 md:py-10" role="img" aria-label={`Nuestras salsas: ${SAUCE_NAMES.join(', ')}`}>
      <Marquee items={SAUCE_NAMES} tilt={-2.2} speed={38} className="-mx-4 bg-alas text-maiz" label="" />
      <Marquee items={['Alitas', 'Combos', 'Almuerzos', 'Desde 2022']} tilt={1.6} reverse speed={30} className="-mx-4 -mt-3 bg-maiz text-carbon" label="" />
    </div>
  )
}

/* ── El menú: alitas y almuerzos, las dos partes de la misma carta ── */

const MENU_PARTS = [
  { title: 'Alitas', text: 'Combos con papas a la francesa: para uno, para compartir o para el grupo.', img: media.combo2, alt: 'Combo de alitas con papas a la francesa' },
  { title: 'Almuerzos', text: 'Comida corriente al mediodía, con la sazón con la que empezó todo.', img: media.local2, alt: 'Mesas del restaurante' },
]

function MenuParts() {
  return (
    <section className="bg-hueso">
      <div className="container-page py-20 md:py-28">
        <Reveal className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="kicker text-alas">La carta</p>
            <h2 className="h1 mt-2">Nuestro menú</h2>
          </div>
          <ButtonLink to="/menu" variant="dark">Ver menú completo <ArrowRight /></ButtonLink>
        </Reveal>
        <div className="mt-12 grid gap-8 md:grid-cols-2">
          {MENU_PARTS.map((m, i) => (
            <Reveal key={m.title} delay={i * 120}>
              <Link to="/menu" className="sticker group block overflow-hidden bg-crema transition-transform duration-300 hover:-translate-y-1">
                <div className="aspect-[4/3] overflow-hidden border-b-2 border-carbon">
                  <img src={m.img} alt={m.alt} loading="lazy" className="size-full object-cover transition-transform duration-700 group-hover:scale-110" />
                </div>
                <div className="flex items-end justify-between gap-4 p-6 md:p-8">
                  <div>
                    <h3 className="h2">{m.title}</h3>
                    <p className="mt-2 max-w-xs text-carbon/75">{m.text}</p>
                  </div>
                  <span className="grid size-14 shrink-0 place-items-center rounded-full border-2 border-carbon bg-maiz transition-transform duration-300 group-hover:rotate-45">
                    <ArrowUpRight className="size-6" />
                  </span>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ── Destacados (desde Supabase; sin destacados la sección no aparece) ── */

function FeaturedSection({ onOpen }: { onOpen: (p: Product) => void }) {
  const { data } = useMenu()
  const featured = (data ?? []).flatMap((c) => c.products).filter((p) => p.is_featured).slice(0, 6)
  if (featured.length === 0) return null

  return (
    <section className="border-y-2 border-carbon bg-crema">
      <div className="container-page py-20 md:py-28">
        <Reveal className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="kicker text-alas">Los favoritos</p>
            <h2 className="h1 mt-2">Destacados de la casa</h2>
          </div>
          <ButtonLink to="/menu" variant="light">Menú completo <ArrowRight /></ButtonLink>
        </Reveal>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((p, i) => (
            <Reveal key={p.id} delay={i * 90}><ProductCard product={p} onOpen={onOpen} /></Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ── Galería roja con fotos inclinadas que se deslizan con el scroll ── */

const GALLERY = [
  { src: media.local2, alt: 'Salón de Alitas Nelcy', r: -4 },
  { src: media.combo5, alt: 'Combo grande de alitas', r: 3 },
  { src: media.salsas, alt: 'Las cinco salsas de la casa', r: -2 },
  { src: media.combo4, alt: 'Combo de alitas con papas', r: 4 },
  { src: media.local, alt: 'Interior con luces de neón', r: -3 },
  { src: media.combo2, alt: 'Alitas con salsa', r: 2 },
]

function GallerySection() {
  const row = useParallax<HTMLDivElement>(-260, 'x')
  return (
    <section className="overflow-hidden border-y-2 border-carbon bg-carbon py-20 text-hueso md:py-28">
      <div className="container-page grid gap-6 md:grid-cols-[1.2fr_1fr] md:items-end">
        <Reveal>
          <p className="kicker text-maiz">Desde 2022</p>
          <h2 className="h1 mt-2">Hechas en casa,<br />servidas con sazón</h2>
        </Reveal>
        <Reveal delay={120}>
          <p className="max-w-md text-lg text-hueso/90">
            Empezamos con almuerzos caseros y pocas mesas. Después llegaron las alitas, con salsas propias que hoy son la firma de la casa.
          </p>
        </Reveal>
      </div>

      <div ref={row} data-parallax className="mt-14 flex w-max gap-6 pl-[8vw] md:gap-8">
        {GALLERY.map((g, i) => (
          <Reveal key={g.src + i} variant="pop" rotate={g.r} delay={i * 80} className="shrink-0">
            <figure className="sticker w-[62vw] max-w-[340px] overflow-hidden bg-hueso p-2 transition-transform duration-300 hover:!rotate-0 hover:scale-105 sm:w-[300px]">
              <img src={g.src} alt={g.alt} loading="lazy" className="aspect-[4/5] w-full rounded-[6px] object-cover" />
            </figure>
          </Reveal>
        ))}
      </div>
    </section>
  )
}

/* ── Salsas ───────────────────────────────────────────────────────── */

function SaucesSection() {
  return (
    <section className="bg-crema">
      <div className="container-page py-20 md:py-28">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="kicker text-alas">La firma de la casa</p>
          <h2 className="display mt-2">Las 5 salsas</h2>
          <p className="mt-4 text-lg text-carbon/80">Receta propia. Elige tu favorita para acompañar las alitas.</p>
        </Reveal>

        <ul className="mt-14 flex flex-wrap justify-center gap-5 md:gap-7">
          {SAUCES.map((s, i) => (
            <Reveal as="li" key={s.name} variant="pop" rotate={[-6, 4, -3, 5, -4][i]} delay={i * 110}>
              <div
                className="grid size-36 cursor-default place-items-center rounded-full border-2 border-carbon p-4 text-center shadow-[var(--shadow-hard)] hover:animate-wobble md:size-44"
                style={{ background: s.color, color: s.ink }}
              >
                <span className="font-display text-2xl font-black uppercase leading-[0.9] md:text-3xl">{s.name}</span>
              </div>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  )
}

/* ── Promociones (desde Supabase; sin promociones vigentes no aparece) ── */

function PromotionsSection() {
  const { data } = usePromotions()
  if (!data || data.length === 0) return null

  return (
    <section className="border-t-2 border-carbon bg-crema">
      <div className="container-page py-20 md:py-28">
        <Reveal>
          <p className="kicker text-alas">Solo por ahora</p>
          <h2 className="h1 mt-2">Promociones</h2>
        </Reveal>
        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {data.map((p, i) => (
            <Reveal key={p.id} delay={i * 100} className="sticker relative overflow-hidden bg-hueso p-7">
              <span className="absolute -right-3 -top-3 rotate-12 rounded-full border-2 border-carbon bg-maiz px-4 py-2 font-display text-lg font-black uppercase">¡Promo!</span>
              <p className="h2 text-alas">
                {p.type === 'percent' ? `-${p.value}%` : p.type === 'fixed' ? `-${formatCOP(p.value)}` : p.label || p.name}
              </p>
              <p className="mt-2 font-display text-2xl font-extrabold uppercase">{p.name}</p>
              {p.description && <p className="mt-2 text-piedra">{p.description}</p>}
              {p.products.length > 0 && <p className="mt-3 text-sm">Aplica en: {p.products.map((x) => x.name).join(', ')}</p>}
              {p.ends_at && <p className="mt-3 text-xs text-piedra">Hasta el {new Date(p.ends_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })}</p>}
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ── Cierre ───────────────────────────────────────────────────────── */

function FinalCta() {
  return (
    <section className="overflow-hidden border-t-2 border-carbon bg-crema">
      <Marquee items={['¿Hambre?', 'Pide ya', 'Alitas Nelcy']} speed={26} className="border-t-0 bg-carbon text-maiz" />
      <div className="container-page flex flex-col items-start gap-8 py-16 md:flex-row md:items-center md:justify-between md:py-20">
        <Reveal>
          <h2 className="display">Te esperamos<br /><span className="text-alas">con hambre</span></h2>
        </Reveal>
        <Reveal delay={150}>
          <ButtonLink to="/menu" size="lg">Ver el menú <ArrowRight /></ButtonLink>
        </Reveal>
      </div>
    </section>
  )
}
