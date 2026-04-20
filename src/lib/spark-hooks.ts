import { useEffect, useMemo, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'

function resolveValue<T>(value: T | ((previous: T) => T), previous: T): T {
  return typeof value === 'function' ? (value as (previous: T) => T)(previous) : value
}

function readStoredValue<T>(storageKey: string, initialValue: T): T {
  if (typeof window === 'undefined') {
    return initialValue
  }

  const rawValue = window.localStorage.getItem(storageKey)
  if (!rawValue) {
    return initialValue
  }

  try {
    return JSON.parse(rawValue) as T
  } catch {
    window.localStorage.removeItem(storageKey)
    return initialValue
  }
}

export function useKV<T>(key: string, initialValue: T): [T, Dispatch<SetStateAction<T>>] {
  const storageKey = useMemo(() => `resale-scanner:${key}`, [key])
  const initialValueRef = useRef(initialValue)
  const [value, setValue] = useState<T>(() => readStoredValue(storageKey, initialValue))

  useEffect(() => {
    initialValueRef.current = initialValue
  }, [initialValue])

  useEffect(() => {
    const stored = readStoredValue(storageKey, initialValueRef.current)
    setValue(prev => {
      // Avoid unnecessary re-renders when the stored value is structurally equal
      if (JSON.stringify(prev) === JSON.stringify(stored)) return prev
      return stored
    })
  }, [storageKey])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    if (typeof value === 'undefined') {
      window.localStorage.removeItem(storageKey)
      return
    }

    try {
      window.localStorage.setItem(storageKey, JSON.stringify(value))
    } catch (e) {
      if (e instanceof DOMException && (e.name === 'QuotaExceededError' || e.code === 22)) {
        // Clear heavy caches first, then retry
        const cacheKeys = Object.keys(window.localStorage).filter(k =>
          k.startsWith('resale-scanner:image-optimization-cache') ||
          k.startsWith('resale-scanner:compression-analytics')
        )
        cacheKeys.forEach(k => window.localStorage.removeItem(k))
        try {
          window.localStorage.setItem(storageKey, JSON.stringify(value))
        } catch {
          console.error(`[useKV] Storage quota exceeded for key "${storageKey}" even after cleanup`)
        }
      }
    }
  }, [storageKey, value])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== storageKey) {
        return
      }

      if (event.newValue === null) {
        setValue(initialValueRef.current)
        return
      }

      try {
        setValue(JSON.parse(event.newValue) as T)
      } catch {
        setValue(initialValueRef.current)
      }
    }

    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [storageKey])

  const setStoredValue: Dispatch<SetStateAction<T>> = (nextValue) => {
    setValue((previous) => resolveValue(nextValue, previous))
  }

  return [value, setStoredValue]
}
