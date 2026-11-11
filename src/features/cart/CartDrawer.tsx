import * as Dialog from '@radix-ui/react-dialog'
import { Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react'
import { formatCOP } from '@/lib/format'
import { ButtonLink } from '@/components/ui/button'
import { useCart } from './CartContext'

export function CartButton({ className }: { className?: string }) {
  const { count, setOpen } = useCart()
  return (
    <button onClick={() => setOpen(true)} className={className} aria-label={`Carrito, ${count} productos`}>
      <ShoppingBag className="size-5" />
      {count > 0 && (
        <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-alas px-1 text-[0.7rem] font-bold text-hueso">{count}</span>
      )}
    </button>
  )
}

export function CartDrawer() {
  const { lines, open, setOpen, setQty, remove, subtotal } = useCart()
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-carbon/60" />
        <Dialog.Content className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-hueso shadow-2xl">
          <div className="flex items-center justify-between border-b border-carbon/10 px-5 py-4">
            <Dialog.Title className="font-display text-3xl font-black uppercase">Tu pedido</Dialog.Title>
            <Dialog.Close className="grid size-10 place-items-center rounded-lg hover:bg-carbon/5" aria-label="Cerrar"><X className="size-5" /></Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">Productos agregados al carrito</Dialog.Description>
          {lines.length === 0 ? (
            <div className="grid flex-1 place-items-center p-8 text-center">
              <div>
                <ShoppingBag className="mx-auto size-10 text-piedra" />
                <p className="mt-3 font-semibold">Tu carrito está vacío</p>
                <p className="mt-1 text-sm text-piedra">Agrega algo del menú.</p>
                <ButtonLink to="/menu" variant="dark" className="mt-6" onClick={() => setOpen(false)}>Ver el menú</ButtonLink>
              </div>
            </div>
          ) : (
            <>
              <ul className="flex-1 divide-y divide-carbon/10 overflow-y-auto px-5">
                {lines.map((l) => (
                  <li key={l.key} className="py-4">
                    <div className="flex justify-between gap-3">
                      <div>
                        <p className="font-semibold">{l.name}{l.variant_name ? ` · ${l.variant_name}` : ''}</p>
                        {l.options.length > 0 && <p className="text-sm text-piedra">{l.options.map((o) => o.name).join(', ')}</p>}
                        {l.notes && <p className="text-sm text-piedra">“{l.notes}”</p>}
                      </div>
                      <p className="price shrink-0 font-semibold">{formatCOP(l.unit_price * l.quantity)}</p>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex items-center rounded-lg border border-carbon/15">
                        <button className="grid size-9 place-items-center" onClick={() => setQty(l.key, l.quantity - 1)} aria-label="Menos"><Minus className="size-3.5" /></button>
                        <span className="price w-7 text-center text-sm font-semibold">{l.quantity}</span>
                        <button className="grid size-9 place-items-center" onClick={() => setQty(l.key, l.quantity + 1)} aria-label="Más"><Plus className="size-3.5" /></button>
                      </div>
                      <button onClick={() => remove(l.key)} className="inline-flex items-center gap-1 text-sm text-piedra hover:text-alas"><Trash2 className="size-4" /> Quitar</button>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="border-t border-carbon/10 p-5">
                <div className="flex justify-between text-lg font-semibold"><span>Subtotal</span><span className="price">{formatCOP(subtotal)}</span></div>
                <p className="mt-1 text-xs text-piedra">El domicilio y las promociones se calculan en el siguiente paso.</p>
                <ButtonLink to="/checkout" size="lg" className="mt-4 w-full" onClick={() => setOpen(false)}>Continuar</ButtonLink>
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
