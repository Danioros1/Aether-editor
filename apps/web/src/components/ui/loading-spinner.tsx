import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../../lib/utils"

const spinnerVariants = cva(
  "animate-spin rounded-full border-2 border-current border-t-transparent",
  {
    variants: {
      size: {
        sm: "h-4 w-4",
        default: "h-6 w-6",
        lg: "h-8 w-8",
        xl: "h-12 w-12",
      },
      variant: {
        default: "text-primary",
        secondary: "text-secondary",
        muted: "text-muted-foreground",
        destructive: "text-destructive",
        success: "text-green-600",
      },
    },
    defaultVariants: {
      size: "default",
      variant: "default",
    },
  }
)

export interface LoadingSpinnerProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof spinnerVariants> {
  text?: string
}

const LoadingSpinner = React.forwardRef<HTMLDivElement, LoadingSpinnerProps>(
  ({ className, size, variant, text, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("flex items-center gap-2", className)}
        {...props}
      >
        <div className={cn(spinnerVariants({ size, variant }))} />
        {text && (
          <span className="text-sm text-muted-foreground animate-pulse">
            {text}
          </span>
        )}
      </div>
    )
  }
)
LoadingSpinner.displayName = "LoadingSpinner"

// Loading overlay component
export interface LoadingOverlayProps {
  isLoading: boolean
  text?: string
  children: React.ReactNode
  className?: string
  spinnerSize?: VariantProps<typeof spinnerVariants>["size"]
}

const LoadingOverlay = React.forwardRef<HTMLDivElement, LoadingOverlayProps>(
  ({ isLoading, text = "Loading...", children, className, spinnerSize = "lg" }, ref) => {
    return (
      <div ref={ref} className={cn("relative", className)}>
        {children}
        {isLoading && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 rounded-md">
            <div className="flex flex-col items-center gap-3">
              <LoadingSpinner size={spinnerSize} text={text} />
            </div>
          </div>
        )}
      </div>
    )
  }
)
LoadingOverlay.displayName = "LoadingOverlay"

// Skeleton loading component
export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "circular" | "rectangular"
}

const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className, variant = "default", ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "animate-pulse bg-muted",
          variant === "circular" && "rounded-full",
          variant === "rectangular" && "rounded-md",
          variant === "default" && "rounded-md",
          className
        )}
        {...props}
      />
    )
  }
)
Skeleton.displayName = "Skeleton"

// Progress indicator with enhanced styling
export interface ProgressIndicatorProps {
  value: number
  max?: number
  text?: string
  showPercentage?: boolean
  variant?: "default" | "success" | "warning" | "destructive"
  size?: "sm" | "default" | "lg"
  className?: string
}

const ProgressIndicator = React.forwardRef<HTMLDivElement, ProgressIndicatorProps>(
  ({ 
    value, 
    max = 100, 
    text, 
    showPercentage = true, 
    variant = "default",
    size = "default",
    className 
  }, ref) => {
    const percentage = Math.min(100, Math.max(0, (value / max) * 100))
    
    const variantClasses = {
      default: "bg-primary",
      success: "bg-green-600",
      warning: "bg-yellow-600", 
      destructive: "bg-destructive"
    }
    
    const sizeClasses = {
      sm: "h-1",
      default: "h-2",
      lg: "h-3"
    }

    return (
      <div ref={ref} className={cn("space-y-2", className)}>
        {(text || showPercentage) && (
          <div className="flex justify-between items-center text-sm">
            {text && <span className="text-muted-foreground">{text}</span>}
            {showPercentage && (
              <span className="font-medium">{Math.round(percentage)}%</span>
            )}
          </div>
        )}
        <div className={cn("w-full bg-secondary rounded-full overflow-hidden", sizeClasses[size])}>
          <div
            className={cn("h-full transition-all duration-300 ease-out", variantClasses[variant])}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    )
  }
)
ProgressIndicator.displayName = "ProgressIndicator"

// Pulsing dot indicator
export interface PulsingDotProps {
  variant?: "default" | "success" | "warning" | "destructive"
  size?: "sm" | "default" | "lg"
  className?: string
}

const PulsingDot = React.forwardRef<HTMLDivElement, PulsingDotProps>(
  ({ variant = "default", size = "default", className }, ref) => {
    const variantClasses = {
      default: "bg-primary",
      success: "bg-green-600",
      warning: "bg-yellow-600",
      destructive: "bg-destructive"
    }
    
    const sizeClasses = {
      sm: "h-2 w-2",
      default: "h-3 w-3", 
      lg: "h-4 w-4"
    }

    return (
      <div
        ref={ref}
        className={cn(
          "rounded-full animate-pulse",
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
      />
    )
  }
)
PulsingDot.displayName = "PulsingDot"

export { LoadingSpinner, LoadingOverlay, Skeleton, ProgressIndicator, PulsingDot, spinnerVariants }