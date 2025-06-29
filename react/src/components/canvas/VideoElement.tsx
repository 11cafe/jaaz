import React, { useState, useRef, useEffect } from 'react'
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
    const [isPaused, setIsPaused] = useState(false) // 跟踪是否被用户暂停
    const [isHovered, setIsHovered] = useState(false) // 跟踪鼠标悬停状态
    const videoRef = useRef<HTMLVideoElement>(null)

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

    // 处理鼠标悬停事件
    const handleMouseEnter = () => {
        setIsHovered(true)
        const video = videoRef.current
        if (video && !isPaused) {
            video.play()
            setIsPlaying(true)
        }
    }

    // 处理鼠标移出事件
    const handleMouseLeave = () => {
        setIsHovered(false)
        const video = videoRef.current
        if (video && !isPaused) {
            video.pause()
            video.currentTime = 0 // 重置到开始
            setIsPlaying(false)
        }
    }

    // 处理点击事件
    const handleClick = () => {
        const video = videoRef.current
        if (!video) return

        if (isPlaying) {
            video.pause()
            setIsPlaying(false)
            setIsPaused(true)
        } else {
            video.play()
            setIsPlaying(true)
            setIsPaused(false)
        }
        onClick?.()
    }

    // 监听视频结束事件
    useEffect(() => {
        const video = videoRef.current
        if (!video) return

        const handleEnded = () => {
            setIsPlaying(false)
            setIsPaused(false)
            // 如果鼠标还在悬停，重新播放
            if (isHovered) {
                video.currentTime = 0
                video.play()
                setIsPlaying(true)
            }
            onEnded?.()
        }

        const handleTimeUpdate = () => {
            if (onTimeUpdate && video.duration) {
                onTimeUpdate(video.currentTime, video.duration)
            }
        }

        video.addEventListener('ended', handleEnded)
        video.addEventListener('timeupdate', handleTimeUpdate)

        return () => {
            video.removeEventListener('ended', handleEnded)
            video.removeEventListener('timeupdate', handleTimeUpdate)
        }
    }, [isHovered, onEnded, onTimeUpdate])

    // Full video player
    return (
        <div
            className={cn('relative cursor-default', className)}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onClick={handleClick}
        >
            <video
                ref={videoRef}
                src={src}
                poster={poster}
                loop={loop}
                muted={muted}
                className="w-full h-full object-cover cursor-default"
                style={{ width, height, pointerEvents: 'none' }}
                playsInline
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
    onSelect?: (e?: React.MouseEvent) => void
    onDelete?: () => void
    onResize?: (direction: string, e: React.MouseEvent) => void
    onPaste?: (videoData: any) => void
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
    onDelete,
    onResize,
    onPaste,

}) => {
        // Focus the element when selected to ensure keyboard events work
        useEffect(() => {
            if (isSelected) {
                // Small delay to ensure the element is rendered
                setTimeout(() => {
                    const element = document.querySelector(`[data-video-id="${elementId}"]`) as HTMLElement
                    if (element) {
                        element.focus()
                    }
                }, 10)
            }
        }, [isSelected, elementId])

        return (
            <div
                className={cn(
                    'relative w-full h-full cursor-pointer transition-all',
                    isSelected && 'ring-2 ring-blue-500'
                )}
                tabIndex={0}
                data-video-id={elementId}
                onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    console.log('🎯 CanvasVideoElement div clicked')

                    // 获取元素的绝对坐标和尺寸信息
                    const rect = e.currentTarget.getBoundingClientRect()
                    const elementInfo = {
                        elementId,
                        absolutePosition: {
                            x: rect.left,
                            y: rect.top,
                            right: rect.right,
                            bottom: rect.bottom
                        },
                        dimensions: {
                            width: rect.width,
                            height: rect.height
                        },
                    }

                    console.log('📍 Element position and size info:', elementInfo)


                }}
                onKeyDown={(e) => {
                    if (!isSelected) return

                    // Delete functionality
                    if (e.key === 'Delete' && onDelete) {
                        e.preventDefault()
                        e.stopPropagation()
                        console.log('🗑️ Delete key pressed on video element')
                        onDelete()
                    }

                    // TODO: Copy/Paste functionality disabled due to coordinate system confusion
                    // The current implementation mixes screen coordinates with canvas coordinates,
                    // causing incorrect positioning when pasting videos. Need to fix coordinate
                    // transformation between screen space and canvas space before re-enabling.

                    // Copy functionality (Ctrl+C) - DISABLED
                    // if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
                    //     e.preventDefault()
                    //     e.stopPropagation()

                    //     // 获取当前元素的位置和尺寸信息
                    //     const rect = e.currentTarget.getBoundingClientRect()
                    //     const elementInfo = {
                    //         elementId,
                    //         absolutePosition: {
                    //             x: rect.left,
                    //             y: rect.top,
                    //             right: rect.right,
                    //             bottom: rect.bottom
                    //         },
                    //         dimensions: {
                    //             width: rect.width,
                    //             height: rect.height
                    //         },
                    //     }

                    //     const videoData = {
                    //         type: 'video-element',
                    //         elementId,
                    //         src,
                    //         x: elementInfo.absolutePosition.x,
                    //         y: elementInfo.absolutePosition.y,
                    //         width: elementInfo.dimensions.width,
                    //         height: elementInfo.dimensions.height,
                    //         duration
                    //     }
                    //     navigator.clipboard.writeText(JSON.stringify(videoData))
                    //     console.log('📋 Video element copied to clipboard', videoData)
                    // }

                    // Paste functionality (Ctrl+V) - DISABLED
                    // if ((e.ctrlKey || e.metaKey) && e.key === 'v' && onPaste) {
                    //     e.preventDefault()
                    //     e.stopPropagation()
                    //     navigator.clipboard.readText().then(text => {
                    //         try {
                    //             const videoData = JSON.parse(text)
                    //             if (videoData.type === 'video-element') {
                    //                 console.log('📋 Pasting video element from clipboard')
                    //                 onPaste(videoData)
                    //             }
                    //         } catch (error) {
                    //             console.log('📋 Clipboard does not contain valid video data')
                    //         }
                    //     }).catch(error => {
                    //         console.error('📋 Failed to read clipboard:', error)
                    //     })
                    // }
                }}
            >
                <VideoElement
                    src={src}
                    width={width}
                    height={height}
                    duration={duration}
                    isPreview={false}
                    muted={true}
                    autoPlay={false}
                    onClick={(e) => {
                        console.log('🎬 VideoElement clicked')
                        // Don't call onSelect again - already handled by parent div
                    }}
                />

                {/* Selection border and resize handles */}
                {isSelected && (
                    <>
                        {/* Four corner resize handles */}
                        <div
                            className="absolute -top-1 -left-1 w-3 h-3 bg-blue-500 border border-white rounded-sm cursor-nw-resize z-20"
                            onMouseDown={(e) => {
                                e.stopPropagation()
                                onResize?.('nw', e)
                            }}
                            title="Resize"
                        />
                        <div
                            className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 border border-white rounded-sm cursor-ne-resize z-20"
                            onMouseDown={(e) => {
                                e.stopPropagation()
                                onResize?.('ne', e)
                            }}
                            title="Resize"
                        />
                        <div
                            className="absolute -bottom-1 -left-1 w-3 h-3 bg-blue-500 border border-white rounded-sm cursor-sw-resize z-20"
                            onMouseDown={(e) => {
                                e.stopPropagation()
                                onResize?.('sw', e)
                            }}
                            title="Resize"
                        />
                        <div
                            className="absolute -bottom-1 -right-1 w-3 h-3 bg-blue-500 border border-white rounded-sm cursor-se-resize z-20"
                            onMouseDown={(e) => {
                                e.stopPropagation()
                                onResize?.('se', e)
                            }}
                            title="Resize"
                        />


                    </>
                )}
            </div>
        )
    }

export default VideoElement