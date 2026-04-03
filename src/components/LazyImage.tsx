import { useState, useEffect, useRef, useCallback } from 'react'
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
  fadeInDuration?: number
  rootMargin?: string
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
  objectFit = 'cover',
  fadeInDuration = 300,
  rootMargin = '100px'
}: LazyImageProps) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [isInView, setIsInView] = useState(priority)
  const [error, setError] = useState(false)
  const [currentSrc, setCurrentSrc] = useState(thumbnail || src)
  const [thumbnailLoaded, setThumbnailLoaded] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const fullImageRef = useRef<HTMLImageElement | null>(null)

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
        rootMargin,
        threshold: 0.01
      }
    )

    if (containerRef.current) {
      observer.observe(containerRef.current)
    }

    return () => {
      observer.disconnect()
    }
  }, [priority, rootMargin])

  useEffect(() => {
    if (!isInView) return
    if (!thumbnail) return
    if (currentSrc !== thumbnail) return

    const fullImg = new Image()
    fullImageRef.current = fullImg
    
    fullImg.decoding = 'async'
    fullImg.src = src
    
    fullImg.onload = () => {
      requestAnimationFrame(() => {
        setCurrentSrc(src)
        setIsLoaded(true)
      })
    }
    
    fullImg.onerror = () => {
      setError(true)
      onError?.()
    }

    return () => {
      if (fullImageRef.current) {
        fullImageRef.current.onload = null
        fullImageRef.current.onerror = null
      }
    }
  }, [isInView, src, thumbnail, currentSrc, onError])

  const handleLoad = useCallback(() => {
    if (currentSrc === thumbnail) {
      setThumbnailLoaded(true)
    } else {
      setIsLoaded(true)
    }
    onLoad?.()
  }, [currentSrc, thumbnail, onLoad])

  const handleError = useCallback(() => {
    setError(true)
    onError?.()
  }, [onError])

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

  const showThumbnailBlur = thumbnail && currentSrc === thumbnail && thumbnailLoaded && !isLoaded

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative overflow-hidden bg-s1',
        aspectRatioClasses[aspectRatio],
        containerClassName
      )}
    >
      {!thumbnailLoaded && !isLoaded && !error && (
        <Skeleton className="absolute inset-0 w-full h-full" />
      )}
      
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-s1 text-t3">
          <div className="text-center p-4">
            <svg
              className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-2 opacity-40"
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
            <p className="text-xs opacity-60">Failed to load</p>
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
          fetchPriority={priority ? 'high' : 'auto'}
          onLoad={handleLoad}
          onError={handleError}
          style={{
            transitionDuration: `${fadeInDuration}ms`
          }}
          className={cn(
            'w-full h-full transition-all ease-out',
            objectFitClasses[objectFit],
            (thumbnailLoaded || isLoaded) ? 'opacity-100' : 'opacity-0',
            showThumbnailBlur ? 'blur-[2px] scale-[1.02]' : 'blur-0 scale-100',
            className
          )}
        />
      )}
    </div>
  )
}
