-- 0006 · Realtime: el menú público se actualiza solo cuando el panel cambia algo.
-- Realtime respeta RLS: cada cliente solo recibe cambios de filas que puede leer.
alter publication supabase_realtime add table
  public.categories,
  public.products,
  public.product_variants,
  public.product_images,
  public.promotions,
  public.restaurant_settings;
