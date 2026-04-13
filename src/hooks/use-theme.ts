import { useEffect, useState, useCallback } from 'react'
import { useKV } from '@github/spark/hooks'

export type ThemeMode = 'light' | 'dark' | 'auto'
export type Theme = 'light' | 'dark'

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

  useEffect(() => {
    if (themeMode === 'auto') {
      if (useAmbientLight) {
        let sensorCleanup: (() => void) | undefined

        const startSensor = async () => {
          try {
            if ('AmbientLightSensor' in window) {
              const sensor = new (window as any).AmbientLightSensor()
              sensor.addEventListener('reading', () => {
                const lux = sensor.illuminance
                const newTheme = lux < 50 ? 'dark' : 'light'
                setActualTheme(newTheme)
              })
              await sensor.start()
              sensorCleanup = () => sensor.stop()
            }
          } catch (error) {
            console.log('Ambient light sensor not available')
          }
        }

        startSensor()

        return () => {
          if (sensorCleanup) {
            sensorCleanup()
          }
        }
      } else {
        // Follow system preference in auto mode
        setActualTheme(getSystemTheme())

        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
        const handleChange = () => setActualTheme(getSystemTheme())
        mediaQuery.addEventListener('change', handleChange)
        return () => mediaQuery.removeEventListener('change', handleChange)
      }
    } else if (themeMode) {
      setActualTheme(themeMode)
    }
  }, [themeMode, useAmbientLight])

  useEffect(() => {
    const root = document.documentElement
    
    root.style.setProperty('color-scheme', actualTheme)
    
    requestAnimationFrame(() => {
      if (actualTheme === 'dark') {
        root.classList.add('dark')
      } else {
        root.classList.remove('dark')
      }
    })
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
