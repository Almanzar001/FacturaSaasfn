import React, { lazy, Suspense, ComponentType } from 'react'
import { Loader2 } from 'lucide-react'

interface LazyLoadProps {
  fallback?: React.ReactNode
  className?: string
}

interface LazyComponentProps extends LazyLoadProps {
  children: React.ReactNode
}

// Default loading spinner
const DefaultFallback = ({ className }: { className?: string }) => (
  <div className={`flex items-center justify-center p-8 ${className || ''}`}>
    <div className="flex flex-col items-center space-y-2">
      <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      <span className="text-sm text-muted-foreground">Cargando...</span>
    </div>
  </div>
)

// Higher-order component for lazy loading
export function withLazyLoading<P extends object>(
  Component: ComponentType<P>,
  fallback?: React.ReactNode
) {
  const LazyComponent = React.forwardRef<any, P>((props, ref) => (
    <Suspense fallback={fallback || <DefaultFallback />}>
      <Component {...props} ref={ref} />
    </Suspense>
  ))

  LazyComponent.displayName = `LazyLoaded(${Component.displayName || Component.name || 'Component'})`

  return LazyComponent
}

// Wrapper component for lazy loading
export function LazyLoad({ children, fallback, className }: LazyComponentProps) {
  return (
    <Suspense fallback={fallback || <DefaultFallback className={className} />}>
      {children}
    </Suspense>
  )
}

// Hook to create lazy components with custom fallback
export function useLazyComponent<P extends object>(
  componentImport: () => Promise<{ default: ComponentType<P> }>,
  fallback?: React.ReactNode
) {
  const LazyComponent = lazy(componentImport)
  
  return React.forwardRef<any, P>((props, ref) => (
    <LazyLoad fallback={fallback}>
      <LazyComponent {...props} ref={ref} />
    </LazyLoad>
  ))
}

// Pre-built lazy components for common use cases
export const LazyTable = ({ children, fallback }: LazyComponentProps) => (
  <LazyLoad fallback={fallback || <DefaultFallback />}>
    {children}
  </LazyLoad>
)

export const LazyModal = ({ children, fallback }: LazyComponentProps) => (
  <LazyLoad fallback={fallback || <DefaultFallback className="min-h-[200px]" />}>
    {children}
  </LazyLoad>
)

export const LazyChart = ({ children, fallback }: LazyComponentProps) => (
  <LazyLoad fallback={fallback || <DefaultFallback className="min-h-[300px]" />}>
    {children}
  </LazyLoad>
)

// Intersection Observer based lazy loading for performance
interface IntersectionLazyLoadProps extends LazyComponentProps {
  threshold?: number
  rootMargin?: string
  triggerOnce?: boolean
}

export function IntersectionLazyLoad({
  children,
  fallback,
  className,
  threshold = 0.1,
  rootMargin = '100px',
  triggerOnce = true
}: IntersectionLazyLoadProps) {
  const [isVisible, setIsVisible] = React.useState(false)
  const [hasTriggered, setHasTriggered] = React.useState(false)
  const elementRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const element = elementRef.current
    if (!element) return

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries
        if (entry.isIntersecting) {
          setIsVisible(true)
          if (triggerOnce) {
            setHasTriggered(true)
            observer.unobserve(element)
          }
        } else if (!triggerOnce) {
          setIsVisible(false)
        }
      },
      {
        threshold,
        rootMargin
      }
    )

    observer.observe(element)

    return () => {
      observer.unobserve(element)
    }
  }, [threshold, rootMargin, triggerOnce])

  const shouldRender = triggerOnce ? hasTriggered || isVisible : isVisible

  return (
    <div ref={elementRef} className={className}>
      {shouldRender ? (
        <LazyLoad fallback={fallback}>
          {children}
        </LazyLoad>
      ) : (
        fallback || <DefaultFallback />
      )}
    </div>
  )
}