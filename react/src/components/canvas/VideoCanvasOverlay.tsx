import React, { useState, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react'
import { CanvasVideoElement } from './VideoElement'
import { useCanvas } from '@/contexts/canvas'
import { cn } from '@/lib/utils'
import { eventBus } from '@/lib/event'
import * as ISocket from '@/types/socket'

interface VideoElement {
  id: string
  src: string
  x: number
  y: number
  width: number
  height: number
  duration?: number
  canvasId: string
}

interface VideoCanvasOverlayProps {
  canvasId: string
  className?: string
}

export interface VideoCanvasOverlayRef {
  addVideo: (videoData: ISocket.SessionVideoGeneratedEvent) => void
}

export const VideoCanvasOverlay = forwardRef<VideoCanvasOverlayRef, VideoCanvasOverlayProps>(({
  canvasId,
  className
}, ref) => {
  const [videoElements, setVideoElements] = useState<VideoElement[]>([])
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null)
  const { excalidrawAPI } = useCanvas()

  // Get canvas transform for positioning videos correctly
  const getCanvasTransform = useCallback(() => {
    if (!excalidrawAPI) return { zoom: 1, scrollX: 0, scrollY: 0 }
    
    const appState = excalidrawAPI.getAppState()
    return {
      zoom: appState.zoom?.value || 1,
      scrollX: appState.scrollX || 0,
      scrollY: appState.scrollY || 0
    }
  }, [excalidrawAPI])

  // Add a new video element
  const addVideoElement = useCallback((videoData: ISocket.SessionVideoGeneratedEvent) => {
    console.log('👇 Adding video to canvas:', videoData)
    
    const newVideo: VideoElement = {
      id: videoData.element.id || `video_${Date.now()}`,
      src: videoData.video_url || videoData.file.dataURL,
      x: videoData.element.x || 100,
      y: videoData.element.y || 100,
      width: videoData.element.width || 320,
      height: videoData.element.height || 180,
      duration: videoData.file.duration,
      canvasId
    }

    setVideoElements(prev => [...prev, newVideo])
  }, [canvasId])

  // Handle video generated event
  const handleVideoGenerated = useCallback(
    (videoData: ISocket.SessionVideoGeneratedEvent) => {
      console.log('👇 video_generated', videoData)
      if (videoData.canvas_id !== canvasId) {
        return
      }
      addVideoElement(videoData)
    },
    [addVideoElement, canvasId]
  )

  // Expose addVideo method via ref
  useImperativeHandle(ref, () => ({
    addVideo: addVideoElement
  }), [addVideoElement])

  // Load existing videos from canvas data on mount
  useEffect(() => {
    const loadExistingVideos = async () => {
      try {
        const url = `/api/canvas/${canvasId}?t=${Date.now()}`
        console.log('👇 Fetching canvas data from:', url)
        const response = await fetch(url)
        if (response.ok) {
          const canvasData = await response.json()
          console.log('👇 Received canvas data:', canvasData)
          const elements = canvasData.data?.elements || []
          const files = canvasData.data?.files || {}
          
          console.log('👇 Canvas elements:', elements.length)
          console.log('👇 All elements:', elements.map(e => ({type: e.type, id: e.id})))
          
          // Find video elements
          const videoElements = elements.filter((e: any) => e.type === 'video')
          console.log('👇 Loading existing videos:', videoElements.length)
          console.log('👇 Video elements found:', videoElements)
          
          const videos = videoElements.map((element: any) => {
            const file = files[element.fileId]
            return {
              id: element.id,
              src: file?.dataURL || `/api/file/${element.fileId}.mp4`,
              x: element.x,
              y: element.y,
              width: element.width,
              height: element.height,
              duration: element.duration || file?.duration,
              canvasId
            }
          })
          
          if (videos.length > 0) {
            console.log('👇 Setting existing videos:', videos)
            setVideoElements(videos)
          } else {
            console.log('👇 No videos found to load')
          }
        }
      } catch (error) {
        console.error('Failed to load existing videos:', error)
      }
    }
    
    loadExistingVideos()
  }, [canvasId])

  // Listen for video generated events
  useEffect(() => {
    eventBus.on('Socket::Session::VideoGenerated', handleVideoGenerated)
    return () =>
      eventBus.off('Socket::Session::VideoGenerated', handleVideoGenerated)
  }, [handleVideoGenerated])

  // Remove video element
  const removeVideoElement = useCallback((videoId: string) => {
    setVideoElements(prev => prev.filter(video => video.id !== videoId))
    if (selectedVideoId === videoId) {
      setSelectedVideoId(null)
    }
  }, [selectedVideoId])

  // Handle video selection
  const handleVideoSelect = useCallback((videoId: string) => {
    setSelectedVideoId(videoId)
  }, [])

  // Handle video deselection when clicking outside
  const handleCanvasClick = useCallback((event: React.MouseEvent) => {
    // Only deselect if clicking on the overlay itself, not on a video
    if (event.target === event.currentTarget) {
      setSelectedVideoId(null)
    }
  }, [])

  // Transform video positions based on canvas zoom and scroll
  const transformedVideos = videoElements.map(video => {
    const { zoom, scrollX, scrollY } = getCanvasTransform()
    
    // Ensure we have valid numbers and reasonable bounds
    const safeZoom = Math.max(0.1, Math.min(5, zoom || 1))
    const safeScrollX = scrollX || 0
    const safeScrollY = scrollY || 0
    const safeX = video.x || 0
    const safeY = video.y || 0
    const safeWidth = video.width || 320
    const safeHeight = video.height || 180
    
    // Calculate transformed size with minimum size constraints
    const baseTransformedWidth = safeWidth * safeZoom
    const baseTransformedHeight = safeHeight * safeZoom
    
    // Ensure minimum visible size (especially when zoomed out)
    const minWidth = 200  // Minimum 200px width
    const minHeight = 112 // Maintain 16:9 aspect ratio
    
    const transformed = {
      ...video,
      transformedX: (safeX + safeScrollX) * safeZoom,
      transformedY: (safeY + safeScrollY) * safeZoom,
      transformedWidth: Math.max(minWidth, baseTransformedWidth),
      transformedHeight: Math.max(minHeight, baseTransformedHeight)
    }
    
    console.log('👇 Video transform:', {
      original: { x: safeX, y: safeY, w: safeWidth, h: safeHeight },
      canvas: { zoom: safeZoom, scrollX: safeScrollX, scrollY: safeScrollY },
      transformed: { x: transformed.transformedX, y: transformed.transformedY, w: transformed.transformedWidth, h: transformed.transformedHeight }
    })
    
    // Ensure transformed values are reasonable (not NaN or extremely large)
    if (isNaN(transformed.transformedX) || isNaN(transformed.transformedY) || 
        Math.abs(transformed.transformedX) > 10000 || Math.abs(transformed.transformedY) > 10000) {
      console.warn('👇 Invalid transform detected, using fallback positioning')
      return {
        ...video,
        transformedX: safeX,
        transformedY: safeY,
        transformedWidth: safeWidth,
        transformedHeight: safeHeight
      }
    }
    
    return transformed
  })

  // Debug log when rendering
  if (videoElements.length > 0) {
    console.log('👇 Rendering videos:', videoElements.length, 'transformed:', transformedVideos.length)
  }

  return (
    <div 
      className={cn(
        'absolute inset-0 pointer-events-none',
        className
      )}
      onClick={handleCanvasClick}
    >
      {transformedVideos.map(video => (
        <div
          key={video.id}
          className="absolute pointer-events-auto"
          style={{
            left: Math.max(0, video.transformedX),
            top: Math.max(0, video.transformedY),
            width: video.transformedWidth,
            height: video.transformedHeight,
            zIndex: selectedVideoId === video.id ? 1000 : 999,
            border: selectedVideoId === video.id ? '3px solid #007bff' : '2px solid rgba(0, 255, 0, 0.7)',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            background: 'rgba(0, 0, 0, 0.05)'
          }}
        >
          <CanvasVideoElement
            elementId={video.id}
            src={video.src}
            x={0}
            y={0}
            width={video.transformedWidth}
            height={video.transformedHeight}
            duration={video.duration}
            isSelected={selectedVideoId === video.id}
            onSelect={() => handleVideoSelect(video.id)}
          />
          
          {/* Delete button when selected */}
          {selectedVideoId === video.id && (
            <button
              className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full text-xs hover:bg-red-600 transition-colors"
              onClick={(e) => {
                e.stopPropagation()
                removeVideoElement(video.id)
              }}
              title="Delete video"
            >
              ×
            </button>
          )}
        </div>
      ))}
    </div>
  )
})

VideoCanvasOverlay.displayName = 'VideoCanvasOverlay'

export default VideoCanvasOverlay

// Export types for use in parent components
export type { VideoElement, VideoCanvasOverlayRef }