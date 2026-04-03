import { Sun, Moon, CircleHalf } from '@phosphor-icons/react'
import { useTheme } from '@/hooks/use-theme'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

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
        "gap-2 text-t2 hover:text-t1 hover:bg-s1 transition-all",
        className
      )}
      title={getLabel()}
    >
      {getIcon()}
      <span className="text-xs font-medium hidden sm:inline">{getLabel()}</span>
    </Button>
  )
}
