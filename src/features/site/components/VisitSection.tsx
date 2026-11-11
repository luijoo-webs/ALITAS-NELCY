import { useState } from 'react'
import { MapPin, Navigation, Phone, X } from 'lucide-react'
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
  const waze = `https://waze.com/ul?q=${q}&navigate=yes`

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
        <Reveal variant="wipe" delay={150} className="sticker relative min-h-[340px] overflow-hidden border-hueso/20 bg-carbon-800 shadow-[7px_7px_0_0_var(--color-alas)]">
          <MapCard q={q} directions={directions} waze={waze} />
        </Reveal>
      </div>
    </section>
  )
}


function MapCard({ q, directions, waze }: { q: string; directions: string; waze: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative size-full min-h-[340px]">
      <iframe
        title="Mapa de ubicación de Alitas Nelcy"
        src={`https://www.google.com/maps?q=${q}&output=embed`}
        className="pointer-events-none size-full min-h-[340px] border-0"
        loading="lazy"
        tabIndex={-1}
        referrerPolicy="no-referrer-when-downgrade"
      />
      {/* El iframe no recibe clics: tocar el mapa abre el selector de app. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Abrir la ubicación en Google Maps o Waze"
        className="absolute inset-0 flex items-end justify-center bg-gradient-to-t from-carbon/70 via-transparent to-transparent p-5 text-left focus-visible:outline-2 focus-visible:outline-maiz"
      >
        <span className="inline-flex items-center gap-2 rounded-full bg-hueso px-4 py-2 text-sm font-semibold text-carbon shadow-lg">
          <MapPin className="size-4 text-alas" /> Toca para abrir en Maps o Waze
        </span>
      </button>
      {open && (
        <div className="absolute inset-0 flex items-center justify-center bg-carbon/80 p-6 backdrop-blur-sm" role="dialog" aria-label="Elige la app">
          <div className="w-full max-w-xs rounded-xl bg-hueso p-5 text-carbon shadow-xl">
            <div className="flex items-center justify-between">
              <p className="font-display text-lg font-black uppercase">Abrir con</p>
              <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar" className="rounded-full p-1 hover:bg-carbon/10"><X className="size-5" /></button>
            </div>
            <div className="mt-4 grid gap-2">
              <a href={directions} target="_blank" rel="noreferrer" onClick={() => setOpen(false)} className={buttonClass({ variant: 'primary' }, 'w-full justify-center')}>Google Maps</a>
              <a href={waze} target="_blank" rel="noreferrer" onClick={() => setOpen(false)} className={buttonClass({ variant: 'yellow' }, 'w-full justify-center')}>Waze</a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
