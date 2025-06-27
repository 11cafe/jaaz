import React, { useState } from 'react'
import { VideoPlayer, VideoPreview } from '@/components/ui/video-player'
import { cn } from '@/lib/utils'

interface VideoElementProps {
  src: string
  poster?: string
  duration?: number
  autoPlay?: boolean
  loop?: boolean
  muted?: boolean
  className?: string
  width?: number
  height?: number
  isPreview?: boolean
  onClick?: () => void
  onTimeUpdate?: (currentTime: number, duration: number) => void
  onEnded?: () => void
}

export const VideoElement: React.FC<VideoElementProps> = ({
  src,
  poster,
  duration,
  autoPlay = false,
  loop = false,
  muted = true, // Default muted for canvas elements
  className,
  width = 320,
  height = 180,
  isPreview = false,
  onClick,
  onTimeUpdate,
  onEnded,
}) => {
  const [isPlaying, setIsPlaying] = useState(false)
  const [showFullPlayer, setShowFullPlayer] = useState(false)

  // For canvas preview mode
  if (isPreview) {
    return (
      <VideoPreview
        src={src}
        poster={poster}
        className={className}
        width={width}
        height={height}
        onClick={() => {
          onClick?.()
          setShowFullPlayer(true)
        }}
      />
    )
  }

  // Full video player
  return (
    <div className={cn('relative', className)}>
      <VideoPlayer
        src={src}
        poster={poster}
        autoPlay={autoPlay}
        loop={loop}
        muted={muted}
        width={width}
        height={height}
        onTimeUpdate={onTimeUpdate}
        onEnded={() => {
          setIsPlaying(false)
          onEnded?.()
        }}
      />
      
      {/* Video info overlay */}
      {duration && (
        <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
          {duration}s
        </div>
      )}
    </div>
  )
}

// Canvas-specific video component that integrates with Excalidraw elements
export const CanvasVideoElement: React.FC<{
  elementId: string
  src: string
  x: number
  y: number
  width: number
  height: number
  duration?: number
  isSelected?: boolean
  onSelect?: () => void
}> = ({
  elementId,
  src,
  x,
  y,
  width,
  height,
  duration,
  isSelected = false,
  onSelect,
}) => {
  return (
    <div
      className={cn(
        'absolute cursor-pointer transition-all',
        isSelected && 'ring-2 ring-blue-500 ring-offset-2'
      )}
      style={{
        left: x,
        top: y,
        width: width,
        height: height,
      }}
      onClick={onSelect}
    >
      <VideoElement
        src={src}
        width={width}
        height={height}
        duration={duration}
        isPreview={false}
        muted={true}
        autoPlay={false}
        onClick={onSelect}
      />
    </div>
  )
}

export default VideoElement