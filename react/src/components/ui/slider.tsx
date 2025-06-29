import React, { useRef, useState, useCallback } from 'react'
import { cn } from '@/lib/utils'

interface SliderProps {
    value: number[]
    onValueChange: (value: number[]) => void
    max?: number
    min?: number
    step?: number
    disabled?: boolean
    className?: string
}

export const Slider: React.FC<SliderProps> = ({
    value,
    onValueChange,
    max = 100,
    min = 0,
    step = 1,
    disabled = false,
    className,
}) => {
    const sliderRef = useRef<HTMLDivElement>(null)
    const [isDragging, setIsDragging] = useState(false)

    const getValueFromPosition = useCallback((clientX: number) => {
        if (!sliderRef.current) return value[0]

        const rect = sliderRef.current.getBoundingClientRect()
        const percentage = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
        const rawValue = min + percentage * (max - min)

        // Snap to step
        const steppedValue = Math.round(rawValue / step) * step
        return Math.max(min, Math.min(max, steppedValue))
    }, [min, max, step, value])

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (disabled) return

        setIsDragging(true)
        const newValue = getValueFromPosition(e.clientX)
        onValueChange([newValue])
    }, [disabled, getValueFromPosition, onValueChange])

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isDragging || disabled) return

        const newValue = getValueFromPosition(e.clientX)
        onValueChange([newValue])
    }, [isDragging, disabled, getValueFromPosition, onValueChange])

    const handleMouseUp = useCallback(() => {
        setIsDragging(false)
    }, [])

    React.useEffect(() => {
        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove)
            document.addEventListener('mouseup', handleMouseUp)

            return () => {
                document.removeEventListener('mousemove', handleMouseMove)
                document.removeEventListener('mouseup', handleMouseUp)
            }
        }
    }, [isDragging, handleMouseMove, handleMouseUp])

    const percentage = ((value[0] - min) / (max - min)) * 100

    return (
        <div
            ref={sliderRef}
            className={cn(
                'relative flex items-center w-full h-5 cursor-pointer',
                disabled && 'cursor-not-allowed opacity-50',
                className
            )}
            onMouseDown={handleMouseDown}
        >
            {/* Track */}
            <div className="relative w-full h-1 bg-gray-300 rounded-full">
                {/* Filled track */}
                <div
                    className="absolute h-full bg-blue-500 rounded-full"
                    style={{ width: `${percentage}%` }}
                />
                {/* Thumb */}
                <div
                    className="absolute w-4 h-4 bg-white border-2 border-blue-500 rounded-full shadow-md transform -translate-y-1/2 -translate-x-1/2 transition-transform hover:scale-110"
                    style={{ left: `${percentage}%`, top: '50%' }}
                />
            </div>
        </div>
    )
}