import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../../context/ThemeContext.jsx'

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const nextTheme = theme === 'dark' ? 'light' : 'dark'

  return (
    <button className="icon-button theme-toggle" type="button" onClick={toggleTheme} aria-label={'Switch to ' + nextTheme + ' theme'} title={'Switch to ' + nextTheme + ' theme'}>
      {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  )
}
