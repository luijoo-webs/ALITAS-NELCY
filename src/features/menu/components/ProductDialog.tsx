import { useEffect, useMemo, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Check, Minus, Plus, X } from 'lucide-react'
import type { Product } from '@/types/domain'
import { formatCOP } from '@/lib/format'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/button'
import { useCart, type CartLine } from '@/features/cart/CartContext'
import { ProductImage } from './ProductImage'
import { ProductBadges } from './ProductCard'

function selectionHint(min: number, max: number) {
  if (min === 0) return max === 1 ? 'Opcional · elige 1' : `Opcional · hasta ${max}`
  if (min === max) return `Obligatorio · elige ${min}`
  return `Elige entre ${min} y ${max}`
}

type OnAdd = (line: Omit<CartLine, 'key'>) => void

/** onAdd: la venta manual del panel usa su propio carrito en vez del del sitio. */
export function ProductDialog({ product, onClose, onAdd }: { product: Product | null; onClose: () => void; onAdd?: OnAdd }) {
  return (
    <Dialog.Root open={Boolean(product)} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-carbon/70 backdrop-blur-[2px]" />
        {product && <Content product={product} onClose={onClose} onAdd={onAdd} />}
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function Content({ product, onClose, onAdd }: { product: Product; onClose: () => void; onAdd?: OnAdd }) {
  const cart = useCart()
  const variants = product.product_variants
  const groups = product.product_modifier_groups.map((g) => g.modifier_groups!).filter((g) => g.modifier_options.length > 0)
  const [variantId, setVariantId] = useState<string | null>(variants.find((v) => v.is_default)?.id ?? variants[0]?.id ?? null)
  const [picked, setPicked] = useState<Record<string, string[]>>({})
  const [qty, setQty] = useState(1)
  const [notes, setNotes] = useState('')
  const [tried, setTried] = useState(false)

  useEffect(() => { setPicked({}); setQty(1); setNotes(''); setTried(false) }, [product.id])

  const variant = variants.find((v) => v.id === variantId) ?? null
  const options = groups.flatMap((g) => g.modifier_options.filter((o) => picked[g.id]?.includes(o.id)))
  const unit = (variant?.price ?? product.base_price) + options.reduce((s, o) => s + o.price_delta, 0)
  const invalid = useMemo(() => groups.filter((g) => {
    const n = picked[g.id]?.length ?? 0
    return n < g.min_select || n > g.max_select
  }), [groups, picked])

  const toggle = (gid: string, oid: string, max: number) =>
    setPicked((p) => {
      const cur = p[gid] ?? []
      if (cur.includes(oid)) return { ...p, [gid]: cur.filter((x) => x !== oid) }
      if (max === 1) return { ...p, [gid]: [oid] }
      return cur.length >= max ? p : { ...p, [gid]: [...cur, oid] }
    })

  const add = () => {
    setTried(true)
    if (invalid.length) return
    const line = {
      product_id: product.id, variant_id: variant?.id ?? null, name: product.name, variant_name: variants.length > 1 ? variant?.name ?? null : null,
      options: options.map((o) => ({ id: o.id, name: o.name, price_delta: o.price_delta })), unit_price: unit, quantity: qty, notes: notes.trim(),
    }
    onClose()
    if (onAdd) return onAdd(line)
    cart.add(line)
    cart.setOpen(true)
  }

  return (
    <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 flex max-h-[94svh] flex-col overflow-hidden rounded-t-2xl bg-hueso sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-[min(560px,92vw)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl">
      <div className="overflow-y-auto">
        <div className="relative aspect-[16/10]">
          <ProductImage product={product} className="size-full" sizes="560px" />
          <Dialog.Close className="absolute right-3 top-3 grid size-10 place-items-center rounded-full bg-carbon/70 text-hueso hover:bg-carbon" aria-label="Cerrar">
            <X className="size-5" />
          </Dialog.Close>
        </div>

        <div className="space-y-6 p-5 sm:p-6">
          <div className="space-y-2">
            <ProductBadges product={product} />
            <Dialog.Title className="h3">{product.name}</Dialog.Title>
            <Dialog.Description className="text-[0.95rem] leading-relaxed text-piedra">{product.description || 'Sin descripción.'}</Dialog.Description>
          </div>

          {variants.length > 1 && (
            <fieldset>
              <legend className="text-sm font-semibold">Presentación</legend>
              <div className="mt-2 grid gap-2">
                {variants.map((v) => (
                  <label key={v.id} className={cn('flex cursor-pointer items-center justify-between rounded-lg border-2 px-4 py-3 text-sm', v.id === variantId ? 'border-carbon bg-white' : 'border-carbon/10')}>
                    <span className="flex items-center gap-2">
                      <input type="radio" name="variant" className="accent-[var(--color-alas)]" checked={v.id === variantId} onChange={() => setVariantId(v.id)} />
                      {v.name}
                    </span>
                    <span className="price font-medium">{formatCOP(v.price)}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          {groups.map((g) => {
            const bad = tried && invalid.includes(g)
            return (
              <fieldset key={g.id}>
                <div className="flex items-baseline justify-between gap-3">
                  <legend className="text-sm font-semibold">{g.name}</legend>
                  <span className={cn('text-xs', bad ? 'font-semibold text-alas' : 'text-piedra')}>{selectionHint(g.min_select, g.max_select)}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {g.modifier_options.map((o) => {
                    const on = picked[g.id]?.includes(o.id)
                    return (
                      <button key={o.id} type="button" aria-pressed={on} onClick={() => toggle(g.id, o.id, g.max_select)}
                        className={cn('inline-flex items-center gap-1.5 rounded-full border-2 px-3.5 py-1.5 text-sm transition-colors', on ? 'border-carbon bg-carbon text-hueso' : 'border-carbon/15 hover:border-carbon/40')}>
                        {on && <Check className="size-3.5" />}{o.name}
                        {o.price_delta > 0 && <span className="price opacity-75">+{formatCOP(o.price_delta)}</span>}
                      </button>
                    )
                  })}
                </div>
              </fieldset>
            )
          })}

          <label className="block">
            <span className="text-sm font-semibold">Instrucciones (opcional)</span>
            <input value={notes} onChange={(e) => setNotes(e.target.value.slice(0, 200))} placeholder="Ej. sin cebolla"
              className="mt-2 h-11 w-full rounded-lg border-2 border-carbon/15 bg-white px-3 text-sm outline-none focus:border-carbon" />
          </label>

          {product.allergens.length > 0 && (
            <p className="text-xs text-piedra"><span className="font-semibold text-carbon">Contiene:</span> {product.allergens.join(', ')}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 border-t border-carbon/10 bg-hueso p-4">
        {product.is_available ? (
          <>
            <div className="flex items-center rounded-lg border-2 border-carbon/15">
              <button type="button" className="grid size-11 place-items-center" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Menos"><Minus className="size-4" /></button>
              <span className="price w-8 text-center font-semibold" aria-live="polite">{qty}</span>
              <button type="button" className="grid size-11 place-items-center" onClick={() => setQty((q) => Math.min(99, q + 1))} aria-label="Más"><Plus className="size-4" /></button>
            </div>
            <Button className="flex-1" onClick={add}>Agregar · {formatCOP(unit * qty)}</Button>
          </>
        ) : (
          <p className="w-full rounded-md bg-carbon/5 px-4 py-3 text-center text-sm font-medium">Este producto no está disponible por ahora.</p>
        )}
      </div>
    </Dialog.Content>
  )
}
