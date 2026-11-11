import { Link } from 'react-router-dom'
import { MapPin, MessageCircle, Phone } from 'lucide-react'
import { InstagramIcon } from '@/components/shared/icons'
import { useSettings } from '@/features/site/hooks/useRestaurant'
import { HoursList } from '@/features/site/components/HoursList'
import { media } from '@/config/media'
import { whatsappLink } from '@/lib/format'

const socialClass =
  'grid size-11 place-items-center rounded-[10px] border-2 border-hueso/25 transition-[transform,border-color,color] hover:-translate-y-0.5 hover:border-maiz hover:text-maiz'

export function SiteFooter() {
  const { data: s } = useSettings()

  return (
    <footer className="border-t-2 border-carbon bg-carbon text-hueso">
      <div className="container-page grid gap-12 py-16 md:grid-cols-[1.3fr_1fr_0.7fr] md:py-20">
        <div className="max-w-xs">
          <img src={media.logo} alt="Alitas Nelcy" className="h-20 w-auto -rotate-3 saturate-[.8]" width={120} height={80} loading="lazy" />
          <p className="mt-6 leading-relaxed text-hueso/70">
            Alitas crocantes con cinco salsas de la casa y almuerzos de comida corriente en Valledupar. Desde 2022.
          </p>
          <div className="mt-6 flex gap-2">
            {s?.instagram_url && (
              <a href={s.instagram_url} target="_blank" rel="noreferrer" aria-label="Instagram" className={socialClass}>
                <InstagramIcon className="size-5" />
              </a>
            )}
            {s?.whatsapp && (
              <a href={whatsappLink(s.whatsapp)} target="_blank" rel="noreferrer" aria-label="WhatsApp" className={socialClass}>
                <MessageCircle className="size-5" />
              </a>
            )}
          </div>
        </div>

        {s ? (
          <div>
            <h2 className="kicker text-maiz">Visítanos</h2>
            <ul className="mt-4 space-y-3 text-hueso/80">
              {s.address && (
                <li className="flex gap-2.5">
                  <MapPin className="mt-1 size-4 shrink-0" />
                  <span>{s.address}{s.neighborhood && `, ${s.neighborhood}`}{s.city && <><br />{s.city}</>}</span>
                </li>
              )}
              {s.phone && (
                <li className="flex gap-2.5">
                  <Phone className="mt-1 size-4 shrink-0" />
                  <a href={`tel:${s.phone.replace(/\s/g, '')}`} className="hover:text-maiz">{s.phone}</a>
                </li>
              )}
            </ul>
            <h2 className="kicker mt-8 text-maiz">Horario</h2>
            <HoursList className="mt-4 max-w-xs text-hueso/80" />
          </div>
        ) : <div />}

        <div>
          <h2 className="kicker text-maiz">Navegar</h2>
          <ul className="mt-4 space-y-1 font-display text-2xl font-extrabold uppercase">
            {[['/menu', 'Menú'], ['/nosotros', 'Nosotros'], ['/contacto', 'Contacto'], ['/cuenta', 'Mi cuenta']].map(([to, label]) => (
              <li key={to}>
                <Link to={to} className="inline-block transition-[color,transform] hover:translate-x-1 hover:text-maiz">{label}</Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="border-t-2 border-hueso/10">
        <div className="container-page flex flex-col gap-2 py-6 text-sm text-hueso/50 sm:flex-row sm:justify-between">
          <p>© {new Date().getFullYear()} Alitas Nelcy · Valledupar, Cesar</p>
          <p>Desarrollado por NEXO</p>
        </div>
      </div>
    </footer>
  )
}
