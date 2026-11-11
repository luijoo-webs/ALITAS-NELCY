import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import * as Dialog from '@radix-ui/react-dialog'
import { Menu, UserRound, X } from 'lucide-react'
import { ButtonLink } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { CartButton } from '@/features/cart/CartDrawer'
import { media } from '@/config/media'
import { cn } from '@/lib/cn'

const NAV = [
  { to: '/menu', label: 'Menú' },
  { to: '/nosotros', label: 'Nosotros' },
  { to: '/contacto', label: 'Contacto' },
]

export function SiteHeader() {
  const { pathname } = useLocation()
  const { user } = useAuth()
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => setOpen(false), [pathname])

  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-hueso/10 bg-carbon/95 text-hueso backdrop-blur">
      <div className={cn('container-page flex items-center justify-between gap-6 transition-[height] duration-300', scrolled ? 'h-16' : 'h-16 md:h-20')}>
        <Link to="/" className="group shrink-0" aria-label="Alitas Nelcy, inicio">
          <img
            src={media.logo}
            alt="Alitas Nelcy"
            width={96}
            height={64}
            className={cn('w-auto saturate-[.8] transition-[height,transform] duration-300 group-hover:-rotate-3 group-hover:scale-105', scrolled ? 'h-12' : 'h-12 md:h-[60px]')}
          />
        </Link>

        <nav aria-label="Principal" className="hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                cn(
                  'relative px-4 py-2 font-display text-xl font-extrabold uppercase tracking-wide',
                  'after:absolute after:inset-x-4 after:bottom-1 after:h-[3px] after:origin-left after:scale-x-0 after:bg-maiz after:transition-transform after:duration-300 hover:after:scale-x-100',
                  isActive && 'after:scale-x-100',
                )
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            to={user ? '/cuenta' : '/ingresar'}
            className="grid size-11 place-items-center rounded-[10px] border-2 border-transparent transition-colors hover:border-hueso/30"
            aria-label={user ? 'Mi cuenta' : 'Ingresar'}
          >
            <UserRound className="size-5" />
          </Link>
          <CartButton className="relative grid size-11 place-items-center rounded-[10px] border-2 border-transparent transition-colors hover:border-hueso/30" />
          <ButtonLink to="/menu" size="sm" className="hidden sm:inline-flex">
            Pedir ahora
          </ButtonLink>

          <Dialog.Root open={open} onOpenChange={setOpen}>
            <Dialog.Trigger className="grid size-11 place-items-center rounded-[10px] border-2 border-hueso/30 md:hidden" aria-label="Abrir menú">
              <Menu className="size-5" />
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 z-50 bg-carbon/60" />
              <Dialog.Content className="fade-in fixed inset-0 z-50 flex flex-col bg-carbon p-5 text-hueso">
                <div className="flex items-center justify-between">
                  <img src={media.logo} alt="" className="h-12 w-auto saturate-[.8]" />
                  <Dialog.Close className="grid size-11 place-items-center rounded-[10px] border-2 border-carbon bg-hueso text-carbon" aria-label="Cerrar menú">
                    <X className="size-5" />
                  </Dialog.Close>
                </div>
                <Dialog.Title className="sr-only">Navegación</Dialog.Title>
                <Dialog.Description className="sr-only">Enlaces principales del sitio</Dialog.Description>
                <nav className="mt-10 flex flex-col" aria-label="Móvil">
                  {[{ to: '/', label: 'Inicio' }, ...NAV, { to: user ? '/cuenta' : '/ingresar', label: user ? 'Mi cuenta' : 'Ingresar' }].map((n, i) => (
                    <NavLink
                      key={n.to}
                      to={n.to}
                      end
                      style={{ '--d': `${80 + i * 60}ms` } as React.CSSProperties}
                      className={({ isActive }) =>
                        cn('fade-in border-b-2 border-hueso/20 py-3 font-display text-5xl font-black uppercase', isActive && 'text-maiz')
                      }
                    >
                      {n.label}
                    </NavLink>
                  ))}
                </nav>
                <ButtonLink to="/menu" variant="yellow" size="lg" className="mt-auto">
                  Pedir ahora
                </ButtonLink>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        </div>
      </div>
    </header>
  )
}
