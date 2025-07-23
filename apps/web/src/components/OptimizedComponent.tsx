// Optimized component wrapper for performance-aware rendering
import React, { memo, Suspense, lazy, useState, useEffect } from 'react';
import { 
  useLazyLoad, 
  usePerformanceAwareRendering, 
  useVisibilityOptimization,
  OptimizedComponentProps 
} from '../utils/componentOptimizer';
import { LoadingSpinner } from './ui/loading-spinner';

// Default fallback component
const DefaultFallback: React.FC = () => (
  <div className="flex items-center justify-center p-4">
    <LoadingSpinner size="sm" />
  </div>
);

// Optimized component wrapper
export const OptimizedComponent: React.FC<OptimizedComponentProps> = memo(({
  children,
  lazyLoad = false,
  priority = 'medium',
  fallback = <DefaultFallback />,
  className = '',
}) => {
  const { elementRef, shouldRender } = useLazyLoad(lazyLoad);
  const { isVisible } = useVisibilityOptimization();
  const { shouldReduceQuality, renderingLevel } = usePerformanceAwareRendering();

  // Don't render if lazy loading is enabled and component isn't visible yet
  if (lazyLoad && !shouldRender) {
    return (
      <div 
        ref={elementRef} 
        className={`${className} min-h-[100px]`}
        aria-label="Loading component..."
      >
        {fallback}
      </div>
    );
  }

  // Skip rendering if not visible and low priority
  if (priority === 'low' && !isVisible && shouldReduceQuality) {
    return (
      <div className={`${className} opacity-50`}>
        {fallback}
      </div>
    );
  }

  // Apply performance-based styling
  const optimizedClassName = `${className} ${
    renderingLevel === 'basic' ? 'performance-basic' :
    renderingLevel === 'reduced' ? 'performance-reduced' : ''
  }`;

  return (
    <div className={optimizedClassName}>
      {children}
    </div>
  );
});

OptimizedComponent.displayName = 'OptimizedComponent';

// Higher-order component for lazy loading
export const withLazyLoading = <P extends object>(
  Component: React.ComponentType<P>,
  fallback?: React.ReactNode
) => {
  const LazyComponent = lazy(() => Promise.resolve({ default: Component }));
  
  return memo((props: P) => (
    <Suspense fallback={fallback || <DefaultFallback />}>
      <LazyComponent {...props} />
    </Suspense>
  ));
};

// Higher-order component for performance optimization
export const withPerformanceOptimization = <P extends object>(
  Component: React.ComponentType<P>,
  options: {
    priority?: 'high' | 'medium' | 'low';
    lazyLoad?: boolean;
    fallback?: React.ReactNode;
  } = {}
) => {
  return memo((props: P) => (
    <OptimizedComponent
      priority={options.priority}
      lazyLoad={options.lazyLoad}
      fallback={options.fallback}
    >
      <Component {...props} />
    </OptimizedComponent>
  ));
};

// Virtualized list component for large datasets
interface VirtualizedListProps<T> {
  items: T[];
  itemHeight: number;
  containerHeight: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  className?: string;
  overscan?: number;
}

export const VirtualizedList = <T,>({
  items,
  itemHeight,
  containerHeight,
  renderItem,
  className = '',
  overscan = 5,
}: VirtualizedListProps<T>) => {
  const [scrollTop, setScrollTop] = useState(0);

  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    items.length - 1,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
  );

  const visibleItems = items.slice(startIndex, endIndex + 1);
  const totalHeight = items.length * itemHeight;
  const offsetY = startIndex * itemHeight;

  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(event.currentTarget.scrollTop);
  };

  return (
    <div
      className={`overflow-auto ${className}`}
      style={{ height: containerHeight }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleItems.map((item, index) => (
            <div
              key={startIndex + index}
              style={{ height: itemHeight }}
            >
              {renderItem(item, startIndex + index)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Performance-aware image component
interface OptimizedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  lowQualitySrc?: string;
  priority?: 'high' | 'medium' | 'low';
  lazy?: boolean;
}

export const OptimizedImage: React.FC<OptimizedImageProps> = memo(({
  src,
  alt,
  lowQualitySrc,
  priority = 'medium',
  lazy = true,
  className = '',
  ...props
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const { shouldReduceQuality } = usePerformanceAwareRendering();
  const { elementRef, shouldRender } = useLazyLoad(lazy);

  // Use low quality source if available and performance is reduced
  const imageSrc = shouldReduceQuality && lowQualitySrc ? lowQualitySrc : src;

  const handleLoad = () => {
    setIsLoaded(true);
    setHasError(false);
  };

  const handleError = () => {
    setHasError(true);
    setIsLoaded(false);
  };

  if (lazy && !shouldRender) {
    return (
      <div 
        ref={elementRef}
        className={`bg-gray-200 animate-pulse ${className}`}
        style={{ minHeight: '100px' }}
        aria-label={`Loading image: ${alt}`}
      />
    );
  }

  if (hasError) {
    return (
      <div className={`bg-gray-200 flex items-center justify-center ${className}`}>
        <span className="text-gray-500 text-sm">Failed to load image</span>
      </div>
    );
  }

  return (
    <img
      src={imageSrc}
      alt={alt}
      className={`transition-opacity duration-300 ${
        isLoaded ? 'opacity-100' : 'opacity-0'
      } ${className}`}
      onLoad={handleLoad}
      onError={handleError}
      loading={lazy ? 'lazy' : 'eager'}
      {...props}
    />
  );
});

OptimizedImage.displayName = 'OptimizedImage';

// Performance-aware animation wrapper
interface OptimizedAnimationProps {
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

export const OptimizedAnimation: React.FC<OptimizedAnimationProps> = memo(({
  children,
  className = '',
  disabled = false,
}) => {
  const { shouldSkipAnimations } = usePerformanceAwareRendering();

  const animationClass = shouldSkipAnimations || disabled 
    ? 'performance-no-animation' 
    : className;

  return (
    <div className={animationClass}>
      {children}
    </div>
  );
});

OptimizedAnimation.displayName = 'OptimizedAnimation';

// Memoized component factory
export const createMemoizedComponent = <P extends object>(
  Component: React.ComponentType<P>,
  areEqual?: (prevProps: P, nextProps: P) => boolean
) => {
  return memo(Component, areEqual);
};

// Performance monitoring wrapper
interface PerformanceMonitoredComponentProps {
  children: React.ReactNode;
  componentName: string;
  onRenderTime?: (time: number) => void;
}

export const PerformanceMonitoredComponent: React.FC<PerformanceMonitoredComponentProps> = memo(({
  children,
  componentName,
  onRenderTime,
}) => {
  useEffect(() => {
    const startTime = performance.now();
    
    return () => {
      const endTime = performance.now();
      const renderTime = endTime - startTime;
      
      if (onRenderTime) {
        onRenderTime(renderTime);
      }
      
      // Log slow renders in development
      if (import.meta.env.DEV && renderTime > 16) {
        console.warn(`Slow render detected in ${componentName}: ${renderTime.toFixed(2)}ms`);
      }
    };
  });

  return <>{children}</>;
});

PerformanceMonitoredComponent.displayName = 'PerformanceMonitoredComponent';