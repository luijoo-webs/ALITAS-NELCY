import { Plus } from 'lucide-react'
import type { Product } from '@/types/domain'
import { formatCOP } from '@/lib/format'
import { cn } from '@/lib/cn'
import { displayPrice } from '../services/catalog'
import { ProductImage } from './ProductImage'

const badge = 'rounded-md border-2 border-carbon px-2 py-0.5 font-display text-sm font-black uppercase tracking-wide'

export function ProductBadges({ product }: { product: Product }) {
  const promo = product.promotion_products[0]?.promotions
  return (
    <div className="flex flex-wrap gap-1.5">
      {!product.is_available && <span className={cn(badge, 'bg-carbon text-hueso')}>Agotado</span>}
      {promo && (
        <span className={cn(badge, 'bg-alas text-hueso')}>
          {promo.label || (promo.type === 'percent' ? `-${promo.value}%` : promo.type === 'fixed' ? `-${formatCOP(promo.value)}` : promo.name)}
        </span>
      )}
      {product.is_featured && product.is_available && <span className={cn(badge, 'bg-maiz text-carbon')}>Destacado</span>}
    </div>
  )
}

export function ProductCard({ product, onOpen }: { product: Product; onOpen: (p: Product) => void }) {
  const price = displayPrice(product)
  return (
    <button
      type="button"
      onClick={() => onOpen(product)}
      className={cn(
        'sticker group flex w-full flex-col overflow-hidden bg-hueso text-left transition-[transform,box-shadow] duration-200 hover:-translate-x-0.5 hover:-translate-y-1 hover:shadow-[var(--shadow-hard-lg)]',
        !product.is_available && 'opacity-60',
      )}
    >
      <div className="relative aspect-[4/3] overflow-hidden border-b-2 border-carbon">
        <ProductImage product={product} className="size-full transition-transform duration-500 group-hover:scale-110" sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" />
        <div className="absolute left-3 top-3"><ProductBadges product={product} /></div>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-5">
        <h3 className="font-display text-2xl font-black uppercase leading-none">{product.name}</h3>
        {product.description && <p className="line-clamp-2 text-sm text-piedra">{product.description}</p>}
        <div className="mt-auto flex items-center justify-between pt-3">
          <p className="price font-display text-2xl font-black text-alas">
            {price.from && <span className="mr-1 font-sans text-xs font-medium text-piedra">desde</span>}
            {formatCOP(price.amount)}
          </p>
          <span className="grid size-10 place-items-center rounded-full border-2 border-carbon bg-maiz transition-transform duration-300 group-hover:rotate-90" aria-hidden>
            <Plus className="size-5" />
          </span>
        </div>
      </div>
    </button>
  )
}
