import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../../lib/utils"
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Info, 
  Loader2,
  RefreshCw,
  X
} from "lucide-react"
import { Button } from "./button"


// Enhanced alert variants
const feedbackVariants = cva(
  "relative w-full rounded-lg border p-4 [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground",
  {
    variants: {
      variant: {
        default: "bg-background text-foreground",
        destructive: "border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive",
        success: "border-green-200 bg-green-50 text-green-900 dark:border-green-800 dark:bg-green-950 dark:text-green-50 [&>svg]:text-green-600",
        warning: "border-yellow-200 bg-yellow-50 text-yellow-900 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-50 [&>svg]:text-yellow-600",
        info: "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-50 [&>svg]:text-blue-600",
        loading: "border-primary/20 bg-primary/5 text-foreground [&>svg]:text-primary",
      },
      size: {
        default: "p-4",
        sm: "p-3 text-sm",
        lg: "p-6",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

// Feedback message component
export interface FeedbackMessageProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof feedbackVariants> {
  title?: string
  description?: string
  action?: React.ReactNode
  dismissible?: boolean
  onDismiss?: () => void
  icon?: React.ReactNode
}

const FeedbackMessage = React.forwardRef<HTMLDivElement, FeedbackMessageProps>(
  ({ 
    className, 
    variant, 
    size, 
    title, 
    description, 
    action, 
    dismissible = false,
    onDismiss,
    icon,
    children,
    ...props 
  }, ref) => {
    const getDefaultIcon = () => {
      switch (variant) {
        case "success":
          return <CheckCircle className="h-4 w-4" />
        case "destructive":
          return <XCircle className="h-4 w-4" />
        case "warning":
          return <AlertTriangle className="h-4 w-4" />
        case "info":
          return <Info className="h-4 w-4" />
        case "loading":
          return <Loader2 className="h-4 w-4 animate-spin" />
        default:
          return <Info className="h-4 w-4" />
      }
    }

    return (
      <div
        ref={ref}
        role="alert"
        className={cn(feedbackVariants({ variant, size }), className)}
        {...props}
      >
        {icon || getDefaultIcon()}
        <div className="flex-1">
          {title && (
            <h5 className="mb-1 font-medium leading-none tracking-tight">
              {title}
            </h5>
          )}
          {description && (
            <div className="text-sm [&_p]:leading-relaxed">
              {description}
            </div>
          )}
          {children}
          {action && (
            <div className="mt-3">
              {action}
            </div>
          )}
        </div>
        {dismissible && onDismiss && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-2 top-2 h-6 w-6 p-0 hover:bg-transparent"
            onClick={onDismiss}
          >
            <X className="h-3 w-3" />
            <span className="sr-only">Dismiss</span>
          </Button>
        )}
      </div>
    )
  }
)
FeedbackMessage.displayName = "FeedbackMessage"

// Loading state component
export interface LoadingStateProps {
  title?: string
  description?: string
  progress?: number
  className?: string
}

const LoadingState = React.forwardRef<HTMLDivElement, LoadingStateProps>(
  ({ title = "Loading...", description, progress, className }, ref) => {
    return (
      <FeedbackMessage
        ref={ref}
        variant="loading"
        title={title}
        description={description}
        className={className}
      >
        {progress !== undefined && (
          <div className="mt-2">
            <div className="flex justify-between text-xs mb-1">
              <span>Progress</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="w-full bg-secondary rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
              />
            </div>
          </div>
        )}
      </FeedbackMessage>
    )
  }
)
LoadingState.displayName = "LoadingState"

// Error state component with retry functionality
export interface ErrorStateProps {
  title?: string
  description?: string
  error?: Error | string
  onRetry?: () => void
  retryText?: string
  showDetails?: boolean
  className?: string
}

const ErrorState = React.forwardRef<HTMLDivElement, ErrorStateProps>(
  ({ 
    title = "Something went wrong", 
    description, 
    error,
    onRetry,
    retryText = "Try again",
    showDetails = false,
    className 
  }, ref) => {
    const [showErrorDetails, setShowErrorDetails] = React.useState(false)
    
    const errorMessage = error instanceof Error ? error.message : error

    return (
      <FeedbackMessage
        ref={ref}
        variant="destructive"
        title={title}
        description={description}
        className={className}
        action={
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              {onRetry && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRetry}
                  className="h-8"
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  {retryText}
                </Button>
              )}
              {showDetails && errorMessage && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowErrorDetails(!showErrorDetails)}
                  className="h-8"
                >
                  {showErrorDetails ? "Hide" : "Show"} Details
                </Button>
              )}
            </div>
            {showErrorDetails && errorMessage && (
              <div className="mt-2 p-2 bg-destructive/10 rounded text-xs font-mono">
                {errorMessage}
              </div>
            )}
          </div>
        }
      />
    )
  }
)
ErrorState.displayName = "ErrorState"

// Success state component
export interface SuccessStateProps {
  title?: string
  description?: string
  action?: React.ReactNode
  className?: string
}

const SuccessState = React.forwardRef<HTMLDivElement, SuccessStateProps>(
  ({ title = "Success!", description, action, className }, ref) => {
    return (
      <FeedbackMessage
        ref={ref}
        variant="success"
        title={title}
        description={description}
        action={action}
        className={className}
      />
    )
  }
)
SuccessState.displayName = "SuccessState"

// Empty state component
export interface EmptyStateProps {
  title?: string
  description?: string
  action?: React.ReactNode
  icon?: React.ReactNode
  className?: string
}

const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ 
    title = "No items found", 
    description = "Get started by adding your first item.",
    action,
    icon,
    className 
  }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "flex flex-col items-center justify-center p-8 text-center",
          className
        )}
      >
        {icon && (
          <div className="mb-4 text-muted-foreground">
            {icon}
          </div>
        )}
        <h3 className="mb-2 text-lg font-medium">{title}</h3>
        <p className="mb-4 text-sm text-muted-foreground max-w-sm">
          {description}
        </p>
        {action}
      </div>
    )
  }
)
EmptyState.displayName = "EmptyState"

export {
  FeedbackMessage,
  LoadingState,
  ErrorState,
  SuccessState,
  EmptyState,
  feedbackVariants,
}