import * as React from "react"
import { cn } from "../../lib/utils"

// Fade in animation component
export interface FadeInProps {
  children: React.ReactNode
  delay?: number
  duration?: number
  className?: string
}

export const FadeIn = React.forwardRef<HTMLDivElement, FadeInProps>(
  ({ children, delay = 0, duration = 300, className }, ref) => {
    const [isVisible, setIsVisible] = React.useState(false)

    React.useEffect(() => {
      const timer = setTimeout(() => {
        setIsVisible(true)
      }, delay)

      return () => clearTimeout(timer)
    }, [delay])

    return (
      <div
        ref={ref}
        className={cn(
          "transition-all ease-out",
          isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2",
          className
        )}
        style={{
          transitionDuration: `${duration}ms`,
        }}
      >
        {children}
      </div>
    )
  }
)
FadeIn.displayName = "FadeIn"

// Slide in animation component
export interface SlideInProps {
  children: React.ReactNode
  direction?: "left" | "right" | "up" | "down"
  delay?: number
  duration?: number
  distance?: number
  className?: string
}

export const SlideIn = React.forwardRef<HTMLDivElement, SlideInProps>(
  ({ 
    children, 
    direction = "up", 
    delay = 0, 
    duration = 300, 
    distance = 20,
    className 
  }, ref) => {
    const [isVisible, setIsVisible] = React.useState(false)

    React.useEffect(() => {
      const timer = setTimeout(() => {
        setIsVisible(true)
      }, delay)

      return () => clearTimeout(timer)
    }, [delay])

    const getTransform = () => {
      if (isVisible) return "translate-x-0 translate-y-0"
      
      switch (direction) {
        case "left":
          return `translate-x-[-${distance}px]`
        case "right":
          return `translate-x-[${distance}px]`
        case "up":
          return `translate-y-[-${distance}px]`
        case "down":
          return `translate-y-[${distance}px]`
        default:
          return `translate-y-[${distance}px]`
      }
    }

    return (
      <div
        ref={ref}
        className={cn(
          "transition-all ease-out",
          isVisible ? "opacity-100" : "opacity-0",
          getTransform(),
          className
        )}
        style={{
          transitionDuration: `${duration}ms`,
        }}
      >
        {children}
      </div>
    )
  }
)
SlideIn.displayName = "SlideIn"

// Scale in animation component
export interface ScaleInProps {
  children: React.ReactNode
  delay?: number
  duration?: number
  scale?: number
  className?: string
}

export const ScaleIn = React.forwardRef<HTMLDivElement, ScaleInProps>(
  ({ children, delay = 0, duration = 300, scale = 0.95, className }, ref) => {
    const [isVisible, setIsVisible] = React.useState(false)

    React.useEffect(() => {
      const timer = setTimeout(() => {
        setIsVisible(true)
      }, delay)

      return () => clearTimeout(timer)
    }, [delay])

    return (
      <div
        ref={ref}
        className={cn(
          "transition-all ease-out",
          isVisible 
            ? "opacity-100 scale-100" 
            : `opacity-0 scale-[${scale}]`,
          className
        )}
        style={{
          transitionDuration: `${duration}ms`,
        }}
      >
        {children}
      </div>
    )
  }
)
ScaleIn.displayName = "ScaleIn"

// Stagger children animation
export interface StaggerProps {
  children: React.ReactNode
  staggerDelay?: number
  className?: string
}

export const Stagger = React.forwardRef<HTMLDivElement, StaggerProps>(
  ({ children, staggerDelay = 100, className }, ref) => {
    return (
      <div ref={ref} className={className}>
        {React.Children.map(children, (child, index) => (
          <FadeIn key={index} delay={index * staggerDelay}>
            {child}
          </FadeIn>
        ))}
      </div>
    )
  }
)
Stagger.displayName = "Stagger"

// Bounce animation component
export interface BounceProps {
  children: React.ReactNode
  trigger?: boolean
  className?: string
}

export const Bounce = React.forwardRef<HTMLDivElement, BounceProps>(
  ({ children, trigger = false, className }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "transition-transform duration-200 ease-out",
          trigger && "animate-bounce",
          className
        )}
      >
        {children}
      </div>
    )
  }
)
Bounce.displayName = "Bounce"

// Pulse animation component
export interface PulseProps {
  children: React.ReactNode
  active?: boolean
  className?: string
}

export const Pulse = React.forwardRef<HTMLDivElement, PulseProps>(
  ({ children, active = false, className }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "transition-all duration-1000",
          active && "animate-pulse",
          className
        )}
      >
        {children}
      </div>
    )
  }
)
Pulse.displayName = "Pulse"

// Smooth height transition
export interface SmoothHeightProps {
  children: React.ReactNode
  isOpen: boolean
  duration?: number
  className?: string
}

export const SmoothHeight = React.forwardRef<HTMLDivElement, SmoothHeightProps>(
  ({ children, isOpen, duration = 300, className }, ref) => {
    const contentRef = React.useRef<HTMLDivElement>(null)
    const [height, setHeight] = React.useState<number | "auto">(0)

    React.useEffect(() => {
      if (contentRef.current) {
        if (isOpen) {
          setHeight(contentRef.current.scrollHeight)
        } else {
          setHeight(0)
        }
      }
    }, [isOpen, children])

    React.useEffect(() => {
      if (isOpen && height !== "auto") {
        const timer = setTimeout(() => {
          setHeight("auto")
        }, duration)
        return () => clearTimeout(timer)
      }
    }, [isOpen, height, duration])

    return (
      <div
        ref={ref}
        className={cn("overflow-hidden transition-all ease-out", className)}
        style={{
          height: height,
          transitionDuration: `${duration}ms`,
        }}
      >
        <div ref={contentRef}>
          {children}
        </div>
      </div>
    )
  }
)
SmoothHeight.displayName = "SmoothHeight"

// Hover lift effect
export interface HoverLiftProps {
  children: React.ReactNode
  lift?: number
  className?: string
}

export const HoverLift = React.forwardRef<HTMLDivElement, HoverLiftProps>(
  ({ children, lift = 2, className }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "transition-transform duration-200 ease-out hover:scale-105",
          `hover:translate-y-[-${lift}px]`,
          className
        )}
      >
        {children}
      </div>
    )
  }
)
HoverLift.displayName = "HoverLift"

// Shimmer loading effect
export interface ShimmerProps {
  className?: string
  width?: string | number
  height?: string | number
}

export const Shimmer = React.forwardRef<HTMLDivElement, ShimmerProps>(
  ({ className, width = "100%", height = "1rem" }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "relative overflow-hidden rounded-md bg-muted",
          className
        )}
        style={{ width, height }}
      >
        <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      </div>
    )
  }
)
Shimmer.displayName = "Shimmer"



// Floating animation
export interface FloatingProps {
  children: React.ReactNode
  duration?: number
  delay?: number
  className?: string
}

export const Floating = React.forwardRef<HTMLDivElement, FloatingProps>(
  ({ children, duration = 3000, delay = 0, className }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("animate-float", className)}
        style={{
          animationDuration: `${duration}ms`,
          animationDelay: `${delay}ms`,
        }}
      >
        {children}
      </div>
    )
  }
)
Floating.displayName = "Floating"

// Gradient text effect
export interface GradientTextProps {
  children: React.ReactNode
  gradient?: "primary" | "rainbow" | "sunset" | "ocean"
  className?: string
}

export const GradientText = React.forwardRef<HTMLSpanElement, GradientTextProps>(
  ({ children, gradient = "primary", className }, ref) => {
    const getGradientClass = () => {
      switch (gradient) {
        case "primary":
          return "bg-gradient-to-r from-primary to-primary/70"
        case "rainbow":
          return "bg-gradient-to-r from-red-500 via-yellow-500 via-green-500 via-blue-500 to-purple-500"
        case "sunset":
          return "bg-gradient-to-r from-orange-500 to-pink-500"
        case "ocean":
          return "bg-gradient-to-r from-blue-500 to-teal-500"
        default:
          return "bg-gradient-to-r from-primary to-primary/70"
      }
    }

    return (
      <span
        ref={ref}
        className={cn(
          "bg-clip-text text-transparent font-semibold",
          getGradientClass(),
          className
        )}
      >
        {children}
      </span>
    )
  }
)
GradientText.displayName = "GradientText"

// Add enhanced keyframes to global styles
const enhancedKeyframes = `
@keyframes shimmer {
  100% {
    transform: translateX(100%);
  }
}

@keyframes float {
  0%, 100% {
    transform: translateY(0px);
  }
  50% {
    transform: translateY(-10px);
  }
}

@keyframes gradient-shift {
  0%, 100% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
}

@keyframes pulse-glow {
  0%, 100% {
    box-shadow: 0 0 5px rgba(var(--primary), 0.5);
  }
  50% {
    box-shadow: 0 0 20px rgba(var(--primary), 0.8), 0 0 30px rgba(var(--primary), 0.6);
  }
}

@keyframes slide-up-fade {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes bounce-in {
  0% {
    opacity: 0;
    transform: scale(0.3);
  }
  50% {
    opacity: 1;
    transform: scale(1.05);
  }
  70% {
    transform: scale(0.9);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}
`

// Inject enhanced styles
if (typeof document !== 'undefined') {
  const style = document.createElement('style')
  style.textContent = enhancedKeyframes
  document.head.appendChild(style)
}

