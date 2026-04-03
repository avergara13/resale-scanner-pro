import { useKV } from '@github/spark/hooks'
import { useCallback } from 'react'

export function useCollapsePreference(key: string, defaultOpen: boolean = false) {
  const [isOpen, setIsOpen] = useKV<boolean>(`collapse-${key}`, defaultOpen)
  
  const toggle = useCallback((value?: boolean) => {
    if (value !== undefined) {
      setIsOpen(value)
    } else {
      setIsOpen((current) => !current)
    }
  }, [setIsOpen])
  
  return [isOpen ?? defaultOpen, toggle] as const
}
