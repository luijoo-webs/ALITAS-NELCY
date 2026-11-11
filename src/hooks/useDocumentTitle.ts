import { useEffect } from 'react'

export function useDocumentTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} · Alitas Nelcy` : 'Alitas Nelcy · Alitas y almuerzos en Valledupar'
  }, [title])
}
