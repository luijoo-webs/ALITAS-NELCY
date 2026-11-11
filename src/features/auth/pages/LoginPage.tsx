import { useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Field, FormAlert } from '@/components/ui/field'
import { useAuth } from '@/contexts/AuthContext'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { loginSchema, type LoginInput } from '../schemas'
import { authErrorMessage, resendConfirmation, signIn } from '../services/auth'
import { AuthShell } from '../components/AuthShell'

/** Solo rutas internas, para no usar ?next= como redirección abierta. */
// Los navegadores tratan "/\\" como "//", así que también se rechazan barras invertidas y controles.
export const safeNext = (v: string | null) =>
  v && /^\/(?![/\\])[^\\\s]*$/.test(v) ? v : '/cuenta'

export function LoginPage() {
  useDocumentTitle('Ingresar')
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [unconfirmed, setUnconfirmed] = useState<string | null>(null)
  const [resent, setResent] = useState(false)
  const next = safeNext(params.get('next'))

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) })

  if (user) return <Navigate to={next} replace />

  const onSubmit = handleSubmit(async (values) => {
    setError(null)
    setUnconfirmed(null)
    try {
      await signIn(values)
      navigate(next, { replace: true })
    } catch (e) {
      setError(authErrorMessage(e))
      if (/not confirmed/i.test((e as Error).message)) setUnconfirmed(values.email)
    }
  })

  return (
    <AuthShell title="Ingresar" subtitle="Consulta tus pedidos y guarda tus direcciones.">
      <form onSubmit={onSubmit} noValidate className="grid gap-4">
        {params.get('verificado') && <FormAlert tone="success">¡Correo confirmado! Ya puedes ingresar.</FormAlert>}
        {error && (
          <FormAlert>
            {error}
            {unconfirmed && !resent && (
              <button
                type="button"
                className="ml-1 font-semibold underline underline-offset-2"
                onClick={async () => {
                  try { await resendConfirmation(unconfirmed); setResent(true) } catch (e) { setError(authErrorMessage(e)) }
                }}
              >
                Reenviar correo
              </button>
            )}
            {resent && <span className="ml-1 font-semibold">Correo reenviado.</span>}
          </FormAlert>
        )}
        <Field label="Correo" type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
        <Field label="Contraseña" type="password" autoComplete="current-password" error={errors.password?.message} {...register('password')} />
        <Link to="/recuperar" className="-mt-1 justify-self-end text-sm text-alas hover:underline">¿Olvidaste tu contraseña?</Link>
        <Button type="submit" size="lg" disabled={isSubmitting}>{isSubmitting ? 'Ingresando…' : 'Ingresar'}</Button>
        <p className="text-center text-sm text-piedra">
          ¿No tienes cuenta? <Link to="/registro" className="font-semibold text-alas hover:underline">Regístrate</Link>
        </p>
      </form>
    </AuthShell>
  )
}
