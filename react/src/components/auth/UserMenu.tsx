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
import { useUserInfo } from '@/hooks/use-user-info'
import { useEffect, useState, useCallback } from 'react'
import { LogOut, Crown, Gift } from 'lucide-react'
import { InviteDialog } from '@/components/invite/InviteDialog'

// 🆕 Helper function to format level display with i18n support
const formatLevelDisplay = (level: string, t: any): { name: string, period: string, isMax: boolean } => {
  if (!level || level === 'free') {
    return { name: t('common:auth.levels.free'), period: '', isMax: false }
  }
  
  // 解析新的level格式：base_monthly, pro_yearly等
  const parts = level.split('_')
  if (parts.length !== 2) {
    // 兼容旧格式
    const levelKey = level as 'base' | 'pro' | 'max'
    return { 
      name: t(`common:auth.levels.${levelKey}`, { defaultValue: level }), 
      period: '', 
      isMax: level === 'max' 
    }
  }
  
  const [planType, billingPeriod] = parts
  
  return {
    name: t(`common:auth.levels.${planType}`, { defaultValue: planType }),
    period: t(`common:auth.levels.${billingPeriod}`, { defaultValue: billingPeriod }),
    isMax: planType === 'max'
  }
}

export function UserMenu() {
  const { authStatus, refreshAuth } = useAuth()
  const { setShowLoginDialog } = useConfigs()
  const { t } = useTranslation()
  const { balance, isLoading: balanceLoading, error: balanceError } = useBalance()
  const { userInfo, currentLevel, isLoggedIn: userInfoLoggedIn, isLoading: userInfoLoading, refreshUserInfo } = useUserInfo()
  const navigate = useNavigate()
  const [showInviteDialog, setShowInviteDialog] = useState(false)
  
  // 🎯 用户菜单打开时主动刷新用户数据，确保信息是最新的
  const handleMenuOpen = useCallback(() => {
    console.log('👤 UserMenu: 菜单打开，主动刷新用户数据...')
    // 同时刷新认证状态和用户信息
    refreshAuth().catch(error => {
      console.error('❌ UserMenu: 刷新认证状态失败:', error)
    })
    refreshUserInfo().catch(error => {
      console.error('❌ UserMenu: 刷新用户信息失败:', error)
    })
  }, [refreshAuth, refreshUserInfo])

  // 计算积分显示
  const points = Math.max(0, Math.floor(parseFloat(balance) * 100))

  // 🎯 组件加载时主动刷新一次用户数据，确保等级信息最新
  useEffect(() => {
    if (authStatus.is_logged_in && authStatus.user_info) {
      console.log('👤 UserMenu: 组件加载，主动刷新用户数据确保等级最新...')
      refreshAuth().catch(error => {
        console.error('❌ UserMenu: 初始刷新认证状态失败:', error)
      })
    }
  }, []) // 只在组件加载时执行一次
  
  // 调试状态信息
  useEffect(() => {
    console.log('👤 UserMenu 状态信息:', {
      // AuthContext数据
      authIsLoggedIn: authStatus.is_logged_in,
      authUserLevel: authStatus.user_info?.level,
      // useUserInfo数据
      userInfoLoggedIn: userInfoLoggedIn,
      currentLevel: currentLevel,
      userInfoLoading: userInfoLoading,
      points,
    })
  }, [authStatus, userInfoLoggedIn, currentLevel, userInfoLoading, points])

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

  // 🎯 智能判断登录状态：优先使用userInfo的数据，回退到authStatus
  const isLoggedIn = userInfoLoggedIn || authStatus.is_logged_in
  const hasUserInfo = (userInfo?.user_info && userInfo.is_logged_in) || authStatus.user_info

  // 如果用户已登录，显示用户菜单
  if (isLoggedIn && hasUserInfo) {
    // 🎯 智能合并用户信息：userInfo提供level，AuthContext提供完整用户信息
    const authUserInfo = authStatus.user_info
    const apiUserInfo = userInfo?.user_info
    
    // 🔧 优先使用AuthContext的username和image_url，因为API接口没有返回这些字段
    const username = authUserInfo?.username || apiUserInfo?.email?.split('@')[0] || 'User'
    const image_url = authUserInfo?.image_url
    const email = apiUserInfo?.email || authUserInfo?.email
    const level = currentLevel || authUserInfo?.level || 'free'
    const initials = username ? username.substring(0, 2).toUpperCase() : 'U'
    
    // 🔍 调试头像信息
    console.log('🔍 UserMenu: 头像信息调试:', {
      authUserInfo,
      apiUserInfo,
      finalUsername: username,
      finalImageUrl: image_url,
      finalEmail: email,
      finalLevel: level
    })
    
    // 🔍 调试：显示实际使用的level值
    console.log('🔍 UserMenu: 最终使用的用户等级:', {
      currentLevel: currentLevel,
      authLevel: authStatus.user_info?.level,
      finalLevel: level,
      source: currentLevel ? 'useUserInfo' : 'AuthContext'
    })
    
    // 🆕 格式化用户等级显示
    const levelInfo = formatLevelDisplay(level, t)
    console.log('🔍 UserMenu: 格式化结果:', levelInfo)
    

    return (
      <>
        <DropdownMenu onOpenChange={(open) => open && handleMenuOpen()}>
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
                    {email || 'No email provided'}
                  </p>
                  {/* 🆕 显示用户计划信息 */}
                  <div className="flex items-center gap-1 mt-1">
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-medium">
                      {levelInfo.name}
                    </span>
                    {levelInfo.period && (
                      <span className="text-xs text-muted-foreground">
                        ({levelInfo.period})
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            
            {/* Upgrade Button */}
            <div className="px-3 py-3 border-b">
              <Button
                onClick={() => navigate({ to: '/pricing' })}
                className="w-full bg-gradient-to-r from-stone-800 to-stone-900 hover:from-stone-700 hover:to-stone-800 text-white border border-stone-600 hover:border-amber-400/50 shadow-sm hover:shadow-md transition-all duration-200"
                size="sm"
              >
                <Crown className="w-4 h-4 mr-2" />
                {levelInfo.isMax ? t('common:auth.managePlan') : t('common:auth.upgrade')}
              </Button>
            </div>
            
            {/* Credits 显示 */}
            <div className="px-3 py-3 border-b">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{t('common:auth.currentPoints')}</span>
                <div className="flex items-center space-x-1">
                  <span className="text-sm font-semibold">
                    {balanceLoading ? '...' : balanceError ? '--' : points}
                  </span>
                  <span className="text-xs text-muted-foreground">{t('common:auth.left')}</span>
                </div>
              </div>
            </div>
            
            {/* Menu Items */}
            <div className="py-1">
              {/* 邀请码 */}
              <DropdownMenuItem 
                onClick={() => setShowInviteDialog(true)} 
                className="px-3 py-2 cursor-pointer hover:bg-accent transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <Gift className="w-4 h-4 text-green-600" />
                  <span className="text-sm">{t('common:auth.inviteCode')}</span>
                </div>
              </DropdownMenuItem>
              
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
        
        {/* 邀请码弹窗 - 移到外部避免与DropdownMenu冲突 */}
        <InviteDialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
          <div />
        </InviteDialog>
      </>
    )
  }

  // 未登录状态，显示登录按钮
  return (
    <Button variant="outline" onClick={() => setShowLoginDialog(true)}>
      {t('common:auth.login')}
    </Button>
  )
}
