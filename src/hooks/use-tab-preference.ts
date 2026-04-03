import { useKV } from '@github/spark/hooks'

export function useTabPreference<T extends string>(key: string, defaultValue: T) {
  const [value, setValue] = useKV<T>(`tab-${key}`, defaultValue)
  
  return [value || defaultValue, setValue] as const
}
