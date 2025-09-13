import { Zap, Loader2 } from 'lucide-react'
import { useBalance } from '@/hooks/use-balance'
import { cn } from '@/lib/utils'

interface PointsBadgeProps {
  className?: string
}

export default function PointsBadge({ className }: PointsBadgeProps) {
  const { balance, error, isLoading } = useBalance()

  // 将金额乘以 100 转换为积分，显示为整数，如果为负数则显示 0
  const points = Math.max(0, Math.floor(parseFloat(balance) * 100))

  return (
    <div className={cn(
      "flex items-center gap-1.5 px-2 sm:px-3 py-1.5",
      className
    )}>
      {isLoading ? (
        <>
          <Loader2 className="w-4 h-4 text-foreground/70 animate-spin" />
          <span className="hidden sm:inline text-sm font-semibold text-foreground/70">...</span>
        </>
      ) : error ? (
        <>
          <Zap className="w-4 h-4 text-red-500" />
          <span className="hidden sm:inline text-sm font-semibold text-red-500">--</span>
        </>
      ) : (
        <>
          <Zap className="w-4 h-4 text-foreground" />
          <span className="hidden sm:inline text-sm font-semibold text-foreground">{points}</span>
        </>
      )}
    </div>
  )
}