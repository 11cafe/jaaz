import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog'
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

  const handleCancel = () => {
    setShowLoginDialog(false)
  }

  return (
    <Dialog open={open} onOpenChange={setShowLoginDialog}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('common:auth.loginToJaaz')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t('common:auth.loginDescription')}
          </p>

          <div className="flex gap-2">
            <Button
              onClick={handleLogin}
              disabled={isLoading}
              className="flex-1"
            >
              {isLoading ? t('common:auth.redirectingMessage') : t('common:auth.startLogin')}
            </Button>
            <Button
              onClick={handleCancel}
              variant="outline"
              disabled={isLoading}
            >
              {t('common:cancel')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
