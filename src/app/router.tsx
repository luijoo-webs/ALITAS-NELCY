import { createBrowserRouter } from 'react-router-dom'
import { PublicLayout } from './layouts/PublicLayout'
import { RequireAuth } from './RequireAuth'
import { HomePage } from '@/features/site/pages/HomePage'
import { MenuPage } from '@/features/menu/pages/MenuPage'
import { AboutPage } from '@/features/site/pages/AboutPage'
import { ContactPage } from '@/features/site/pages/ContactPage'
import { NotFoundPage } from '@/features/site/pages/NotFoundPage'

// Autenticación y cuenta se cargan bajo demanda (no pesan en la página de inicio).
export const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/menu', element: <MenuPage /> },
      { path: '/nosotros', element: <AboutPage /> },
      { path: '/contacto', element: <ContactPage /> },
      { path: '/ingresar', lazy: async () => ({ Component: (await import('@/features/auth/pages/LoginPage')).LoginPage }) },
      { path: '/registro', lazy: async () => ({ Component: (await import('@/features/auth/pages/RegisterPage')).RegisterPage }) },
      { path: '/recuperar', lazy: async () => ({ Component: (await import('@/features/auth/pages/ForgotPasswordPage')).ForgotPasswordPage }) },
      { path: '/restablecer', lazy: async () => ({ Component: (await import('@/features/auth/pages/ResetPasswordPage')).ResetPasswordPage }) },
      {
        path: '/cuenta',
        lazy: async () => {
          const { AccountPage } = await import('@/features/account/pages/AccountPage')
          return { element: <RequireAuth><AccountPage /></RequireAuth> }
        },
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  {
    // Panel: se carga aparte; RequireAuth exige sesión y AdminLayout exige un rol del restaurante.
    path: '/admin',
    lazy: async () => {
      const { AdminLayout } = await import('./layouts/AdminLayout')
      return { element: <RequireAuth><AdminLayout /></RequireAuth> }
    },
    children: [
      { index: true, lazy: async () => ({ Component: (await import('@/features/admin/pages/DashboardPage')).DashboardPage }) },
    ],
  },
])
