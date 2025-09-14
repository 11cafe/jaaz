import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'motion/react'
import { X } from 'lucide-react'
import { Button } from './ui/button'
import { Dialog, DialogContent } from './ui/dialog'
import { directLogin } from '../api/auth'

interface InviteModalProps {
  inviteCode: string
  onClose: () => void
  inviterName?: string
}

export default function InviteModal({ inviteCode, onClose, inviterName = 'Someone' }: InviteModalProps) {
  const { t } = useTranslation()
  const [isLoading, setIsLoading] = useState(false)

  const handleLogin = () => {
    setIsLoading(true)
    // 在登录前保存邀请码到localStorage，以便后续处理
    localStorage.setItem('invite_code', inviteCode)
    directLogin()
  }

  return (
    <Dialog open={true} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-md border-0 shadow-2xl backdrop-blur-sm bg-white dark:bg-gray-900 p-0 overflow-hidden rounded-2xl">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-20 w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors duration-200 focus:outline-none focus:ring-0"
          aria-label={t('common:invite.modal.close')}
        >
          <X className="h-4 w-4" />
        </button>

        <div className="px-8 py-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.21, 1.11, 0.81, 0.99] }}
            className="flex flex-col items-center space-y-6"
          >
            {/* Clean Logo */}
            <div className="mb-6">
              <img
                src="/static/magicart.svg"
                alt="MagicArt Logo"
                className="w-16 h-16 mx-auto"
              />
            </div>

            {/* Title */}
            <div className="text-center space-y-1">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white leading-tight">
                <span className="text-emerald-600 dark:text-emerald-400 text-3xl">{inviterName}</span>
              </h1>
              <p className="text-lg text-gray-700 dark:text-gray-300">
                {t('common:invite.modal.invitedYouTo')}{' '}
                <span className="bg-gradient-to-r from-emerald-600 to-emerald-500 dark:from-emerald-400 dark:to-emerald-300 bg-clip-text text-transparent font-bold">
                  {t('common:invite.modal.productName')}
                </span>
              </p>
            </div>

            {/* Statistics */}
            <div className="text-center space-y-2 max-w-xs">
              <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">
                {t('common:invite.modal.projectsBuilt')}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                {t('common:invite.modal.tagline')}
              </p>
            </div>

            {/* Google Login Button - Official Style */}
            <div className="w-full pt-4">
              <Button
                onClick={handleLogin}
                disabled={isLoading}
                className="w-full h-12 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 font-medium rounded-md shadow-sm transition-all duration-200 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center">
                    <div className="w-5 h-5 mr-3 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
                    <span className="text-gray-600">{t('common:invite.modal.redirecting')}</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center">
                    <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    <span className="text-gray-700 font-medium">{t('common:invite.modal.continueWithGoogle')}</span>
                  </div>
                )}
              </Button>
            </div>
          </motion.div>
        </div>
      </DialogContent>
    </Dialog>
  )
}