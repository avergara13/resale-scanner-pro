import { useEffect, useState, useCallback } from 'react'
import { useKV } from '@github/spark/hooks'

export type ThemeMode = 'light' | 'dark' | 'auto'
export type Theme = 'light' | 'dark'

function getTimeBasedTheme(): Theme {
  const hour = new Date().getHours()
  return (hour >= 6 && hour < 18) ? 'light' : 'dark'
}

function getSystemTheme(): Theme {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return 'light'
}

export function useTheme() {
  const [themeMode, setThemeMode] = useKV<ThemeMode>('theme-mode', 'auto')
  const [useAmbientLight, setUseAmbientLight] = useKV<boolean>('use-ambient-light', false)
  const [actualTheme, setActualTheme] = useState<Theme>('light')

  const updateThemeFromAmbient = useCallback(async () => {
    if (!useAmbientLight || themeMode !== 'auto') return

    try {
      if ('AmbientLightSensor' in window) {
        const sensor = new (window as any).AmbientLightSensor()
        sensor.addEventListener('reading', () => {
          const lux = sensor.illuminance
          const newTheme = lux < 50 ? 'dark' : 'light'
          setActualTheme(newTheme)
        })
        await sensor.start()
        return () => sensor.stop()
      }
    } catch (error) {
      console.log('Ambient light sensor not available')
    }
  }, [useAmbientLight, themeMode])

  useEffect(() => {
    if (themeMode === 'auto') {
      if (useAmbientLight) {
        updateThemeFromAmbient()
      } else {
        setActualTheme(getTimeBasedTheme())
        
        const interval = setInterval(() => {
          setActualTheme(getTimeBasedTheme())
        }, 60000)
        
        return () => clearInterval(interval)
      }
    } else if (themeMode) {
      setActualTheme(themeMode)
    }
  }, [themeMode, useAmbientLight, updateThemeFromAmbient])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    
    const handleChange = () => {
      if (themeMode === 'auto' && !useAmbientLight) {
        const systemTheme = getSystemTheme()
        if (systemTheme) {
          setActualTheme(systemTheme)
        }
      }
    }
    
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [themeMode, useAmbientLight])

  useEffect(() => {
    const root = document.documentElement
    
    if (actualTheme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }, [actualTheme])

  const setTheme = useCallback((mode: ThemeMode) => {
    setThemeMode(mode)
  }, [setThemeMode])

  const toggleTheme = useCallback(() => {
    setThemeMode((current) => {
      if (current === 'light') return 'dark'
      if (current === 'dark') return 'auto'
      return 'light'
    })
  }, [setThemeMode])

  const toggleAmbientLight = useCallback(() => {
    setUseAmbientLight((current) => !current)
  }, [setUseAmbientLight])

  return { 
    theme: actualTheme, 
    themeMode, 
    useAmbientLight,
    setTheme, 
    toggleTheme,
    toggleAmbientLight
  }
}
