import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { LayoutDashboard, LogOut } from 'lucide-react'
import { Button, ButtonLink } from '@/components/ui/button'
import { usePermissions } from '@/features/admin/hooks/usePermissions'
import { Field, FormAlert } from '@/components/ui/field'
import { ErrorState, Skeleton } from '@/components/shared/states'
import { useAuth } from '@/contexts/AuthContext'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { profileSchema, type ProfileInput } from '@/features/auth/schemas'
import { authErrorMessage, fetchMyCustomer, updateMyCustomer } from '@/features/auth/services/auth'

export function AccountPage() {
  useDocumentTitle('Mi cuenta')
  const { user, signOut } = useAuth()
  const { isStaff } = usePermissions()
  const qc = useQueryClient()
  const { data: customer, isPending, error } = useQuery({ queryKey: ['my-customer', user?.id], queryFn: fetchMyCustomer })
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const { register, handleSubmit, reset, formState: { errors, isSubmitting, isDirty } } = useForm<ProfileInput>({ resolver: zodResolver(profileSchema) })

  useEffect(() => {
    if (customer) reset({ full_name: customer.full_name, phone: customer.phone ?? '' })
  }, [customer, reset])

  const onSubmit = handleSubmit(async (values) => {
    if (!customer) return
    setSaved(false)
    setSaveError(null)
    try {
      await updateMyCustomer(customer.id, values)
      await qc.invalidateQueries({ queryKey: ['my-customer'] })
      setSaved(true)
    } catch (e) {
      setSaveError(authErrorMessage(e))
    }
  })

  return (
    <section className="bg-hueso pb-20 pt-28 md:pt-36">
      <div className="container-page max-w-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="kicker text-alas">Mi cuenta</p>
            <h1 className="h2 mt-2">Hola{customer ? `, ${customer.full_name.split(' ')[0]}` : ''}</h1>
            <p className="mt-1 text-sm text-piedra">{user?.email}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => signOut()}>
            <LogOut /> Salir
          </Button>
        </div>

        {isStaff && (
          <ButtonLink to="/admin" variant="dark" className="mt-8">
            <LayoutDashboard /> Ir al panel del restaurante
          </ButtonLink>
        )}

        <div className="mt-10 rounded-[var(--radius-card)] border border-carbon/10 bg-white p-5 sm:p-6">
          <h2 className="font-sans text-base font-semibold">Datos de contacto</h2>
          {isPending && <Skeleton className="mt-4 h-40" />}
          {error && <ErrorState error={error} className="mt-4" />}
          {!isPending && !error && !customer && (
            <p className="mt-4 text-sm text-piedra">Tu perfil se está preparando. Recarga la página en unos segundos.</p>
          )}
          {customer && (
            <form onSubmit={onSubmit} noValidate className="mt-4 grid gap-4">
              {saved && <FormAlert tone="success">Datos guardados.</FormAlert>}
              {saveError && <FormAlert>{saveError}</FormAlert>}
              <Field label="Nombre completo" autoComplete="name" error={errors.full_name?.message} {...register('full_name')} />
              <Field label="Celular" type="tel" autoComplete="tel" error={errors.phone?.message} {...register('phone')} />
              <Button type="submit" disabled={isSubmitting || !isDirty} className="justify-self-start">
                {isSubmitting ? 'Guardando…' : 'Guardar cambios'}
              </Button>
            </form>
          )}
        </div>
      </div>
    </section>
  )
}
