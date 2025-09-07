import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { useConfigs } from '@/contexts/configs'
import { useNavigate } from '@tanstack/react-router'
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
import { Zap, LogOut, Crown } from 'lucide-react'

export function UserMenu() {
  const { authStatus } = useAuth()
  const { setShowLoginDialog } = useConfigs()
  const { t } = useTranslation()
  const { balance, isLoading, error } = useBalance()
  const navigate = useNavigate()

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
        <DropdownMenuContent align="end" className="w-64">
          {/* User Profile Header */}
          <div className="px-3 py-3 border-b">
            <div className="flex items-center space-x-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={image_url} alt={username} />
                <AvatarFallback className="text-sm font-medium">{initials}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {username}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {authStatus.user_info.email || 'No email provided'}
                </p>
              </div>
            </div>
          </div>
          
          {/* Upgrade Button */}
          <div className="px-3 py-3 border-b">
            <Button
              onClick={() => navigate({ to: '/pricing' })}
              className="w-full bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white border-0 shadow-sm"
              size="sm"
            >
              <Crown className="w-4 h-4 mr-2" />
              {t('common:auth.upgrade')}
            </Button>
          </div>
          
          {/* Credits 显示 */}
          <div className="px-3 py-3 border-b">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{t('common:auth.currentPoints')}</span>
              <div className="flex items-center space-x-1">
                <span className="text-sm font-semibold">
                  {isLoading ? '...' : error ? '--' : points}
                </span>
                <span className="text-xs text-muted-foreground">{t('common:auth.left')}</span>
              </div>
            </div>
          </div>
          
          {/* Menu Items */}
          <div className="py-1">
            {/* 退出 */}
            <DropdownMenuItem 
              onClick={handleLogout} 
              className="px-3 py-2 cursor-pointer hover:bg-accent transition-colors text-red-600 hover:text-red-700"
            >
              <div className="flex items-center space-x-3">
                <LogOut className="w-4 h-4" />
                <span className="text-sm">{t('common:auth.logout')}</span>
              </div>
            </DropdownMenuItem>
          </div>
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
