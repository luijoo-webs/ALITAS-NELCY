import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Field, FormAlert } from '@/components/ui/field'
import { useAuth } from '@/contexts/AuthContext'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { resetSchema, type ResetInput } from '../schemas'
import { authErrorMessage, updatePassword } from '../services/auth'
import { AuthShell } from '../components/AuthShell'

/** Destino del enlace de recuperación: Supabase abre una sesión temporal desde la URL. */
export function ResetPasswordPage() {
  useDocumentTitle('Nueva contraseña')
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ResetInput>({ resolver: zodResolver(resetSchema) })

  const onSubmit = handleSubmit(async ({ password }) => {
    setError(null)
    try {
      await updatePassword(password)
      navigate('/cuenta', { replace: true })
    } catch (e) {
      setError(authErrorMessage(e))
    }
  })

  return (
    <AuthShell title="Nueva contraseña">
      {loading ? null : !user ? (
        <FormAlert>
          El enlace no es válido o ya expiró. <Link to="/recuperar" className="font-semibold underline">Solicita uno nuevo</Link>.
        </FormAlert>
      ) : (
        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          {error && <FormAlert>{error}</FormAlert>}
          <Field label="Nueva contraseña" type="password" autoComplete="new-password" hint="Mínimo 8 caracteres" error={errors.password?.message} {...register('password')} />
          <Field label="Confirmar contraseña" type="password" autoComplete="new-password" error={errors.confirm?.message} {...register('confirm')} />
          <Button type="submit" size="lg" disabled={isSubmitting}>{isSubmitting ? 'Guardando…' : 'Guardar contraseña'}</Button>
        </form>
      )}
    </AuthShell>
  )
}
