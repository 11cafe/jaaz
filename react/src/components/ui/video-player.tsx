import React, { useRef, useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Play, Pause, Volume2, VolumeX, Maximize2, RotateCcw } from 'lucide-react'

interface VideoPlayerProps {
    src: string
    poster?: string
    autoPlay?: boolean
    loop?: boolean
    muted?: boolean
    controls?: boolean
    className?: string
    width?: number
    height?: number
    onEnded?: () => void
    onTimeUpdate?: (currentTime: number, duration: number) => void
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
    src,
    poster,
    autoPlay = false,
    loop = false,
    muted = false,
    controls = true,
    className,
    width,
    height,
    onEnded,
    onTimeUpdate,
}) => {
    const videoRef = useRef<HTMLVideoElement>(null)
    const [isPlaying, setIsPlaying] = useState(false)
    const [currentTime, setCurrentTime] = useState(0)
    const [duration, setDuration] = useState(0)
    const [volume, setVolume] = useState(1)
    const [isMuted, setIsMuted] = useState(muted)
    const [isFullscreen, setIsFullscreen] = useState(false)

    useEffect(() => {
        const video = videoRef.current
        if (!video) return

        const handleTimeUpdate = () => {
            const current = video.currentTime
            const total = video.duration
            setCurrentTime(current)
            onTimeUpdate?.(current, total)
        }

        const handleLoadedMetadata = () => {
            setDuration(video.duration)
        }

        const handleEnded = () => {
            setIsPlaying(false)
            onEnded?.()
        }

        const handlePlay = () => setIsPlaying(true)
        const handlePause = () => setIsPlaying(false)

        video.addEventListener('timeupdate', handleTimeUpdate)
        video.addEventListener('loadedmetadata', handleLoadedMetadata)
        video.addEventListener('ended', handleEnded)
        video.addEventListener('play', handlePlay)
        video.addEventListener('pause', handlePause)

        return () => {
            video.removeEventListener('timeupdate', handleTimeUpdate)
            video.removeEventListener('loadedmetadata', handleLoadedMetadata)
            video.removeEventListener('ended', handleEnded)
            video.removeEventListener('play', handlePlay)
            video.removeEventListener('pause', handlePause)
        }
    }, [onTimeUpdate, onEnded])

    const togglePlay = () => {
        const video = videoRef.current
        if (!video) return

        if (isPlaying) {
            video.pause()
        } else {
            video.play()
        }
    }

    const handleSeek = (values: number[]) => {
        const video = videoRef.current
        if (!video) return

        const newTime = values[0]
        video.currentTime = newTime
        setCurrentTime(newTime)
    }

    const handleVolumeChange = (values: number[]) => {
        const video = videoRef.current
        if (!video) return

        const newVolume = values[0]
        video.volume = newVolume
        setVolume(newVolume)
        setIsMuted(newVolume === 0)
    }

    const toggleMute = () => {
        const video = videoRef.current
        if (!video) return

        if (isMuted) {
            video.volume = volume
            setIsMuted(false)
        } else {
            video.volume = 0
            setIsMuted(true)
        }
    }

    const toggleFullscreen = () => {
        const video = videoRef.current
        if (!video) return

        if (!isFullscreen) {
            if (video.requestFullscreen) {
                video.requestFullscreen()
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen()
            }
        }
        setIsFullscreen(!isFullscreen)
    }

    const restart = () => {
        const video = videoRef.current
        if (!video) return

        video.currentTime = 0
        setCurrentTime(0)
    }

    const formatTime = (time: number) => {
        const minutes = Math.floor(time / 60)
        const seconds = Math.floor(time % 60)
        return `${minutes}:${seconds.toString().padStart(2, '0')}`
    }

    return (
        <div className={cn('relative group bg-black overflow-hidden', className)}>
            <video
                ref={videoRef}
                src={src}
                poster={poster}
                autoPlay={autoPlay}
                loop={loop}
                muted={muted}
                className="w-full h-full object-cover"
                style={{ width, height }}
                playsInline
            />

            {controls && (
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    {/* Play/Pause overlay */}
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Button
                            variant="ghost"
                            size="lg"
                            onClick={togglePlay}
                            className="bg-black/20 hover:bg-black/40 text-white rounded-full p-4"
                        >
                            {isPlaying ? (
                                <Pause className="w-8 h-8" />
                            ) : (
                                <Play className="w-8 h-8 ml-1" />
                            )}
                        </Button>
                    </div>

                    {/* Controls bar */}
                    <div className="absolute bottom-0 left-0 right-0 p-4 space-y-2">

                        {/* Control buttons */}
                        <div className="flex items-center justify-between text-white">
                            <div className="flex items-center space-x-2">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={togglePlay}
                                    className="text-white hover:bg-white/20"
                                >
                                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                                </Button>

                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={restart}
                                    className="text-white hover:bg-white/20"
                                >
                                    <RotateCcw className="w-4 h-4" />
                                </Button>

                                <div className="flex items-center space-x-2">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={toggleMute}
                                        className="text-white hover:bg-white/20"
                                    >
                                        {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                                    </Button>
                                </div>

                                <span className="text-sm">
                                    {formatTime(currentTime)} / {formatTime(duration)}
                                </span>
                            </div>

                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={toggleFullscreen}
                                className="text-white hover:bg-white/20"
                            >
                                <Maximize2 className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

// Lightweight video preview component for thumbnails
export const VideoPreview: React.FC<{
    src: string
    poster?: string
    className?: string
    width?: number
    height?: number
    onClick?: () => void
}> = ({ src, poster, className, width, height, onClick }) => {
    return (
        <div
            className={cn(
                'relative bg-black overflow-hidden cursor-pointer group hover:ring-2 hover:ring-blue-500',
                className
            )}
            onClick={onClick}
        >
            <video
                src={src}
                poster={poster}
                className="w-full h-full object-cover"
                style={{ width, height }}
                muted
                preload="metadata"
            />
            <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Play className="w-8 h-8 text-white" />
            </div>
            <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                Video
            </div>
        </div>
    )
}
