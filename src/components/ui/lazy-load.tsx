import React, { Suspense } from 'react'
import { Loader2 } from 'lucide-react'

interface LazyLoadProps {
  fallback?: React.ReactNode
  className?: string
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

// Simple wrapper component for lazy loading
export function LazyLoad({ children, fallback, className }: LazyLoadProps) {
  return (
    <Suspense fallback={fallback || <DefaultFallback className={className} />}>
      {children}
    </Suspense>
  )
}

// Pre-built lazy components for common use cases
export const LazyTable = ({ children, fallback }: LazyLoadProps) => (
  <LazyLoad fallback={fallback || <DefaultFallback />}>
    {children}
  </LazyLoad>
)

export const LazyModal = ({ children, fallback }: LazyLoadProps) => (
  <LazyLoad fallback={fallback || <DefaultFallback className="min-h-[200px]" />}>
    {children}
  </LazyLoad>
)

export const LazyChart = ({ children, fallback }: LazyLoadProps) => (
  <LazyLoad fallback={fallback || <DefaultFallback className="min-h-[300px]" />}>
    {children}
  </LazyLoad>
)

// Intersection Observer based lazy loading for performance
interface IntersectionLazyLoadProps extends LazyLoadProps {
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