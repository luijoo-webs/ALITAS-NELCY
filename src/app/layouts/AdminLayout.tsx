import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import * as Dialog from '@radix-ui/react-dialog'
import {
  BarChart3, Boxes, ClipboardList, ExternalLink, LayoutDashboard, LogOut, Menu, Settings, ShieldCheck,
  ShoppingBag, Store, Truck, UsersRound, UtensilsCrossed, X, type LucideIcon,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { media } from '@/config/media'
import { cn } from '@/lib/cn'
import { ErrorState, Skeleton } from '@/components/shared/states'
import { ButtonLink } from '@/components/ui/button'
import { usePermissions } from '@/features/admin/hooks/usePermissions'

type Item = { to: string; label: string; icon: LucideIcon; perm: string; soon?: string }

// Las secciones con `soon` aún no existen: se muestran deshabilitadas con la fase en que llegan.
const NAV: { group: string; items: Item[] }[] = [
  { group: 'General', items: [{ to: '/admin', label: 'Dashboard', icon: LayoutDashboard, perm: 'dashboard.read' }] },
  {
    group: 'Operación',
    items: [
      { to: '/admin/pedidos', label: 'Pedidos', icon: ClipboardList, perm: 'orders.read' },
      { to: '/admin/venta', label: 'Venta manual', icon: Store, perm: 'orders.create_manual' },
      { to: '/admin/catalogo', label: 'Menú y productos', icon: UtensilsCrossed, perm: 'catalog.manage' },
      { to: '/admin/clientes', label: 'Clientes', icon: UsersRound, perm: 'customers.read' },
    ],
  },
  {
    group: 'Inventario',
    items: [
      { to: '/admin/inventario', label: 'Ingredientes', icon: Boxes, perm: 'inventory.read' },
      { to: '/admin/compras', label: 'Compras', icon: Truck, perm: 'purchases.manage' },
    ],
  },
  {
    group: 'Administración',
    items: [
      { to: '/admin/reportes', label: 'Reportes', icon: BarChart3, perm: 'reports.read' },
      { to: '/admin/usuarios', label: 'Usuarios y roles', icon: ShieldCheck, perm: 'users.manage' },
      { to: '/admin/configuracion', label: 'Configuración', icon: Settings, perm: 'settings.manage' },
    ],
  },
]

function Sidebar({ can }: { can: (p: string) => boolean }) {
  const { user, signOut } = useAuth()
  return (
    <div className="flex h-full flex-col bg-carbon text-hueso">
      <Link to="/admin" className="flex items-center gap-3 px-5 py-5">
        <img src={media.logo} alt="" className="h-10 w-auto saturate-[.8]" />
        <span className="font-display text-lg font-extrabold uppercase leading-none tracking-wide">Panel</span>
      </Link>
      <nav aria-label="Panel" className="flex-1 space-y-6 overflow-y-auto px-3 py-2">
        {NAV.map((g) => {
          const items = g.items.filter((i) => can(i.perm))
          if (items.length === 0) return null
          return (
            <div key={g.group}>
              <p className="px-3 pb-2 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-hueso/40">{g.group}</p>
              <ul className="space-y-0.5">
                {items.map((i) => (
                  <li key={i.to}>
                    {i.soon ? (
                      <span className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-sm text-hueso/35" aria-disabled title={`Disponible en la ${i.soon}`}>
                        <i.icon className="size-[18px]" /> {i.label}
                        <span className="ml-auto rounded bg-hueso/8 px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide">Pronto</span>
                      </span>
                    ) : (
                      <NavLink
                        to={i.to}
                        end
                        className={({ isActive }) =>
                          cn('flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                            isActive ? 'bg-maiz text-carbon' : 'text-hueso/80 hover:bg-hueso/8 hover:text-hueso')
                        }
                      >
                        <i.icon className="size-[18px]" /> {i.label}
                      </NavLink>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </nav>
      <div className="space-y-1 border-t border-hueso/10 p-3">
        <Link to="/" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-hueso/70 hover:bg-hueso/8 hover:text-hueso">
          <ExternalLink className="size-[18px]" /> Ver sitio público
        </Link>
        <button onClick={() => signOut()} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-hueso/70 hover:bg-hueso/8 hover:text-hueso">
          <LogOut className="size-[18px]" /> Cerrar sesión
        </button>
        <p className="truncate px-3 pt-2 text-xs text-hueso/40">{user?.email}</p>
      </div>
    </div>
  )
}

export function AdminLayout() {
  const { pathname } = useLocation()
  const { can, isStaff, isPending, error } = usePermissions()
  const [open, setOpen] = useState(false)
  useEffect(() => setOpen(false), [pathname])

  if (error) return <div className="grid min-h-svh place-items-center bg-hueso p-6"><ErrorState error={error} /></div>
  if (isPending) return <div className="grid min-h-svh place-items-center bg-hueso"><Skeleton className="h-10 w-40" /></div>
  if (!isStaff) {
    return (
      <div className="grid min-h-svh place-items-center bg-hueso p-6 text-center">
        <div>
          <ShoppingBag className="mx-auto size-8 text-piedra" />
          <h1 className="h3 mt-4">Sin acceso al panel</h1>
          <p className="mt-2 max-w-sm text-piedra">Tu cuenta no tiene un rol del restaurante. Pídele al administrador que te asigne uno.</p>
          <ButtonLink to="/" variant="dark" className="mt-6">Volver al sitio</ButtonLink>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-svh bg-[#f5f1ea] text-carbon">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">
        <Sidebar can={can} />
      </aside>

      <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-carbon/10 bg-carbon px-4 text-hueso lg:hidden">
        <Dialog.Root open={open} onOpenChange={setOpen}>
          <Dialog.Trigger className="grid size-10 place-items-center rounded-lg hover:bg-hueso/10" aria-label="Abrir menú del panel">
            <Menu className="size-5" />
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-40 bg-carbon/60" />
            <Dialog.Content className="fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw]">
              <Dialog.Title className="sr-only">Menú del panel</Dialog.Title>
              <Dialog.Description className="sr-only">Secciones del panel administrativo</Dialog.Description>
              <Dialog.Close className="absolute right-3 top-5 z-10 grid size-9 place-items-center rounded-lg text-hueso hover:bg-hueso/10" aria-label="Cerrar">
                <X className="size-5" />
              </Dialog.Close>
              <Sidebar can={can} />
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
        <img src={media.logo} alt="Alitas Nelcy" className="h-8 w-auto saturate-[.8]" />
        <span className="font-display text-base font-extrabold uppercase tracking-wide">Panel</span>
      </header>

      <main id="contenido" className="lg:pl-64">
        <Outlet />
      </main>
    </div>
  )
}
