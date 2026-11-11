// Fotos y logo del sitio actual de Alitas Nelcy (propiedad del restaurante, alojados en su Cloudflare R2).
// shortcut: se enlazan en caliente y son originales de hasta 4.898 px (pesados); al recibir las fotos
// definitivas se optimizan (WebP/AVIF ~1600 px) y se sirven desde Supabase Storage o /public.
const R2 = 'https://pub-6407fcd2e58f4b0297c06b36f3016fa7.r2.dev/img'

export const media = {
  logo: 'https://alitasnelcy.com/logo/alitas-nelcy-logo-white.webp',
  local: `${R2}/hero-slide/foto1.jpg`,
  local2: `${R2}/hero-slide/foto2.jpg`,
  combo2: `${R2}/combos/combo2.jpg`,
  combo4: `${R2}/combos/combo4.jpg`,
  combo5: `${R2}/combos/combo5.jpg`,
  salsas: `${R2}/diferenciador/salsas.jpg`,
}

// Las 5 salsas de la casa (confirmadas en la web y en el menú anterior). Colores solo decorativos.
export const SAUCES = [
  { name: 'BBQ', color: 'var(--color-bbq)', ink: 'var(--color-hueso)' },
  { name: 'BBQ Picante', color: 'var(--color-picante)', ink: 'var(--color-hueso)' },
  { name: 'BBQ Maracuyá', color: 'var(--color-maracuya)', ink: 'var(--color-carbon)' },
  { name: 'BBQ Tamarindo', color: 'var(--color-tamarindo)', ink: 'var(--color-hueso)' },
  { name: 'Miel Mostaza', color: 'var(--color-mostaza)', ink: 'var(--color-carbon)' },
] as const

export const SAUCE_NAMES = SAUCES.map((s) => s.name)
