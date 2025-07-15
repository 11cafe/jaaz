import React from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { useConfigs, useRefreshModels } from '@/contexts/configs'
import { useBalance } from '@/hooks/use-balance'
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

export function UserMenu() {
  const { authStatus, refreshAuth } = useAuth()
  const { setShowLoginDialog } = useConfigs()
  const refreshModels = useRefreshModels()
  const { balance, loading: balanceLoading, refreshBalance } = useBalance()
  const { t } = useTranslation()

  const handleLogout = async () => {
    await logout()
    await refreshAuth()
    // Refresh models list after logout and config update
    refreshModels()
  }

  // 如果用户已登录，显示用户菜单
  if (authStatus.is_logged_in && authStatus.user_info) {
    const { username, image_url } = authStatus.user_info
    const initials = username ? username.substring(0, 2).toUpperCase() : 'U'

    return (
      <DropdownMenu
        onOpenChange={(open) => {
          if (open) {
            refreshBalance()
          }
        }}
      >
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-6 w-6 rounded-full">
            <Avatar className="h-6 w-6">
              <AvatarImage src={image_url} alt={username} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>{t('common:auth.myAccount')}</DropdownMenuLabel>
          <DropdownMenuItem disabled>{username}</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>{t('common:auth.balance')}</DropdownMenuLabel>
          <DropdownMenuItem className="flex items-center justify-between">
            <span>
              {balanceLoading ? '...' : `$ ${parseFloat(balance).toFixed(2)}`}
            </span>
            <Button
              size="sm"
              variant="outline"
              className="ml-2 h-6 px-2 text-xs"
              onClick={() => {
                const billingUrl = `${BASE_API_URL}/billing`
                if (window.electronAPI?.openBrowserUrl) {
                  window.electronAPI.openBrowserUrl(billingUrl)
                } else {
                  window.open(billingUrl, '_blank')
                }
              }}
            >
              {t('common:auth.recharge')}
            </Button>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout}>
            {t('common:auth.logout')}
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
