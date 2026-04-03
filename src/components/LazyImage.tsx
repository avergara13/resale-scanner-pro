import { useState, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

interface LazyImageProps {
  src: string
  thumbnail?: string
  alt: string
  className?: string
  containerClassName?: string
  aspectRatio?: 'square' | 'portrait' | 'landscape' | 'auto'
  onLoad?: () => void
  onError?: () => void
  priority?: boolean
  objectFit?: 'cover' | 'contain' | 'fill' | 'none'
}

export function LazyImage({
  src,
  thumbnail,
  alt,
  className,
  containerClassName,
  aspectRatio = 'auto',
  onLoad,
  onError,
  priority = false,
  objectFit = 'cover'
}: LazyImageProps) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [isInView, setIsInView] = useState(priority)
  const [error, setError] = useState(false)
  const [currentSrc, setCurrentSrc] = useState(thumbnail || src)
  const imgRef = useRef<HTMLImageElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (priority) {
      setIsInView(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true)
          observer.disconnect()
        }
      },
      {
        rootMargin: '50px',
        threshold: 0.01
      }
    )

    if (containerRef.current) {
      observer.observe(containerRef.current)
    }

    return () => {
      observer.disconnect()
    }
  }, [priority])

  useEffect(() => {
    if (!isInView) return

    if (thumbnail && currentSrc === thumbnail) {
      const fullImg = new Image()
      fullImg.src = src
      fullImg.onload = () => {
        setCurrentSrc(src)
      }
      fullImg.onerror = () => {
        setError(true)
        onError?.()
      }
    }
  }, [isInView, src, thumbnail, currentSrc, onError])

  const handleLoad = () => {
    setIsLoaded(true)
    onLoad?.()
  }

  const handleError = () => {
    setError(true)
    onError?.()
  }

  const aspectRatioClasses = {
    square: 'aspect-square',
    portrait: 'aspect-[3/4]',
    landscape: 'aspect-[4/3]',
    auto: ''
  }

  const objectFitClasses = {
    cover: 'object-cover',
    contain: 'object-contain',
    fill: 'object-fill',
    none: 'object-none'
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative overflow-hidden bg-s1',
        aspectRatioClasses[aspectRatio],
        containerClassName
      )}
    >
      {!isLoaded && !error && (
        <Skeleton className="absolute inset-0 w-full h-full" />
      )}
      
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-s1 text-t3">
          <div className="text-center p-4">
            <svg
              className="w-12 h-12 mx-auto mb-2 opacity-50"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <p className="text-xs">Failed to load</p>
          </div>
        </div>
      )}
      
      {isInView && !error && (
        <img
          ref={imgRef}
          src={currentSrc}
          alt={alt}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          onLoad={handleLoad}
          onError={handleError}
          className={cn(
            'w-full h-full transition-opacity duration-300',
            objectFitClasses[objectFit],
            isLoaded ? 'opacity-100' : 'opacity-0',
            currentSrc === thumbnail && isLoaded ? 'blur-sm scale-105' : '',
            className
          )}
        />
      )}
    </div>
  )
}
