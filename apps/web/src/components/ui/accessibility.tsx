import * as React from "react"
import { cn } from "../../lib/utils"

// Screen reader only text
export interface ScreenReaderOnlyProps {
  children: React.ReactNode
  className?: string
}

export const ScreenReaderOnly = React.forwardRef<HTMLSpanElement, ScreenReaderOnlyProps>(
  ({ children, className }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(
          "sr-only absolute left-[-10000px] top-auto w-[1px] h-[1px] overflow-hidden",
          className
        )}
      >
        {children}
      </span>
    )
  }
)
ScreenReaderOnly.displayName = "ScreenReaderOnly"

// Skip link for keyboard navigation
export interface SkipLinkProps {
  href: string
  children: React.ReactNode
  className?: string
}

export const SkipLink = React.forwardRef<HTMLAnchorElement, SkipLinkProps>(
  ({ href, children, className }, ref) => {
    return (
      <a
        ref={ref}
        href={href}
        className={cn(
          "sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:shadow-lg",
          className
        )}
      >
        {children}
      </a>
    )
  }
)
SkipLink.displayName = "SkipLink"

// Focus trap for modals and dialogs
export interface FocusTrapProps {
  children: React.ReactNode
  enabled?: boolean
  className?: string
}

export const FocusTrap = React.forwardRef<HTMLDivElement, FocusTrapProps>(
  ({ children, enabled = true, className }, ref) => {
    const containerRef = React.useRef<HTMLDivElement>(null)
    const firstFocusableRef = React.useRef<HTMLElement | null>(null)
    const lastFocusableRef = React.useRef<HTMLElement | null>(null)

    React.useImperativeHandle(ref, () => containerRef.current!)

    React.useEffect(() => {
      if (!enabled || !containerRef.current) return

      const container = containerRef.current
      const focusableElements = container.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )

      if (focusableElements.length === 0) return

      firstFocusableRef.current = focusableElements[0] as HTMLElement
      lastFocusableRef.current = focusableElements[focusableElements.length - 1] as HTMLElement

      // Focus first element
      firstFocusableRef.current?.focus()

      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key !== 'Tab') return

        if (event.shiftKey) {
          // Shift + Tab
          if (document.activeElement === firstFocusableRef.current) {
            event.preventDefault()
            lastFocusableRef.current?.focus()
          }
        } else {
          // Tab
          if (document.activeElement === lastFocusableRef.current) {
            event.preventDefault()
            firstFocusableRef.current?.focus()
          }
        }
      }

      container.addEventListener('keydown', handleKeyDown)
      return () => container.removeEventListener('keydown', handleKeyDown)
    }, [enabled])

    return (
      <div ref={containerRef} className={className}>
        {children}
      </div>
    )
  }
)
FocusTrap.displayName = "FocusTrap"

// Announce changes to screen readers
export interface LiveRegionProps {
  children: React.ReactNode
  politeness?: "polite" | "assertive" | "off"
  atomic?: boolean
  relevant?: "additions" | "removals" | "text" | "all" | "additions text" | "additions removals" | "text removals" | "removals additions" | "text additions" | "removals text"
  className?: string
}

export const LiveRegion = React.forwardRef<HTMLDivElement, LiveRegionProps>(
  ({ 
    children, 
    politeness = "polite", 
    atomic = false, 
    relevant = "additions text",
    className 
  }, ref) => {
    return (
      <div
        ref={ref}
        aria-live={politeness}
        aria-atomic={atomic}
        aria-relevant={relevant}
        className={cn("sr-only", className)}
      >
        {children}
      </div>
    )
  }
)
LiveRegion.displayName = "LiveRegion"

// Keyboard navigation helper
export interface KeyboardNavigationProps {
  children: React.ReactNode
  onKeyDown?: (event: KeyboardEvent) => void
  className?: string
}

export const KeyboardNavigation = React.forwardRef<HTMLDivElement, KeyboardNavigationProps>(
  ({ children, onKeyDown, className }, ref) => {
    const containerRef = React.useRef<HTMLDivElement>(null)

    React.useImperativeHandle(ref, () => containerRef.current!)

    React.useEffect(() => {
      const container = containerRef.current
      if (!container) return

      const handleKeyDown = (event: KeyboardEvent) => {
        const focusableElements = Array.from(
          container.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          )
        ) as HTMLElement[]

        const currentIndex = focusableElements.indexOf(document.activeElement as HTMLElement)

        switch (event.key) {
          case 'ArrowDown':
          case 'ArrowRight':
            event.preventDefault()
            const nextIndex = (currentIndex + 1) % focusableElements.length
            focusableElements[nextIndex]?.focus()
            break
          case 'ArrowUp':
          case 'ArrowLeft':
            event.preventDefault()
            const prevIndex = currentIndex === 0 ? focusableElements.length - 1 : currentIndex - 1
            focusableElements[prevIndex]?.focus()
            break
          case 'Home':
            event.preventDefault()
            focusableElements[0]?.focus()
            break
          case 'End':
            event.preventDefault()
            focusableElements[focusableElements.length - 1]?.focus()
            break
        }

        onKeyDown?.(event)
      }

      container.addEventListener('keydown', handleKeyDown)
      return () => container.removeEventListener('keydown', handleKeyDown)
    }, [onKeyDown])

    return (
      <div ref={containerRef} className={className}>
        {children}
      </div>
    )
  }
)
KeyboardNavigation.displayName = "KeyboardNavigation"

// High contrast mode detector
export const useHighContrast = () => {
  const [isHighContrast, setIsHighContrast] = React.useState(false)

  React.useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-contrast: high)')
    setIsHighContrast(mediaQuery.matches)

    const handleChange = (event: MediaQueryListEvent) => {
      setIsHighContrast(event.matches)
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  return isHighContrast
}

// Reduced motion detector
export const useReducedMotion = () => {
  const [prefersReducedMotion, setPrefersReducedMotion] = React.useState(false)

  React.useEffect(() => {
    // Check if window.matchMedia is available (not available in test environment)
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
      setPrefersReducedMotion(mediaQuery.matches)

      const handleChange = (event: MediaQueryListEvent) => {
        setPrefersReducedMotion(event.matches)
      }

      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    }
  }, [])

  return prefersReducedMotion
}

// Focus visible utility
export const useFocusVisible = () => {
  const [isFocusVisible, setIsFocusVisible] = React.useState(false)

  React.useEffect(() => {
    let hadKeyboardEvent = false

    const handleKeyDown = () => {
      hadKeyboardEvent = true
    }

    const handleMouseDown = () => {
      hadKeyboardEvent = false
    }

    const handleFocus = () => {
      setIsFocusVisible(hadKeyboardEvent)
    }

    const handleBlur = () => {
      setIsFocusVisible(false)
    }

    document.addEventListener('keydown', handleKeyDown, true)
    document.addEventListener('mousedown', handleMouseDown, true)
    document.addEventListener('focus', handleFocus, true)
    document.addEventListener('blur', handleBlur, true)

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true)
      document.removeEventListener('mousedown', handleMouseDown, true)
      document.removeEventListener('focus', handleFocus, true)
      document.removeEventListener('blur', handleBlur, true)
    }
  }, [])

  return isFocusVisible
}

