import { Sun, Moon, CircleHalf } from '@phosphor-icons/react'
import { useTheme } from '@/hooks/use-theme'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, themeMode, toggleTheme } = useTheme()

  const getIcon = () => {
    if (themeMode === 'auto') {
      return <CircleHalf size={18} weight="fill" />
    }
    if (theme === 'dark') {
      return <Moon size={18} weight="fill" />
    }
    return <Sun size={18} weight="fill" />
  }

  const getLabel = () => {
    if (themeMode === 'auto') return `System (${theme === 'dark' ? 'Dark' : 'Light'})`
    return theme === 'dark' ? 'Dark' : 'Light'
  }

  return (
    <button
      onClick={toggleTheme}
      className={cn(
        "w-9 h-9 flex items-center justify-center rounded-lg text-t2 hover:text-t1 hover:bg-s1 transition-all duration-300",
        className
      )}
      title={getLabel()}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={themeMode}
          initial={{ scale: 0.5, rotate: -180, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          exit={{ scale: 0.5, rotate: 180, opacity: 0 }}
          transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          className="flex items-center justify-center"
        >
          {getIcon()}
        </motion.div>
      </AnimatePresence>
    </button>
  )
}
