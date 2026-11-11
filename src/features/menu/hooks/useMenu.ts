import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { fetchActivePromotions, fetchMenu } from '../services/catalog'

export const menuKeys = { all: ['menu'] as const, promos: ['promotions'] as const }

export function useMenu() {
  useMenuRealtime()
  return useQuery({ queryKey: menuKeys.all, queryFn: fetchMenu })
}

export function usePromotions() {
  return useQuery({ queryKey: menuKeys.promos, queryFn: fetchActivePromotions })
}

/** Cualquier cambio del catálogo en el panel refresca el menú abierto en el navegador. */
function useMenuRealtime() {
  const qc = useQueryClient()
  useEffect(() => {
    if (!supabase) return
    const client = supabase
    const refresh = () => {
      qc.invalidateQueries({ queryKey: menuKeys.all })
      qc.invalidateQueries({ queryKey: menuKeys.promos })
    }
    const channel = client.channel('public-menu')
    for (const table of ['categories', 'products', 'product_variants', 'product_images', 'promotions']) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, refresh)
    }
    channel.subscribe()
    return () => {
      client.removeChannel(channel)
    }
  }, [qc])
}
