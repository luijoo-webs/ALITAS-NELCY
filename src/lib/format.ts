const cop = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })

export const formatCOP = (value: number | string) => cop.format(Number(value))

const WEEKDAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
export const weekdayName = (d: number) => WEEKDAYS[d]

/** '13:30:00' → '1:30 p. m.' */
export function formatTime(t: string) {
  const [h, m] = t.split(':').map(Number)
  const suffix = h >= 12 ? 'p. m.' : 'a. m.'
  const h12 = h % 12 || 12
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`
}

export function whatsappLink(phoneDigits: string, text?: string) {
  const q = text ? `?text=${encodeURIComponent(text)}` : ''
  return `https://wa.me/${phoneDigits}${q}`
}
