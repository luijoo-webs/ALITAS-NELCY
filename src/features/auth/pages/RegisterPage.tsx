import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { MailCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, FormAlert } from '@/components/ui/field'
import { useAuth } from '@/contexts/AuthContext'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { registerSchema, type RegisterInput } from '../schemas'
import { authErrorMessage, signUp } from '../services/auth'
import { AuthShell } from '../components/AuthShell'

export function RegisterPage() {
  useDocumentTitle('Crear cuenta')
  const { user } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) })

  if (user) return <Navigate to="/cuenta" replace />

  if (sentTo) {
    return (
      <AuthShell title="Revisa tu correo">
        <div className="grid gap-4">
          <MailCheck className="size-8 text-alas" />
          <p>
            Enviamos un enlace de confirmación a <strong>{sentTo}</strong>. Ábrelo para activar tu cuenta.
          </p>
          <p className="text-sm text-piedra">
            Si ya habías hecho pedidos con este correo, aparecerán en tu cuenta después de confirmarlo.
          </p>
        </div>
      </AuthShell>
    )
  }

  const onSubmit = handleSubmit(async (values) => {
    setError(null)
    try {
      await signUp(values)
      setSentTo(values.email)
    } catch (e) {
      setError(authErrorMessage(e))
    }
  })

  return (
    <AuthShell title="Crear cuenta" subtitle="Pide más rápido con tus datos y direcciones guardadas.">
      <form onSubmit={onSubmit} noValidate className="grid gap-4">
        {error && <FormAlert>{error}</FormAlert>}
        <Field label="Nombre completo" autoComplete="name" error={errors.full_name?.message} {...register('full_name')} />
        <Field label="Celular" type="tel" inputMode="tel" autoComplete="tel" placeholder="300 123 4567" error={errors.phone?.message} {...register('phone')} />
        <Field label="Correo" type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
        <Field label="Contraseña" type="password" autoComplete="new-password" hint="Mínimo 8 caracteres" error={errors.password?.message} {...register('password')} />
        <Field label="Confirmar contraseña" type="password" autoComplete="new-password" error={errors.confirm?.message} {...register('confirm')} />
        <Button type="submit" size="lg" disabled={isSubmitting}>{isSubmitting ? 'Creando cuenta…' : 'Crear cuenta'}</Button>
        <p className="text-center text-sm text-piedra">
          ¿Ya tienes cuenta? <Link to="/ingresar" className="font-semibold text-alas hover:underline">Ingresa</Link>
        </p>
      </form>
    </AuthShell>
  )
}
