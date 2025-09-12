import React, { useEffect } from 'react'
import { Zap, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useBalance } from '@/hooks/use-balance'

interface PointsDisplayProps {
  className?: string
  children?: React.ReactNode
}

export function PointsDisplay({ className, children }: PointsDisplayProps) {
  const { balance, error, isLoading } = useBalance()

  // 将金额乘以 100 转换为积分，显示为整数，如果为负数则显示 0
  const points = Math.max(0, Math.floor(parseFloat(balance) * 100))

  // 调试信息
  useEffect(() => {
    console.log('🎯 PointsDisplay 渲染:', {
      balance,
      points,
      isLoading,
      error: error?.message,
    })
  }, [balance, points, isLoading, error])

  return (
    <div className={cn('flex items-center relative', className)}>
      {/* 积分显示区域 */}
      <div className="flex items-center bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-full border border-gray-200 dark:border-gray-700 pr-12">
        {isLoading ? (
          <>
            <Loader2 className="w-3.5 h-3.5 text-black dark:text-white mr-1.5 animate-spin" />
            <span className="text-xs font-semibold text-black dark:text-white">
              ...
            </span>
          </>
        ) : error ? (
          <>
            <Zap className="w-3.5 h-3.5 text-red-500 mr-1.5" />
            <span className="text-xs font-semibold text-red-500">
              --
            </span>
          </>
        ) : (
          <>
            <Zap className="w-3.5 h-3.5 text-black dark:text-white mr-1.5" />
            <span className="text-xs font-semibold text-black dark:text-white">
              {points}
            </span>
          </>
        )}
      </div>

      {/* 头像区域 - 重叠在积分显示上，确保完全可见 */}
      <div className="absolute -right-2 top-1/2 -translate-y-1/2 z-20">
        {children}
      </div>
    </div>
  )
}
