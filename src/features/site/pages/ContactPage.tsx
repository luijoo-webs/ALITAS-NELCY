import type { CSSProperties } from 'react'
import { MessageCircle, Phone } from 'lucide-react'
import { InstagramIcon } from '@/components/shared/icons'
import { ErrorState } from '@/components/shared/states'
import { buttonClass } from '@/components/ui/button'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { whatsappLink } from '@/lib/format'
import { useSettings } from '../hooks/useRestaurant'
import { VisitSection } from '../components/VisitSection'

export function ContactPage() {
  useDocumentTitle('Contacto')
  const { data: s, error } = useSettings()

  return (
    <>
      <section className="bg-crema pb-16 pt-32 md:pb-24 md:pt-44">
        <div className="container-page">
          <p className="fade-in kicker text-alas">Contacto</p>
          <h1 className="display mt-3">
            <span className="line-mask"><span style={{ '--d': '100ms' } as CSSProperties}>Hablemos</span></span>
          </h1>
          <p className="fade-in mt-5 max-w-xl text-lg text-carbon/80" style={{ '--d': '300ms' } as CSSProperties}>
            Escríbenos, llámanos o pasa por el local.
          </p>
          {error && <ErrorState error={error} className="mt-8 border-carbon/20" />}
          {s && (
            <div className="fade-in mt-10 flex flex-wrap gap-4" style={{ '--d': '450ms' } as CSSProperties}>
              {s.whatsapp && (
                <a href={whatsappLink(s.whatsapp)} target="_blank" rel="noreferrer" className={buttonClass({ size: 'lg' })}>
                  <MessageCircle /> WhatsApp
                </a>
              )}
              {s.phone && (
                <a href={`tel:${s.phone.replace(/\s/g, '')}`} className={buttonClass({ variant: 'light', size: 'lg' })}>
                  <Phone /> Llamar
                </a>
              )}
              {s.instagram_url && (
                <a href={s.instagram_url} target="_blank" rel="noreferrer" className={buttonClass({ variant: 'dark', size: 'lg' })}>
                  <InstagramIcon /> Instagram
                </a>
              )}
            </div>
          )}
        </div>
      </section>
      <VisitSection />
    </>
  )
}
