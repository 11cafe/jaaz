import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { useConfigs } from '@/contexts/configs'
import { BASE_API_URL } from '@/constants'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { logout } from '@/api/auth'
import { useBalance } from '@/hooks/use-balance'
import { useEffect } from 'react'
import { Zap, ShoppingCart, LogOut } from 'lucide-react'

export function UserMenu() {
  const { authStatus } = useAuth()
  const { setShowLoginDialog } = useConfigs()
  const { t } = useTranslation()
  const { balance, isLoading, error } = useBalance()

  // 计算积分显示
  const points = Math.max(0, Math.floor(parseFloat(balance) * 100))

  // 调试认证状态
  useEffect(() => {
    console.log('👤 UserMenu 认证状态:', {
      isLoggedIn: authStatus.is_logged_in,
      hasUserInfo: !!authStatus.user_info,
      userEmail: authStatus.user_info?.email,
      status: authStatus.status,
      points,
    })
  }, [authStatus, points])

  const handleLogout = async () => {
    console.log('🚪 UserMenu: Starting logout...')
    try {
      // 🚀 调用优化后的logout函数
      // 它会：1.调用后端API 2.清理前端数据 3.通知其他标签页 4.跳转到首页
      await logout()
    } catch (error) {
      console.error('❌ UserMenu logout failed:', error)
      // 即使出错，logout函数内部也有兜底方案
    }
  }

  // 如果用户已登录，显示用户菜单
  if (authStatus.is_logged_in && authStatus.user_info) {
    const { username, image_url } = authStatus.user_info
    const initials = username ? username.substring(0, 2).toUpperCase() : 'U'

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative p-1 h-auto rounded-full">
            <Avatar className="h-8 w-8">
              <AvatarImage src={image_url} alt={username} />
              <AvatarFallback className="text-sm">{initials}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>{t('common:auth.myAccount')}</DropdownMenuLabel>
          <DropdownMenuItem disabled className="text-xs text-muted-foreground">
            {username}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          
          {/* 当前积分显示 */}
          <DropdownMenuItem disabled className="flex items-center justify-between">
            <div className="flex items-center">
              <Zap className="w-4 h-4 mr-2" />
              <span>当前积分</span>
            </div>
            <span className="font-semibold">
              {isLoading ? '...' : error ? '--' : points}
            </span>
          </DropdownMenuItem>
          
          <DropdownMenuSeparator />
          
          {/* 购买点数 */}
          <DropdownMenuItem
            onClick={() => {
              const billingUrl = `${BASE_API_URL}/billing`
              if (window.electronAPI?.openBrowserUrl) {
                window.electronAPI.openBrowserUrl(billingUrl)
              } else {
                window.open(billingUrl, '_blank')
              }
            }}
          >
            <ShoppingCart className="w-4 h-4 mr-2" />
            <span>购买点数</span>
          </DropdownMenuItem>
          
          <DropdownMenuSeparator />
          
          {/* 退出 */}
          <DropdownMenuItem onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            <span>退出</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  // 未登录状态，显示登录按钮
  return (
    <Button variant="outline" onClick={() => setShowLoginDialog(true)}>
      {t('common:auth.login')}
    </Button>
  )
}
