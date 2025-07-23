import * as React from "react"
import { cn } from "../../lib/utils"
import { useResponsive } from "../../hooks/useResponsive"

// Responsive container that adapts to screen size
export interface ResponsiveContainerProps {
  children: React.ReactNode
  className?: string
  mobileClassName?: string
  tabletClassName?: string
  desktopClassName?: string
}

export const ResponsiveContainer = React.forwardRef<HTMLDivElement, ResponsiveContainerProps>(
  ({ children, className, mobileClassName, tabletClassName, desktopClassName }, ref) => {
    const { isMobile, isTablet, isDesktop } = useResponsive()

    const responsiveClassName = cn(
      className,
      isMobile && mobileClassName,
      isTablet && tabletClassName,
      isDesktop && desktopClassName
    )

    return (
      <div ref={ref} className={responsiveClassName}>
        {children}
      </div>
    )
  }
)
ResponsiveContainer.displayName = "ResponsiveContainer"

// Responsive grid that adapts columns based on screen size
export interface ResponsiveGridProps {
  children: React.ReactNode
  className?: string
  mobileColumns?: number
  tabletColumns?: number
  desktopColumns?: number
  gap?: number
}

export const ResponsiveGrid = React.forwardRef<HTMLDivElement, ResponsiveGridProps>(
  ({ 
    children, 
    className, 
    mobileColumns = 1, 
    tabletColumns = 2, 
    desktopColumns = 3,
    gap = 4
  }, ref) => {
    const { isMobile, isTablet } = useResponsive()

    const getGridColumns = () => {
      if (isMobile) return mobileColumns
      if (isTablet) return tabletColumns
      return desktopColumns
    }

    const gridClassName = cn(
      "grid",
      `grid-cols-${getGridColumns()}`,
      `gap-${gap}`,
      className
    )

    return (
      <div ref={ref} className={gridClassName}>
        {children}
      </div>
    )
  }
)
ResponsiveGrid.displayName = "ResponsiveGrid"

// Responsive text that scales with screen size
export interface ResponsiveTextProps {
  children: React.ReactNode
  className?: string
  mobileSize?: "xs" | "sm" | "base" | "lg" | "xl"
  tabletSize?: "xs" | "sm" | "base" | "lg" | "xl"
  desktopSize?: "xs" | "sm" | "base" | "lg" | "xl"
}

export const ResponsiveText = React.forwardRef<HTMLDivElement, ResponsiveTextProps>(
  ({ 
    children, 
    className, 
    mobileSize = "sm", 
    tabletSize = "base", 
    desktopSize = "base" 
  }, ref) => {
    const { isMobile, isTablet } = useResponsive()

    const getTextSize = () => {
      if (isMobile) return mobileSize
      if (isTablet) return tabletSize
      return desktopSize
    }

    const textClassName = cn(
      `text-${getTextSize()}`,
      className
    )

    return (
      <div ref={ref} className={textClassName}>
        {children}
      </div>
    )
  }
)
ResponsiveText.displayName = "ResponsiveText"

// Responsive spacing component
export interface ResponsiveSpacingProps {
  children: React.ReactNode
  className?: string
  mobilePadding?: number
  tabletPadding?: number
  desktopPadding?: number
  mobileMargin?: number
  tabletMargin?: number
  desktopMargin?: number
}

export const ResponsiveSpacing = React.forwardRef<HTMLDivElement, ResponsiveSpacingProps>(
  ({ 
    children, 
    className,
    mobilePadding = 2,
    tabletPadding = 4,
    desktopPadding = 6,
    mobileMargin = 2,
    tabletMargin = 4,
    desktopMargin = 6
  }, ref) => {
    const { isMobile, isTablet } = useResponsive()

    const getPadding = () => {
      if (isMobile) return mobilePadding
      if (isTablet) return tabletPadding
      return desktopPadding
    }

    const getMargin = () => {
      if (isMobile) return mobileMargin
      if (isTablet) return tabletMargin
      return desktopMargin
    }

    const spacingClassName = cn(
      `p-${getPadding()}`,
      `m-${getMargin()}`,
      className
    )

    return (
      <div ref={ref} className={spacingClassName}>
        {children}
      </div>
    )
  }
)
ResponsiveSpacing.displayName = "ResponsiveSpacing"

// Hook for responsive values
export const useResponsiveValue = <T,>(
  mobileValue: T,
  tabletValue: T,
  desktopValue: T
): T => {
  const { isMobile, isTablet } = useResponsive()

  if (isMobile) return mobileValue
  if (isTablet) return tabletValue
  return desktopValue
}

// Responsive show/hide component
export interface ResponsiveShowProps {
  children: React.ReactNode
  on?: "mobile" | "tablet" | "desktop" | "mobile-tablet" | "tablet-desktop"
  className?: string
}

export const ResponsiveShow = React.forwardRef<HTMLDivElement, ResponsiveShowProps>(
  ({ children, on = "desktop", className }, ref) => {
    const { isMobile, isTablet, isDesktop } = useResponsive()

    const shouldShow = () => {
      switch (on) {
        case "mobile":
          return isMobile
        case "tablet":
          return isTablet
        case "desktop":
          return isDesktop
        case "mobile-tablet":
          return isMobile || isTablet
        case "tablet-desktop":
          return isTablet || isDesktop
        default:
          return true
      }
    }

    if (!shouldShow()) return null

    return (
      <div ref={ref} className={className}>
        {children}
      </div>
    )
  }
)
ResponsiveShow.displayName = "ResponsiveShow"

// Responsive hide component
export interface ResponsiveHideProps {
  children: React.ReactNode
  on?: "mobile" | "tablet" | "desktop" | "mobile-tablet" | "tablet-desktop"
  className?: string
}

export const ResponsiveHide = React.forwardRef<HTMLDivElement, ResponsiveHideProps>(
  ({ children, on = "mobile", className }, ref) => {
    const { isMobile, isTablet, isDesktop } = useResponsive()

    const shouldHide = () => {
      switch (on) {
        case "mobile":
          return isMobile
        case "tablet":
          return isTablet
        case "desktop":
          return isDesktop
        case "mobile-tablet":
          return isMobile || isTablet
        case "tablet-desktop":
          return isTablet || isDesktop
        default:
          return false
      }
    }

    if (shouldHide()) return null

    return (
      <div ref={ref} className={className}>
        {children}
      </div>
    )
  }
)
ResponsiveHide.displayName = "ResponsiveHide"

