import type { CSSProperties } from 'react'
import { ArrowRight } from 'lucide-react'
import { ButtonLink } from '@/components/ui/button'
import { Reveal } from '@/components/shared/Reveal'
import { Marquee } from '@/components/shared/Marquee'
import { media, SAUCES, SAUCE_NAMES } from '@/config/media'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useParallax } from '@/hooks/useParallax'

// Textos basados en la página /nosotros actual del restaurante.
const CHAPTERS = [
  { title: 'Empezó con almuerzos', text: 'Comida corriente, plato de la casa, servida con la misma receta de hoy.', bg: 'bg-maiz' },
  { title: 'Pocas mesas, mucho corazón', text: 'Un local pequeño donde cada quien volvía por su presa favorita.', bg: 'bg-hueso' },
  { title: 'La sazón nunca fue de ensayo', text: 'La receta no se inventó con marketing: nació probada en casa y servida desde el primer día.', bg: 'bg-carbon text-hueso' },
]

export function AboutPage() {
  useDocumentTitle('Nosotros')
  const bg = useParallax<HTMLDivElement>(140)

  return (
    <>
      <section className="relative isolate overflow-hidden bg-carbon pb-20 pt-32 text-hueso md:pb-28 md:pt-44">
        <div ref={bg} data-parallax className="absolute -inset-y-20 inset-x-0 -z-10">
          <img src={media.local} alt="" className="size-full animate-kenburns object-cover opacity-45" />
        </div>
        <div className="container-page">
          <p className="fade-in kicker text-maiz">Nosotros</p>
          <h1 className="display mt-3 max-w-4xl">
            <span className="line-mask"><span style={{ '--d': '100ms' } as CSSProperties}>Antes de las alitas,</span></span>
            <span className="line-mask"><span className="text-maiz" style={{ '--d': '230ms' } as CSSProperties}>había una idea</span></span>
          </h1>
          <p className="fade-in mt-6 max-w-xl text-lg text-hueso/85" style={{ '--d': '420ms' } as CSSProperties}>
            La comunidad no se construyó sola. En Los Fundadores, desde 2022, esta es la historia.
          </p>
        </div>
      </section>

      <Marquee items={['Desde 2022', 'Los Fundadores', 'Valledupar']} className="bg-maiz text-carbon" speed={28} />

      <section className="bg-crema">
        <div className="container-page grid gap-6 py-20 md:grid-cols-3 md:py-28">
          {CHAPTERS.map((c, i) => (
            <Reveal key={c.title} delay={i * 120} className={`sticker flex flex-col p-7 ${c.bg} ${i === 1 ? 'md:translate-y-8' : ''}`}>
              <span className="price font-display text-6xl font-black opacity-30">0{i + 1}</span>
              <h2 className="h3 mt-6">{c.title}</h2>
              <p className="mt-3 leading-relaxed opacity-85">{c.text}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="border-y-2 border-carbon bg-crema">
        <div className="container-page grid items-center gap-12 py-20 md:grid-cols-2 md:gap-16 md:py-28">
          <Reveal variant="pop" rotate={-3}>
            <figure className="sticker overflow-hidden bg-hueso p-2">
              <img src={media.salsas} alt="Las cinco salsas de la casa servidas en recipientes individuales" loading="lazy" className="aspect-[4/3] w-full rounded-[6px] object-cover" />
            </figure>
          </Reveal>
          <div>
            <Reveal>
              <p className="kicker text-alas">La receta y las salsas</p>
              <h2 className="h1 mt-2">Cinco salsas propias</h2>
              <p className="mt-5 text-lg text-carbon/80">
                La comunidad se armó alrededor de algo concreto: alitas con receta propia y cinco salsas de la casa.
              </p>
            </Reveal>
            <ul className="mt-8 flex flex-wrap gap-3">
              {SAUCES.map((s, i) => (
                <Reveal as="li" key={s.name} variant="pop" delay={i * 90} rotate={i % 2 ? 2 : -2}>
                  <span className="inline-block rounded-full border-2 border-carbon px-4 py-2 font-display text-xl font-black uppercase shadow-[var(--shadow-hard)]" style={{ background: s.color, color: s.ink }}>
                    {s.name}
                  </span>
                </Reveal>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="bg-carbon text-hueso">
        <div className="container-page flex flex-col items-start gap-8 py-20 md:flex-row md:items-center md:justify-between">
          <Reveal><h2 className="display max-w-2xl">Ya nos conoces.<br /><span className="text-maiz">Ahora pruébanos.</span></h2></Reveal>
          <Reveal delay={150}><ButtonLink to="/menu" variant="yellow" size="lg">Ver el menú <ArrowRight /></ButtonLink></Reveal>
        </div>
        <span className="sr-only">Salsas: {SAUCE_NAMES.join(', ')}</span>
      </section>
    </>
  )
}
