import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuth } from '@/contexts/AuthContext'
import { useBalance } from '@/hooks/use-balance'
import { useUserInfo } from '@/hooks/use-user-info'
import { useConfigs } from '@/contexts/configs'
import { useCanvas } from '@/contexts/canvas'
import { useTranslation } from 'react-i18next'
import { Zap, Minus, Plus } from 'lucide-react'
import { useState } from 'react'

export function FloatingUserInfo() {
  const { authStatus } = useAuth()
  const { setShowLoginDialog } = useConfigs()
  const { t } = useTranslation()
  const { balance, isLoading: balanceLoading, error: balanceError } = useBalance()
  const { userInfo, isLoggedIn: userInfoLoggedIn } = useUserInfo()
  const { excalidrawAPI } = useCanvas()
  const [currentZoom, setCurrentZoom] = useState<number>(100)

  // 计算积分显示
  const points = Math.max(0, Math.floor(parseFloat(balance) * 100))

  // 缩放控制函数
  const handleZoomChange = (zoom: number) => {
    excalidrawAPI?.updateScene({
      appState: {
        zoom: {
          // @ts-ignore
          value: zoom / 100,
        },
      },
    })
  }

  const handleZoomFit = () => {
    excalidrawAPI?.scrollToContent(undefined, {
      fitToContent: true,
      animate: true,
    })
  }

  // 监听缩放变化
  excalidrawAPI?.onChange((_elements, appState, _files) => {
    const zoom = (appState.zoom.value * 100).toFixed(0)
    setCurrentZoom(Number(zoom))
  })

  // 智能判断登录状态
  const isLoggedIn = userInfoLoggedIn || authStatus.is_logged_in
  const hasUserInfo = (userInfo?.user_info && userInfo.is_logged_in) || authStatus.user_info

  // 检查是否在logout过程中
  const isLoggingOut = sessionStorage.getItem('is_logging_out') === 'true' ||
                      sessionStorage.getItem('force_logout') === 'true'

  // 如果用户已登录且不在logout过程中，显示用户信息
  if (isLoggedIn && hasUserInfo && !isLoggingOut) {
    const authUserInfo = authStatus.user_info
    const apiUserInfo = userInfo?.user_info

    const username = authUserInfo?.username || apiUserInfo?.email?.split('@')[0] || 'User'
    const image_url = authUserInfo?.image_url || apiUserInfo?.image_url
    const initials = username ? username.substring(0, 2).toUpperCase() : 'U'

    return (
      <div className="absolute top-16 left-4 md:bottom-5 md:top-auto z-30">
        <div className="flex items-center gap-2 bg-white/85 backdrop-blur-md border border-white/30 rounded-lg px-2 py-1 shadow-none transition-all duration-200 hover:bg-white/90">
          {/* 用户头像 */}
          <Avatar className="h-7 w-7 ring-1 ring-blue-200/30">
            <AvatarImage src={image_url} alt={username} />
            <AvatarFallback className="text-[10px] font-medium bg-gradient-to-br from-blue-100 to-indigo-100 text-slate-600">
              {initials}
            </AvatarFallback>
          </Avatar>

          {/* 积分显示 */}
          <div className="flex items-center gap-1.5 text-slate-600">
            <div className="p-1 rounded-full bg-gray-100">
              <Zap className="w-3 h-3 text-gray-700" />
            </div>
            <span className="text-[11px] font-medium">
              {balanceLoading ? '...' : balanceError ? '--' : points}
            </span>
          </div>
        </div>
      </div>
    )
  }

  // 未登录状态，显示登录提示
  return (
    <div className="absolute top-16 left-4 md:bottom-5 md:top-auto z-30">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowLoginDialog(true)}
        className="bg-white/85 backdrop-blur-md border-gray-200/30 text-gray-700 hover:bg-white/90 transition-all duration-200 text-[10px] px-1.5 py-0.5 h-auto shadow-none rounded-lg"
      >
        {t('common:auth.login')}
      </Button>
    </div>
  )
}