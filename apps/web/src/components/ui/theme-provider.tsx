import * as React from "react"
import { cn } from "../../lib/utils"

type Theme = "dark" | "light" | "system"

interface ThemeProviderProps {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
  enableTransitions?: boolean
}

interface ThemeProviderState {
  theme: Theme
  setTheme: (theme: Theme) => void
  systemTheme: "dark" | "light"
  actualTheme: "dark" | "light"
}

const initialState: ThemeProviderState = {
  theme: "system",
  setTheme: () => null,
  systemTheme: "light",
  actualTheme: "light",
}

const ThemeProviderContext = React.createContext<ThemeProviderState>(initialState)

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "aether-editor-theme",
  enableTransitions = true,
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = React.useState<Theme>(() => {
    // Check if we're in a browser environment
    if (typeof window === 'undefined' || !window.localStorage) {
      return defaultTheme
    }
    return (localStorage.getItem(storageKey) as Theme) || defaultTheme
  })
  const [systemTheme, setSystemTheme] = React.useState<"dark" | "light">("light")

  // Detect system theme preference
  React.useEffect(() => {
    // Check if we're in a test environment or if matchMedia is available
    if (typeof window === 'undefined' || !window.matchMedia) {
      setSystemTheme("light") // Default to light theme in test environment
      return
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
    setSystemTheme(mediaQuery.matches ? "dark" : "light")

    const handleChange = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? "dark" : "light")
    }

    mediaQuery.addEventListener("change", handleChange)
    return () => mediaQuery.removeEventListener("change", handleChange)
  }, [])

  // Calculate actual theme
  const actualTheme = theme === "system" ? systemTheme : theme

  React.useEffect(() => {
    const root = window.document.documentElement

    root.classList.remove("light", "dark")

    if (theme === "system") {
      root.classList.add(systemTheme)
    } else {
      root.classList.add(theme)
    }

    // Add smooth transitions for theme changes
    if (enableTransitions) {
      root.style.setProperty("--theme-transition", "all 0.3s ease")
      const elements = document.querySelectorAll("*")
      elements.forEach((el) => {
        if (el instanceof HTMLElement) {
          el.style.transition = "background-color 0.3s ease, border-color 0.3s ease, color 0.3s ease"
        }
      })

      // Remove transitions after theme change is complete
      setTimeout(() => {
        elements.forEach((el) => {
          if (el instanceof HTMLElement) {
            el.style.transition = ""
          }
        })
      }, 300)
    }
  }, [theme, systemTheme, enableTransitions])

  const value = {
    theme,
    setTheme: (theme: Theme) => {
      // Check if localStorage is available
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(storageKey, theme)
      }
      setTheme(theme)
    },
    systemTheme,
    actualTheme,
  }

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

export const useTheme = () => {
  const context = React.useContext(ThemeProviderContext)

  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider")

  return context
}

// Theme toggle component
export interface ThemeToggleProps {
  className?: string
  size?: "sm" | "default" | "lg"
}

export const ThemeToggle = React.forwardRef<HTMLButtonElement, ThemeToggleProps>(
  ({ className, size = "default" }, ref) => {
    const { theme, setTheme, actualTheme } = useTheme()

    const getSizeClasses = () => {
      switch (size) {
        case "sm":
          return "h-8 w-8"
        case "lg":
          return "h-12 w-12"
        default:
          return "h-10 w-10"
      }
    }

    const getIconSize = () => {
      switch (size) {
        case "sm":
          return "h-3 w-3"
        case "lg":
          return "h-6 w-6"
        default:
          return "h-4 w-4"
      }
    }

    const cycleTheme = () => {
      if (theme === "light") {
        setTheme("dark")
      } else if (theme === "dark") {
        setTheme("system")
      } else {
        setTheme("light")
      }
    }

    return (
      <button
        ref={ref}
        onClick={cycleTheme}
        className={cn(
          "inline-flex items-center justify-center rounded-md border border-border bg-background hover:bg-accent hover:text-accent-foreground transition-all duration-200",
          getSizeClasses(),
          className
        )}
        title={`Current theme: ${theme} (${actualTheme})`}
      >
        {actualTheme === "dark" ? (
          <svg className={getIconSize()} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
          </svg>
        ) : (
          <svg className={getIconSize()} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        )}
        <span className="sr-only">Toggle theme</span>
      </button>
    )
  }
)
ThemeToggle.displayName = "ThemeToggle"

// Enhanced color palette for better visual hierarchy
export const colorPalette = {
  primary: {
    50: "hsl(var(--primary) / 0.05)",
    100: "hsl(var(--primary) / 0.1)",
    200: "hsl(var(--primary) / 0.2)",
    300: "hsl(var(--primary) / 0.3)",
    400: "hsl(var(--primary) / 0.4)",
    500: "hsl(var(--primary))",
    600: "hsl(var(--primary) / 0.8)",
    700: "hsl(var(--primary) / 0.7)",
    800: "hsl(var(--primary) / 0.6)",
    900: "hsl(var(--primary) / 0.5)",
  },
  success: {
    50: "rgb(240 253 244)",
    100: "rgb(220 252 231)",
    200: "rgb(187 247 208)",
    300: "rgb(134 239 172)",
    400: "rgb(74 222 128)",
    500: "rgb(34 197 94)",
    600: "rgb(22 163 74)",
    700: "rgb(21 128 61)",
    800: "rgb(22 101 52)",
    900: "rgb(20 83 45)",
  },
  warning: {
    50: "rgb(255 251 235)",
    100: "rgb(254 243 199)",
    200: "rgb(253 230 138)",
    300: "rgb(252 211 77)",
    400: "rgb(251 191 36)",
    500: "rgb(245 158 11)",
    600: "rgb(217 119 6)",
    700: "rgb(180 83 9)",
    800: "rgb(146 64 14)",
    900: "rgb(120 53 15)",
  },
  error: {
    50: "rgb(254 242 242)",
    100: "rgb(254 226 226)",
    200: "rgb(254 202 202)",
    300: "rgb(252 165 165)",
    400: "rgb(248 113 113)",
    500: "rgb(239 68 68)",
    600: "rgb(220 38 38)",
    700: "rgb(185 28 28)",
    800: "rgb(153 27 27)",
    900: "rgb(127 29 29)",
  },
}

// CSS custom properties for enhanced theming
export const cssVariables = `
:root {
  --radius: 0.5rem;
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
  --shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);
  --shadow-2xl: 0 25px 50px -12px rgb(0 0 0 / 0.25);
  --shadow-inner: inset 0 2px 4px 0 rgb(0 0 0 / 0.05);
  
  /* Enhanced spacing scale */
  --spacing-xs: 0.25rem;
  --spacing-sm: 0.5rem;
  --spacing-md: 1rem;
  --spacing-lg: 1.5rem;
  --spacing-xl: 2rem;
  --spacing-2xl: 3rem;
  
  /* Typography scale */
  --font-size-xs: 0.75rem;
  --font-size-sm: 0.875rem;
  --font-size-base: 1rem;
  --font-size-lg: 1.125rem;
  --font-size-xl: 1.25rem;
  --font-size-2xl: 1.5rem;
  --font-size-3xl: 1.875rem;
  --font-size-4xl: 2.25rem;
  
  /* Animation durations */
  --duration-fast: 150ms;
  --duration-normal: 200ms;
  --duration-slow: 300ms;
  --duration-slower: 500ms;
  
  /* Easing functions */
  --ease-out: cubic-bezier(0, 0, 0.2, 1);
  --ease-in: cubic-bezier(0.4, 0, 1, 1);
  --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55);
}
`