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
import { Coins, Minus, Plus } from 'lucide-react'
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
    const image_url = authUserInfo?.image_url
    const initials = username ? username.substring(0, 2).toUpperCase() : 'U'

    return (
      <div className="absolute bottom-4 left-4 z-50">
        <div className="flex items-center gap-3 bg-white/95 backdrop-blur-lg border border-white/50 rounded-2xl px-4 py-2.5 shadow-2xl hover:shadow-3xl transition-all duration-300 hover:scale-105">
          {/* 用户头像 */}
          <Avatar className="h-9 w-9 ring-2 ring-blue-200/60">
            <AvatarImage src={image_url} alt={username} />
            <AvatarFallback className="text-xs font-semibold bg-gradient-to-br from-blue-100 to-indigo-100 text-slate-700">
              {initials}
            </AvatarFallback>
          </Avatar>

          {/* 积分显示 */}
          <div className="flex items-center gap-2 text-slate-700">
            <div className="p-1 rounded-full bg-amber-100">
              <Coins className="w-3.5 h-3.5 text-amber-600" />
            </div>
            <span className="text-sm font-semibold">
              {balanceLoading ? '...' : balanceError ? '--' : points}
            </span>
          </div>

          {/* 缩放控制 - 新位置 */}
          <div className="flex items-center gap-1 border-l border-slate-200/70 pl-3">
            <Button
              className="h-7 w-7 p-0 hover:bg-slate-100 rounded-lg transition-colors"
              variant="ghost"
              size="icon"
              onClick={() => handleZoomChange(currentZoom - 10)}
            >
              <Minus className="h-3.5 w-3.5 text-slate-600" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="h-7 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors min-w-[3rem]"
                >
                  {currentZoom}%
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="w-24 bg-white/95 backdrop-blur-lg border-white/50">
                {[25, 50, 100, 150, 200].map((zoom) => (
                  <DropdownMenuItem key={zoom} onClick={() => handleZoomChange(zoom)} className="text-xs">
                    {zoom}%
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleZoomFit} className="text-xs">
                  {t('canvas:tool.zoomFit')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              className="h-7 w-7 p-0 hover:bg-slate-100 rounded-lg transition-colors"
              variant="ghost"
              size="icon"
              onClick={() => handleZoomChange(currentZoom + 10)}
            >
              <Plus className="h-3.5 w-3.5 text-slate-600" />
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // 未登录状态，显示登录提示
  return (
    <div className="absolute bottom-4 left-4 z-50">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowLoginDialog(true)}
        className="bg-white/90 backdrop-blur-md border-gray-200/50 text-gray-700 hover:bg-white transition-all duration-200"
      >
        {t('common:auth.login')}
      </Button>
    </div>
  )
}