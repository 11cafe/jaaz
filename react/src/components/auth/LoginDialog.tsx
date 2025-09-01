import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../ui/button'
import { Dialog, DialogContent } from '../ui/dialog'
import { Lock } from 'lucide-react'
import { directLogin } from '../../api/auth'
import { useConfigs } from '../../contexts/configs'

export function LoginDialog() {
  const [isLoading, setIsLoading] = useState(false)
  const { showLoginDialog: open, setShowLoginDialog } = useConfigs()
  const { t } = useTranslation()

  const handleLogin = () => {
    setIsLoading(true)
    // 直接在当前窗口跳转到Google OAuth
    directLogin()
  }

  return (
    <Dialog open={open} onOpenChange={setShowLoginDialog}>
      <DialogContent className="sm:max-w-md border-0 shadow-2xl backdrop-blur-sm bg-background/95">
        <div className="flex flex-col items-center space-y-8 py-10 px-6">
          {/* 锁图标 */}
          <div className="flex items-center justify-center w-20 h-20 bg-gradient-to-br from-gray-900 to-gray-700 dark:from-gray-100 dark:to-gray-300 rounded-3xl shadow-lg transform transition-transform duration-300 hover:scale-105">
            <Lock className="w-10 h-10 text-white dark:text-gray-800" />
          </div>

          {/* 标题和副标题 */}
          <div className="text-center space-y-3">
            <h1 className="text-3xl font-bold text-foreground tracking-tight">
              欢迎使用 Jaaz
            </h1>
            <p className="text-base text-muted-foreground leading-relaxed max-w-sm">
              请登录以继续使用 AI 设计助手
            </p>
          </div>

          {/* Google 登录按钮 */}
          <div className="w-full space-y-6">
            <Button
              onClick={handleLogin}
              disabled={isLoading}
              className="w-full h-14 bg-white hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700 font-medium rounded-xl transition-all duration-300 transform hover:scale-[1.02] hover:shadow-lg active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              variant="outline"
            >
              {isLoading ? (
                <div className="flex items-center">
                  <div className="w-5 h-5 mr-3 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
                  正在跳转...
                </div>
              ) : (
                <>
                  <svg className="w-6 h-6 mr-3" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  使用 Google 继续
                </>
              )}
            </Button>
          </div>

          {/* 安全登录提示 */}
          <div className="flex items-center text-sm text-muted-foreground/80">
            <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
            安全登录
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
