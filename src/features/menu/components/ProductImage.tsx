import { publicImageUrl } from '@/lib/supabase'
import { cn } from '@/lib/cn'
import type { Product } from '@/types/domain'

/** Primera foto del producto, o un bloque de color con el nombre si aún no tiene foto. */
export function ProductImage({ product, className, sizes }: { product: Product; className?: string; sizes?: string }) {
  const img = product.product_images[0]
  if (!img) {
    return (
      <div className={cn('grid place-items-center bg-maiz p-6 text-center', className)}>
        <span className="font-display text-3xl font-black uppercase leading-none text-carbon/30">{product.name}</span>
      </div>
    )
  }
  return (
    <img
      src={publicImageUrl(img.storage_path)}
      alt={img.alt ?? product.name}
      loading="lazy"
      decoding="async"
      sizes={sizes}
      className={cn('object-cover', className)}
    />
  )
}
