import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Field, FormAlert } from '@/components/ui/field'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { forgotSchema, type ForgotInput } from '../schemas'
import { authErrorMessage, requestPasswordReset } from '../services/auth'
import { AuthShell } from '../components/AuthShell'

export function ForgotPasswordPage() {
  useDocumentTitle('Recuperar contraseña')
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ForgotInput>({ resolver: zodResolver(forgotSchema) })

  const onSubmit = handleSubmit(async (values) => {
    setError(null)
    try {
      await requestPasswordReset(values)
      setDone(true)
    } catch (e) {
      setError(authErrorMessage(e))
    }
  })

  return (
    <AuthShell title="Recuperar contraseña" subtitle="Te enviaremos un enlace para crear una nueva.">
      {done ? (
        <FormAlert tone="success">Si existe una cuenta con ese correo, recibirás el enlace en unos minutos.</FormAlert>
      ) : (
        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          {error && <FormAlert>{error}</FormAlert>}
          <Field label="Correo" type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
          <Button type="submit" size="lg" disabled={isSubmitting}>{isSubmitting ? 'Enviando…' : 'Enviar enlace'}</Button>
        </form>
      )}
      <p className="mt-6 text-center text-sm">
        <Link to="/ingresar" className="font-semibold text-alas hover:underline">Volver a ingresar</Link>
      </p>
    </AuthShell>
  )
}
