import * as React from "react"
import { cn } from "../../lib/utils"
import { useReducedMotion } from "./accessibility"

// Ripple effect component
export interface RippleEffectProps {
  children: React.ReactNode
  className?: string
  color?: string
  duration?: number
}

export const RippleEffect = React.forwardRef<HTMLDivElement, RippleEffectProps>(
  ({ children, className, color = "rgba(255, 255, 255, 0.6)", duration = 600 }, ref) => {
    const [ripples, setRipples] = React.useState<Array<{ x: number; y: number; id: number }>>([])
    const prefersReducedMotion = useReducedMotion()

    const addRipple = React.useCallback((event: React.MouseEvent<HTMLDivElement>) => {
      if (prefersReducedMotion) return

      const rect = event.currentTarget.getBoundingClientRect()
      const x = event.clientX - rect.left
      const y = event.clientY - rect.top
      const id = Date.now()

      setRipples(prev => [...prev, { x, y, id }])

      setTimeout(() => {
        setRipples(prev => prev.filter(ripple => ripple.id !== id))
      }, duration)
    }, [duration, prefersReducedMotion])

    return (
      <div
        ref={ref}
        className={cn("relative overflow-hidden", className)}
        onMouseDown={addRipple}
      >
        {children}
        {ripples.map(ripple => (
          <span
            key={ripple.id}
            className="absolute rounded-full animate-ping pointer-events-none"
            style={{
              left: ripple.x - 10,
              top: ripple.y - 10,
              width: 20,
              height: 20,
              backgroundColor: color,
              animationDuration: `${duration}ms`,
            }}
          />
        ))}
      </div>
    )
  }
)
RippleEffect.displayName = "RippleEffect"

// Magnetic hover effect
export interface MagneticHoverProps {
  children: React.ReactNode
  strength?: number
  className?: string
}

export const MagneticHover = React.forwardRef<HTMLDivElement, MagneticHoverProps>(
  ({ children, strength = 0.3, className }, ref) => {
    const elementRef = React.useRef<HTMLDivElement>(null)
    const prefersReducedMotion = useReducedMotion()

    React.useImperativeHandle(ref, () => elementRef.current!)

    const handleMouseMove = React.useCallback((event: React.MouseEvent<HTMLDivElement>) => {
      if (prefersReducedMotion || !elementRef.current) return

      const rect = elementRef.current.getBoundingClientRect()
      const x = event.clientX - rect.left - rect.width / 2
      const y = event.clientY - rect.top - rect.height / 2

      elementRef.current.style.transform = `translate(${x * strength}px, ${y * strength}px)`
    }, [strength, prefersReducedMotion])

    const handleMouseLeave = React.useCallback(() => {
      if (prefersReducedMotion || !elementRef.current) return
      elementRef.current.style.transform = 'translate(0px, 0px)'
    }, [prefersReducedMotion])

    return (
      <div
        ref={elementRef}
        className={cn("transition-transform duration-200 ease-out", className)}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {children}
      </div>
    )
  }
)
MagneticHover.displayName = "MagneticHover"

// Tilt effect component
export interface TiltEffectProps {
  children: React.ReactNode
  maxTilt?: number
  perspective?: number
  scale?: number
  className?: string
}

export const TiltEffect = React.forwardRef<HTMLDivElement, TiltEffectProps>(
  ({ children, maxTilt = 15, perspective = 1000, scale = 1.05, className }, ref) => {
    const elementRef = React.useRef<HTMLDivElement>(null)
    const prefersReducedMotion = useReducedMotion()

    React.useImperativeHandle(ref, () => elementRef.current!)

    const handleMouseMove = React.useCallback((event: React.MouseEvent<HTMLDivElement>) => {
      if (prefersReducedMotion || !elementRef.current) return

      const rect = elementRef.current.getBoundingClientRect()
      const x = event.clientX - rect.left
      const y = event.clientY - rect.top
      
      const centerX = rect.width / 2
      const centerY = rect.height / 2
      
      const rotateX = ((y - centerY) / centerY) * maxTilt
      const rotateY = ((centerX - x) / centerX) * maxTilt

      elementRef.current.style.transform = `perspective(${perspective}px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(${scale})`
    }, [maxTilt, perspective, scale, prefersReducedMotion])

    const handleMouseLeave = React.useCallback(() => {
      if (prefersReducedMotion || !elementRef.current) return
      elementRef.current.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1)'
    }, [prefersReducedMotion])

    return (
      <div
        ref={elementRef}
        className={cn("transition-transform duration-200 ease-out", className)}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {children}
      </div>
    )
  }
)
TiltEffect.displayName = "TiltEffect"

// Parallax scroll effect
export interface ParallaxScrollProps {
  children: React.ReactNode
  speed?: number
  className?: string
}

export const ParallaxScroll = React.forwardRef<HTMLDivElement, ParallaxScrollProps>(
  ({ children, speed = 0.5, className }, ref) => {
    const elementRef = React.useRef<HTMLDivElement>(null)
    const prefersReducedMotion = useReducedMotion()

    React.useImperativeHandle(ref, () => elementRef.current!)

    React.useEffect(() => {
      if (prefersReducedMotion || !elementRef.current) return

      const handleScroll = () => {
        if (!elementRef.current) return
        
        const scrolled = window.pageYOffset
        const parallax = scrolled * speed
        
        elementRef.current.style.transform = `translateY(${parallax}px)`
      }

      window.addEventListener('scroll', handleScroll)
      return () => window.removeEventListener('scroll', handleScroll)
    }, [speed, prefersReducedMotion])

    return (
      <div ref={elementRef} className={className}>
        {children}
      </div>
    )
  }
)
ParallaxScroll.displayName = "ParallaxScroll"

// Morphing button component
export interface MorphingButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  morphTo?: "circle" | "pill" | "square"
  duration?: number
}

export const MorphingButton = React.forwardRef<HTMLButtonElement, MorphingButtonProps>(
  ({ children, morphTo = "circle", duration = 300, className, ...props }, ref) => {
    const [isMorphed, setIsMorphed] = React.useState(false)
    const prefersReducedMotion = useReducedMotion()

    const getMorphClass = () => {
      if (prefersReducedMotion) return ""
      
      switch (morphTo) {
        case "circle":
          return isMorphed ? "rounded-full aspect-square" : "rounded-md"
        case "pill":
          return isMorphed ? "rounded-full" : "rounded-md"
        case "square":
          return isMorphed ? "rounded-none" : "rounded-md"
        default:
          return "rounded-md"
      }
    }

    return (
      <button
        ref={ref}
        className={cn(
          "transition-all ease-out",
          getMorphClass(),
          className
        )}
        style={{ transitionDuration: `${duration}ms` }}
        onMouseEnter={() => setIsMorphed(true)}
        onMouseLeave={() => setIsMorphed(false)}
        {...props}
      >
        {children}
      </button>
    )
  }
)
MorphingButton.displayName = "MorphingButton"

// Breathing animation component
export interface BreathingAnimationProps {
  children: React.ReactNode
  duration?: number
  intensity?: number
  className?: string
}

export const BreathingAnimation = React.forwardRef<HTMLDivElement, BreathingAnimationProps>(
  ({ children, duration = 4000, className }, ref) => {
    const prefersReducedMotion = useReducedMotion()

    if (prefersReducedMotion) {
      return (
        <div ref={ref} className={className}>
          {children}
        </div>
      )
    }

    return (
      <div
        ref={ref}
        className={cn("animate-pulse", className)}
        style={{
          animationDuration: `${duration}ms`,
          animationTimingFunction: 'ease-in-out',
        }}
      >
        {children}
      </div>
    )
  }
)
BreathingAnimation.displayName = "BreathingAnimation"

// Elastic scale component
export interface ElasticScaleProps {
  children: React.ReactNode
  trigger?: boolean
  scale?: number
  duration?: number
  className?: string
}

export const ElasticScale = React.forwardRef<HTMLDivElement, ElasticScaleProps>(
  ({ children, trigger = false, scale = 1.1, duration = 300, className }, ref) => {
    const prefersReducedMotion = useReducedMotion()

    return (
      <div
        ref={ref}
        className={cn(
          "transition-transform ease-out",
          !prefersReducedMotion && trigger && "animate-bounce",
          className
        )}
        style={{
          transform: trigger && !prefersReducedMotion ? `scale(${scale})` : 'scale(1)',
          transitionDuration: `${duration}ms`,
          transitionTimingFunction: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
        }}
      >
        {children}
      </div>
    )
  }
)
ElasticScale.displayName = "ElasticScale"

// Typewriter effect component
export interface TypewriterEffectProps {
  text: string
  speed?: number
  delay?: number
  cursor?: boolean
  className?: string
  onComplete?: () => void
}

export const TypewriterEffect = React.forwardRef<HTMLSpanElement, TypewriterEffectProps>(
  ({ text, speed = 50, delay = 0, cursor = true, className, onComplete }, ref) => {
    const [displayText, setDisplayText] = React.useState("")
    const [currentIndex, setCurrentIndex] = React.useState(0)
    const [showCursor, setShowCursor] = React.useState(true)

    React.useEffect(() => {
      const startTimer = setTimeout(() => {
        if (currentIndex < text.length) {
          const timer = setTimeout(() => {
            setDisplayText(prev => prev + text[currentIndex])
            setCurrentIndex(prev => prev + 1)
          }, speed)
          return () => clearTimeout(timer)
        } else {
          onComplete?.()
          if (cursor) {
            const cursorTimer = setInterval(() => {
              setShowCursor(prev => !prev)
            }, 500)
            return () => clearInterval(cursorTimer)
          }
        }
      }, delay)

      return () => clearTimeout(startTimer)
    }, [currentIndex, text, speed, delay, cursor, onComplete])

    return (
      <span ref={ref} className={className}>
        {displayText}
        {cursor && showCursor && <span className="animate-pulse">|</span>}
      </span>
    )
  }
)
TypewriterEffect.displayName = "TypewriterEffect"