import * as Dialog from '@radix-ui/react-dialog'
import { MessageCircle, X } from 'lucide-react'
import type { Product } from '@/types/domain'
import { formatCOP, whatsappLink } from '@/lib/format'
import { useSettings } from '@/features/site/hooks/useRestaurant'
import { buttonClass } from '@/components/ui/button'
import { displayPrice } from '../services/catalog'
import { ProductImage } from './ProductImage'
import { ProductBadges } from './ProductCard'

function selectionHint(min: number, max: number) {
  if (min === 0) return max === 1 ? 'Opcional · elige 1' : `Opcional · hasta ${max}`
  if (min === max) return `Obligatorio · elige ${min}`
  return `Elige entre ${min} y ${max}`
}

export function ProductDialog({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const { data: settings } = useSettings()

  return (
    <Dialog.Root open={Boolean(product)} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-carbon/70 backdrop-blur-[2px]" />
        {product && (
          <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 max-h-[92svh] overflow-y-auto rounded-t-xl bg-hueso sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-[min(560px,92vw)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[10px]">
            <div className="relative aspect-[16/10]">
              <ProductImage product={product} className="size-full" sizes="560px" />
              <Dialog.Close className="absolute right-3 top-3 grid size-10 place-items-center rounded-full bg-carbon/70 text-hueso hover:bg-carbon" aria-label="Cerrar">
                <X className="size-5" />
              </Dialog.Close>
            </div>

            <div className="space-y-6 p-5 sm:p-6">
              <div className="space-y-2">
                <ProductBadges product={product} />
                <div className="flex items-start justify-between gap-4">
                  <Dialog.Title className="h3">{product.name}</Dialog.Title>
                  <p className="price shrink-0 text-lg font-semibold text-alas">
                    {displayPrice(product).from && <span className="mr-1 text-xs font-normal">desde</span>}
                    {formatCOP(displayPrice(product).amount)}
                  </p>
                </div>
                <Dialog.Description className="text-[0.95rem] leading-relaxed text-piedra">
                  {product.description || 'Sin descripción.'}
                </Dialog.Description>
              </div>

              {product.product_variants.length > 0 && (
                <section>
                  <h4 className="text-sm font-semibold">Presentaciones</h4>
                  <ul className="mt-2 divide-y divide-carbon/8 rounded-[var(--radius-card)] border border-carbon/10">
                    {product.product_variants.map((v) => (
                      <li key={v.id} className="flex justify-between px-4 py-3 text-sm">
                        <span>{v.name}</span>
                        <span className="price font-medium">{formatCOP(v.price)}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {product.product_modifier_groups.map(({ modifier_groups: g }) =>
                g && g.modifier_options.length > 0 ? (
                  <section key={g.id}>
                    <div className="flex items-baseline justify-between gap-3">
                      <h4 className="text-sm font-semibold">{g.name}</h4>
                      <span className="text-xs text-piedra">{selectionHint(g.min_select, g.max_select)}</span>
                    </div>
                    <ul className="mt-2 flex flex-wrap gap-2">
                      {g.modifier_options.map((o) => (
                        <li key={o.id} className="rounded-md border border-carbon/12 px-3 py-1.5 text-sm">
                          {o.name}
                          {o.price_delta > 0 && <span className="price ml-1.5 text-piedra">+{formatCOP(o.price_delta)}</span>}
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null,
              )}

              {product.allergens.length > 0 && (
                <p className="text-xs text-piedra">
                  <span className="font-semibold text-carbon">Contiene:</span> {product.allergens.join(', ')}
                </p>
              )}

              {/* shortcut: hasta la Fase 5 (carrito y checkout propios) el pedido se hace por WhatsApp. */}
              {settings?.whatsapp && product.is_available && (
                <a
                  href={whatsappLink(settings.whatsapp, `Hola, quiero pedir: ${product.name}`)}
                  target="_blank"
                  rel="noreferrer"
                  className={buttonClass({ size: 'lg' }, 'w-full')}
                >
                  <MessageCircle /> Pedir por WhatsApp
                </a>
              )}
              {!product.is_available && <p className="rounded-md bg-carbon/5 px-4 py-3 text-center text-sm font-medium">Este producto no está disponible por ahora.</p>}
            </div>
          </Dialog.Content>
        )}
      </Dialog.Portal>
    </Dialog.Root>
  )
}
