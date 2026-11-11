import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { SiteHeader } from './SiteHeader'
import { SiteFooter } from './SiteFooter'

export function PublicLayout() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    if (!hash) window.scrollTo(0, 0)
  }, [pathname, hash])

  return (
    <>
      <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-maiz focus:px-4 focus:py-2 focus:text-carbon">
        Saltar al contenido
      </a>
      <SiteHeader />
      <main id="contenido">
        <Outlet />
      </main>
      <SiteFooter />
    </>
  )
}
