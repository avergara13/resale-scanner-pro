import { Sun, Moon, CircleHalf } from '@phosphor-icons/react'
import { useTheme } from '@/hooks/use-theme'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, themeMode, toggleTheme } = useTheme()

  const getIcon = () => {
    if (themeMode === 'auto') {
      return <CircleHalf weight="fill" />
    }
    if (theme === 'dark') {
      return <Moon weight="fill" />
    }
    return <Sun weight="fill" />
  }

  const getLabel = () => {
    if (themeMode === 'auto') {
      return `Auto (${theme === 'dark' ? 'Dark' : 'Light'})`
    }
    return theme === 'dark' ? 'Dark' : 'Light'
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleTheme}
      className={cn(
        "gap-2 text-t2 hover:text-t1 hover:bg-s1 transition-all duration-300 relative overflow-hidden touch-target",
        className
      )}
      title={getLabel()}
      style={{
        minWidth: '48px',
        minHeight: '48px',
        touchAction: 'manipulation',
        WebkitTapHighlightColor: 'transparent'
      }}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={themeMode}
          initial={{ scale: 0.5, rotate: -180, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          exit={{ scale: 0.5, rotate: 180, opacity: 0 }}
          transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        >
          {getIcon()}
        </motion.div>
      </AnimatePresence>
      <span className="text-xs font-medium hidden sm:inline">{getLabel()}</span>
    </Button>
  )
}
