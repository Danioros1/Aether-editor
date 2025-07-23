import * as React from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../../lib/utils"
import { HelpCircle, Info, AlertTriangle, CheckCircle } from "lucide-react"

const tooltipVariants = cva(
  "z-50 overflow-hidden rounded-md px-3 py-1.5 text-sm shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        secondary: "bg-secondary text-secondary-foreground border border-border",
        info: "bg-blue-600 text-white",
        warning: "bg-yellow-600 text-white",
        error: "bg-destructive text-destructive-foreground",
        success: "bg-green-600 text-white",
      },
      size: {
        sm: "px-2 py-1 text-xs",
        default: "px-3 py-1.5 text-sm",
        lg: "px-4 py-2 text-base max-w-xs",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const TooltipProvider = TooltipPrimitive.Provider

const Tooltip = TooltipPrimitive.Root

const TooltipTrigger = TooltipPrimitive.Trigger

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content> &
    VariantProps<typeof tooltipVariants>
>(({ className, sideOffset = 4, variant, size, ...props }, ref) => (
  <TooltipPrimitive.Content
    ref={ref}
    sideOffset={sideOffset}
    className={cn(tooltipVariants({ variant, size }), className)}
    {...props}
  />
))
TooltipContent.displayName = TooltipPrimitive.Content.displayName

// Enhanced tooltip with icon and rich content
export interface EnhancedTooltipProps {
  children: React.ReactNode
  content: React.ReactNode
  title?: string
  variant?: VariantProps<typeof tooltipVariants>["variant"]
  size?: VariantProps<typeof tooltipVariants>["size"]
  side?: "top" | "right" | "bottom" | "left"
  icon?: "help" | "info" | "warning" | "success" | React.ReactNode
  showArrow?: boolean
  delayDuration?: number
  className?: string
}

const EnhancedTooltip = React.forwardRef<HTMLDivElement, EnhancedTooltipProps>(
  ({ 
    children, 
    content, 
    title,
    variant = "default",
    size = "default", 
    side = "top",
    icon,
    showArrow = true,
    delayDuration = 200,
    className 
  }, _ref) => {
    const getIcon = () => {
      if (React.isValidElement(icon)) return icon
      
      switch (icon) {
        case "help":
          return <HelpCircle className="h-3 w-3 mr-1 flex-shrink-0" />
        case "info":
          return <Info className="h-3 w-3 mr-1 flex-shrink-0" />
        case "warning":
          return <AlertTriangle className="h-3 w-3 mr-1 flex-shrink-0" />
        case "success":
          return <CheckCircle className="h-3 w-3 mr-1 flex-shrink-0" />
        default:
          return null
      }
    }

    return (
      <TooltipProvider delayDuration={delayDuration}>
        <Tooltip>
          <TooltipTrigger asChild>
            {children}
          </TooltipTrigger>
          <TooltipContent 
            side={side} 
            variant={variant} 
            size={size}
            className={className}
          >
            <div className="flex items-start">
              {getIcon()}
              <div className="flex-1">
                {title && (
                  <div className="font-medium mb-1">{title}</div>
                )}
                <div className={title ? "text-xs opacity-90" : ""}>{content}</div>
              </div>
            </div>
            {showArrow && <TooltipPrimitive.Arrow className="fill-current" />}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }
)
EnhancedTooltip.displayName = "EnhancedTooltip"

// Help tooltip specifically for complex features
export interface HelpTooltipProps {
  children: React.ReactNode
  title: string
  description: string
  shortcut?: string
  className?: string
}

const HelpTooltip = React.forwardRef<HTMLDivElement, HelpTooltipProps>(
  ({ children, title, description, shortcut, className }, ref) => {
    return (
      <EnhancedTooltip
        ref={ref}
        icon="help"
        variant="secondary"
        size="lg"
        title={title}
        content={
          <div className="space-y-1">
            <p>{description}</p>
            {shortcut && (
              <div className="flex items-center gap-1 text-xs opacity-75">
                <span>Shortcut:</span>
                <kbd className="px-1 py-0.5 bg-muted text-muted-foreground rounded text-xs">
                  {shortcut}
                </kbd>
              </div>
            )}
          </div>
        }
        className={className}
      >
        {children}
      </EnhancedTooltip>
    )
  }
)
HelpTooltip.displayName = "HelpTooltip"

// Quick info tooltip for status indicators
export interface StatusTooltipProps {
  children: React.ReactNode
  status: "info" | "success" | "warning" | "error"
  message: string
  className?: string
}

const StatusTooltip = React.forwardRef<HTMLDivElement, StatusTooltipProps>(
  ({ children, status, message, className }, ref) => {
    const variantMap = {
      info: "info" as const,
      success: "success" as const,
      warning: "warning" as const,
      error: "error" as const,
    }

    const iconMap = {
      info: "info" as const,
      success: "success" as const,
      warning: "warning" as const,
      error: "warning" as const,
    }

    return (
      <EnhancedTooltip
        ref={ref}
        icon={iconMap[status]}
        variant={variantMap[status]}
        content={message}
        className={className}
        delayDuration={100}
      >
        {children}
      </EnhancedTooltip>
    )
  }
)
StatusTooltip.displayName = "StatusTooltip"

export {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
  EnhancedTooltip,
  HelpTooltip,
  StatusTooltip,
  tooltipVariants,
}