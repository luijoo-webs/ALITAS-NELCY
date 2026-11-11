import { MapPin, Navigation, Phone } from 'lucide-react'
import { Reveal } from '@/components/shared/Reveal'
import { buttonClass } from '@/components/ui/button'
import { useSettings } from '../hooks/useRestaurant'
import { HoursList } from './HoursList'

export function mapsQuery(s: { address: string | null; neighborhood: string | null; city: string | null }) {
  return encodeURIComponent(['Alitas Nelcy', s.address, s.neighborhood, s.city].filter(Boolean).join(', '))
}

export function VisitSection() {
  const { data: s } = useSettings()
  if (!s) return null
  const q = mapsQuery(s)
  const directions = s.maps_url || `https://www.google.com/maps/search/?api=1&query=${q}`

  return (
    <section className="border-t-2 border-carbon bg-carbon text-hueso">
      <div className="container-page grid gap-12 py-20 md:grid-cols-[1fr_1.1fr] md:gap-16 md:py-28">
        <Reveal>
          <p className="kicker text-maiz">Visítanos</p>
          <h2 className="h1 mt-2">En Los<br />Fundadores</h2>
          <ul className="mt-8 space-y-4 text-lg text-hueso/85">
            {s.address && (
              <li className="flex gap-3">
                <MapPin className="mt-1 size-5 shrink-0 text-maiz" />
                <span>{s.address}{s.neighborhood && `, barrio ${s.neighborhood}`}{s.city && `, ${s.city}`}</span>
              </li>
            )}
            {s.phone && (
              <li className="flex gap-3">
                <Phone className="mt-1 size-5 shrink-0 text-maiz" />
                <a href={`tel:${s.phone.replace(/\s/g, '')}`} className="hover:text-maiz">{s.phone}</a>
              </li>
            )}
          </ul>
          <div className="mt-10 max-w-sm rounded-[var(--radius-card)] border-2 border-hueso/15 p-5">
            <h3 className="kicker text-maiz">Horario</h3>
            <HoursList className="mt-3 text-hueso/85" />
          </div>
          <a href={directions} target="_blank" rel="noreferrer" className={buttonClass({ variant: 'yellow' }, 'mt-10')}>
            <Navigation /> Cómo llegar
          </a>
        </Reveal>
        <Reveal variant="wipe" delay={150} className="sticker min-h-[340px] overflow-hidden border-hueso/20 bg-carbon-800 shadow-[7px_7px_0_0_var(--color-alas)]">
          <iframe
            title="Mapa de ubicación de Alitas Nelcy"
            src={`https://www.google.com/maps?q=${q}&output=embed`}
            className="size-full min-h-[340px] border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </Reveal>
      </div>
    </section>
  )
}
