import { useQuery } from '@tanstack/react-query'
import { fetchHours, fetchIsOpen, fetchSettings } from '../services/restaurant'

export const useSettings = () => useQuery({ queryKey: ['settings'], queryFn: fetchSettings, staleTime: 5 * 60_000 })
export const useHours = () => useQuery({ queryKey: ['hours'], queryFn: fetchHours, staleTime: 5 * 60_000 })
export const useIsOpen = () => useQuery({ queryKey: ['is-open'], queryFn: fetchIsOpen, refetchInterval: 60_000 })
