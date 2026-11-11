import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

// El carrito vive en el navegador; los precios son solo vista previa (el servidor recalcula todo).
export interface CartLine {
  key: string
  product_id: string
  variant_id: string | null
  name: string
  variant_name: string | null
  options: { id: string; name: string; price_delta: number }[]
  unit_price: number
  quantity: number
  notes: string
}

interface CartState {
  lines: CartLine[]
  count: number
  subtotal: number
  open: boolean
  setOpen: (o: boolean) => void
  add: (l: Omit<CartLine, 'key'>) => void
  setQty: (key: string, qty: number) => void
  remove: (key: string) => void
  clear: () => void
}

const Ctx = createContext<CartState | null>(null)
const STORAGE = 'alitas-nelcy-cart-v1'

function load(): CartLine[] {
  try {
    const raw = localStorage.getItem(STORAGE)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((l) => l && typeof l.product_id === 'string' && l.quantity > 0) : []
  } catch {
    return []
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>(load)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    try { localStorage.setItem(STORAGE, JSON.stringify(lines)) } catch { /* modo privado */ }
  }, [lines])

  const value = useMemo<CartState>(() => ({
    lines,
    count: lines.reduce((n, l) => n + l.quantity, 0),
    subtotal: lines.reduce((n, l) => n + l.unit_price * l.quantity, 0),
    open,
    setOpen,
    add: (l) => {
      // Mismo producto, presentación, opciones y nota = misma línea
      const key = [l.product_id, l.variant_id ?? '', ...l.options.map((o) => o.id).sort(), l.notes.trim()].join('|')
      setLines((prev) => {
        const found = prev.find((x) => x.key === key)
        if (found) return prev.map((x) => (x.key === key ? { ...x, quantity: Math.min(99, x.quantity + l.quantity) } : x))
        return [...prev, { ...l, key }]
      })
    },
    setQty: (key, qty) => setLines((prev) => prev.map((x) => (x.key === key ? { ...x, quantity: Math.max(1, Math.min(99, qty)) } : x))),
    remove: (key) => setLines((prev) => prev.filter((x) => x.key !== key)),
    clear: () => setLines([]),
  }), [lines, open])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useCart() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useCart debe usarse dentro de <CartProvider>')
  return c
}
