import * as React from "react"
import { cn } from "../../lib/utils"
import { useReducedMotion } from "./accessibility"

// Enhanced visual effects
export interface GlowEffectProps {
  children: React.ReactNode
  color?: "primary" | "success" | "warning" | "error"
  intensity?: "low" | "medium" | "high"
  className?: string
}

export const GlowEffect = React.forwardRef<HTMLDivElement, GlowEffectProps>(
  ({ children, color = "primary", intensity = "medium", className }, ref) => {
    const getGlowClass = () => {
      const baseClass = "transition-all duration-300"
      const colorMap = {
        primary: "shadow-primary/50",
        success: "shadow-green-500/50", 
        warning: "shadow-yellow-500/50",
        error: "shadow-red-500/50"
      }
      const intensityMap = {
        low: "shadow-sm",
        medium: "shadow-md hover:shadow-lg",
        high: "shadow-lg hover:shadow-xl"
      }
      
      return `${baseClass} ${colorMap[color]} ${intensityMap[intensity]}`
    }

    return (
      <div
        ref={ref}
        className={cn(getGlowClass(), className)}
      >
        {children}
      </div>
    )
  }
)
GlowEffect.displayName = "GlowEffect"

// Enhanced card with subtle animations and better visual hierarchy
export interface PolishedCardProps {
  children: React.ReactNode
  className?: string
  hover?: boolean
  glow?: boolean
  gradient?: boolean
  elevated?: boolean
}

export const PolishedCard = React.forwardRef<HTMLDivElement, PolishedCardProps>(
  ({ children, className, hover = true, glow = false, gradient = false, elevated = false }, ref) => {
    const prefersReducedMotion = useReducedMotion()

    return (
      <div
        ref={ref}
        className={cn(
          "rounded-lg border bg-card text-card-foreground transition-all duration-200",
          !prefersReducedMotion && hover && "hover:shadow-md hover:-translate-y-0.5",
          glow && "shadow-lg shadow-primary/10",
          gradient && "bg-gradient-to-br from-card to-card/80",
          elevated && "shadow-lg",
          className
        )}
      >
        {children}
      </div>
    )
  }
)
PolishedCard.displayName = "PolishedCard"

// Enhanced button with better visual feedback
export interface PolishedButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "primary" | "secondary" | "ghost" | "destructive"
  size?: "sm" | "default" | "lg"
  loading?: boolean
  success?: boolean
  className?: string
  children: React.ReactNode
}

export const PolishedButton = React.forwardRef<HTMLButtonElement, PolishedButtonProps>(
  ({ 
    variant = "default", 
    size = "default", 
    loading = false, 
    success = false,
    className, 
    children, 
    disabled,
    ...props 
  }, ref) => {
    const prefersReducedMotion = useReducedMotion()

    const getVariantClasses = () => {
      switch (variant) {
        case "primary":
          return "bg-primary text-primary-foreground hover:bg-primary/90 shadow-md hover:shadow-lg"
        case "secondary":
          return "bg-secondary text-secondary-foreground hover:bg-secondary/80"
        case "ghost":
          return "hover:bg-accent hover:text-accent-foreground"
        case "destructive":
          return "bg-destructive text-destructive-foreground hover:bg-destructive/90"
        default:
          return "bg-background border border-border hover:bg-accent hover:text-accent-foreground"
      }
    }

    const getSizeClasses = () => {
      switch (size) {
        case "sm":
          return "h-8 px-3 text-sm"
        case "lg":
          return "h-12 px-8 text-lg"
        default:
          return "h-10 px-4"
      }
    }

    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-md font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
          !prefersReducedMotion && "hover:scale-105 active:scale-95",
          getVariantClasses(),
          getSizeClasses(),
          success && "bg-green-600 text-white hover:bg-green-700",
          loading && "cursor-not-allowed opacity-70",
          className
        )}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        )}
        {success && (
          <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        )}
        {children}
      </button>
    )
  }
)
PolishedButton.displayName = "PolishedButton"

// Enhanced input with better visual states
export interface PolishedInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
  success?: boolean
  loading?: boolean
}

export const PolishedInput = React.forwardRef<HTMLInputElement, PolishedInputProps>(
  ({ className, error, success, loading, ...props }, ref) => {
    return (
      <div className="relative">
        <input
          ref={ref}
          className={cn(
            "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200",
            error && "border-destructive focus-visible:ring-destructive",
            success && "border-green-500 focus-visible:ring-green-500",
            className
          )}
          {...props}
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <svg className="animate-spin h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
        )}
        {success && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <svg className="h-4 w-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}
        {error && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <svg className="h-4 w-4 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        )}
      </div>
    )
  }
)
PolishedInput.displayName = "PolishedInput"

// Status indicator with enhanced visuals
export interface StatusIndicatorProps {
  status: "online" | "offline" | "busy" | "away" | "loading"
  size?: "sm" | "default" | "lg"
  showLabel?: boolean
  className?: string
}

export const StatusIndicator = React.forwardRef<HTMLDivElement, StatusIndicatorProps>(
  ({ status, size = "default", showLabel = false, className }, ref) => {
    const getSizeClasses = () => {
      switch (size) {
        case "sm":
          return "h-2 w-2"
        case "lg":
          return "h-4 w-4"
        default:
          return "h-3 w-3"
      }
    }

    const getStatusClasses = () => {
      switch (status) {
        case "online":
          return "bg-green-500 shadow-green-500/50"
        case "offline":
          return "bg-gray-400 shadow-gray-400/50"
        case "busy":
          return "bg-red-500 shadow-red-500/50"
        case "away":
          return "bg-yellow-500 shadow-yellow-500/50"
        case "loading":
          return "bg-blue-500 shadow-blue-500/50 animate-pulse"
        default:
          return "bg-gray-400 shadow-gray-400/50"
      }
    }

    const getLabel = () => {
      switch (status) {
        case "online":
          return "Online"
        case "offline":
          return "Offline"
        case "busy":
          return "Busy"
        case "away":
          return "Away"
        case "loading":
          return "Loading"
        default:
          return "Unknown"
      }
    }

    return (
      <div ref={ref} className={cn("flex items-center gap-2", className)}>
        <div
          className={cn(
            "rounded-full shadow-sm",
            getSizeClasses(),
            getStatusClasses()
          )}
        />
        {showLabel && (
          <span className="text-sm text-muted-foreground">
            {getLabel()}
          </span>
        )}
      </div>
    )
  }
)
StatusIndicator.displayName = "StatusIndicator"

// Enhanced progress bar with better visuals
export interface PolishedProgressProps {
  value: number
  max?: number
  variant?: "default" | "success" | "warning" | "error"
  size?: "sm" | "default" | "lg"
  showPercentage?: boolean
  animated?: boolean
  className?: string
}

export const PolishedProgress = React.forwardRef<HTMLDivElement, PolishedProgressProps>(
  ({ 
    value, 
    max = 100, 
    variant = "default", 
    size = "default",
    showPercentage = false,
    animated = true,
    className 
  }, ref) => {
    const percentage = Math.min(100, Math.max(0, (value / max) * 100))
    const prefersReducedMotion = useReducedMotion()

    const getSizeClasses = () => {
      switch (size) {
        case "sm":
          return "h-1"
        case "lg":
          return "h-3"
        default:
          return "h-2"
      }
    }

    const getVariantClasses = () => {
      switch (variant) {
        case "success":
          return "bg-green-500"
        case "warning":
          return "bg-yellow-500"
        case "error":
          return "bg-red-500"
        default:
          return "bg-primary"
      }
    }

    return (
      <div ref={ref} className={cn("space-y-1", className)}>
        {showPercentage && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">{Math.round(percentage)}%</span>
          </div>
        )}
        <div className={cn("w-full bg-secondary rounded-full overflow-hidden", getSizeClasses())}>
          <div
            className={cn(
              "h-full transition-all duration-500 ease-out rounded-full",
              !prefersReducedMotion && animated && "transition-all duration-500",
              getVariantClasses()
            )}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    )
  }
)
PolishedProgress.displayName = "PolishedProgress"

// Floating action button with enhanced styling
export interface FloatingActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode
  position?: "bottom-right" | "bottom-left" | "top-right" | "top-left"
  size?: "sm" | "default" | "lg"
}

export const FloatingActionButton = React.forwardRef<HTMLButtonElement, FloatingActionButtonProps>(
  ({ icon, position = "bottom-right", size = "default", className, ...props }, ref) => {
    const getPositionClasses = () => {
      switch (position) {
        case "bottom-left":
          return "bottom-6 left-6"
        case "top-right":
          return "top-6 right-6"
        case "top-left":
          return "top-6 left-6"
        default:
          return "bottom-6 right-6"
      }
    }

    const getSizeClasses = () => {
      switch (size) {
        case "sm":
          return "h-12 w-12"
        case "lg":
          return "h-16 w-16"
        default:
          return "h-14 w-14"
      }
    }

    return (
      <button
        ref={ref}
        className={cn(
          "fixed z-50 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-110 active:scale-95 flex items-center justify-center",
          getPositionClasses(),
          getSizeClasses(),
          className
        )}
        {...props}
      >
        {icon}
      </button>
    )
  }
)
FloatingActionButton.displayName = "FloatingActionButton"