import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Copy, X, Users } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { getMyInviteCode, generateInviteUrl, copyToClipboard } from '@/api/invite'

interface InviteDialogProps {
  children: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function InviteDialog({ children, open, onOpenChange }: InviteDialogProps) {
  const { t } = useTranslation('common')
  const [isOpen, setIsOpen] = useState(false)

  // Use controlled or internal state
  const dialogOpen = open !== undefined ? open : isOpen
  const setDialogOpen = onOpenChange || setIsOpen

  // Fetch invite code
  const { data: inviteCode, isLoading, error } = useQuery({
    queryKey: ['inviteCode'],
    queryFn: getMyInviteCode,
    enabled: dialogOpen, // Only fetch when dialog is open
  })

  const handleCopyUrl = () => {
    if (inviteCode?.code) {
      const url = generateInviteUrl(inviteCode.code)
      const success = copyToClipboard(url)
      if (success) {
        toast.success(t('invite.copySuccess'))
        setDialogOpen(false)
      } else {
        toast.error(t('invite.copyFailed'))
      }
    }
  }

  const inviteUrl = inviteCode?.code ? generateInviteUrl(inviteCode.code) : ''
  const totalInvites = inviteCode?.used_count || 0
  const maxInvites = 500

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="w-[95vw] max-w-3xl mx-auto bg-white dark:bg-stone-900 rounded-2xl shadow-2xl border-0 p-0 overflow-hidden">
        {/* Close Button */}
        <Button
          variant="ghost"
          size="sm"
          className="absolute right-3 top-3 z-10 rounded-full w-6 h-6 p-0 text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 hover:bg-stone-100/80 dark:hover:bg-stone-800/80 transition-all duration-200 backdrop-blur-sm"
          onClick={() => setDialogOpen(false)}
        >
          <X className="h-3.5 w-3.5" />
        </Button>

        <div className="px-8 sm:px-10 py-8 sm:py-10">
          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
            {/* Left Side - Icon and Title */}
            <div className="flex flex-col items-center justify-center space-y-5 lg:space-y-7">
              {/* Friends Icon */}
              <div className="w-20 h-20 lg:w-24 lg:h-24 bg-gradient-to-br from-stone-600 to-stone-700 dark:from-stone-700 dark:to-stone-800 rounded-full flex items-center justify-center shadow-lg">
                <Users className="w-10 h-10 lg:w-12 lg:h-12 text-white" />
              </div>
              
              {/* Title and Description */}
              <div className="text-center space-y-4">
                <h1 className="text-2xl lg:text-3xl font-bold text-stone-900 dark:text-stone-100">
                  {t('invite.title')}
                </h1>
                <p className="text-base lg:text-lg text-stone-600 dark:text-stone-300 leading-relaxed max-w-sm">
                  {t('invite.description')}
                </p>
              </div>
            </div>

            {/* Right Side - Action Area */}
            <div className="space-y-5 lg:space-y-7">
              {/* Progress Section */}
              <div className="bg-stone-50 dark:bg-stone-800 rounded-xl p-5 border border-stone-200 dark:border-stone-700">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-base text-stone-600 dark:text-stone-400">{t('invite.totalInvites')}</span>
                    <span className="text-base font-semibold text-stone-700 dark:text-stone-300">{totalInvites}/{maxInvites}</span>
                  </div>
                  <div className="w-full bg-stone-200 dark:bg-stone-700 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-stone-600 to-stone-700 dark:from-stone-500 dark:to-stone-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${Math.min((totalInvites / maxInvites) * 100, 100)}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              {/* Share Section */}
              <div className="space-y-4">
                <h3 className="text-base lg:text-lg font-semibold text-stone-900 dark:text-stone-100">
                  {t('invite.yourInvitationUrl')}
                </h3>
                
                {/* Invite Link */}
                <div className="space-y-3">
                  <p className="text-sm text-stone-600 dark:text-stone-400">
                    {t('invite.copyThisUrl')}
                  </p>
                  <div className="bg-stone-50 dark:bg-stone-800 rounded-xl border border-stone-200 dark:border-stone-700 p-4 lg:p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <Copy className="w-4 h-4 text-stone-400 dark:text-stone-500 flex-shrink-0" />
                      <span className="text-xs text-stone-500 dark:text-stone-400 font-medium">{t('invite.invitationUrl')}</span>
                    </div>
                    <div className="space-y-3">
                      {isLoading ? (
                        <div className="animate-pulse bg-stone-300 dark:bg-stone-600 h-12 rounded w-full"></div>
                      ) : error || !inviteCode?.success ? (
                        <span className="text-stone-500 dark:text-stone-400 text-sm">{t('invite.failedToLoad')}</span>
                      ) : (
                        <div className="bg-white dark:bg-stone-700 border border-stone-200 dark:border-stone-600 rounded-lg overflow-hidden">
                          <input
                            type="text"
                            value={inviteUrl}
                            readOnly
                            className="w-full px-3 py-3 bg-transparent border-none outline-none font-mono text-sm text-stone-700 dark:text-stone-300 select-all cursor-pointer focus:bg-stone-50 dark:focus:bg-stone-600 transition-colors"
                            onClick={(e) => e.currentTarget.select()}
                            onFocus={(e) => e.currentTarget.select()}
                          />
                        </div>
                      )}
                      <Button
                        onClick={handleCopyUrl}
                        disabled={isLoading || !inviteCode?.success}
                        className="w-full bg-gradient-to-r from-stone-600 to-stone-700 dark:from-stone-700 dark:to-stone-800 hover:from-stone-700 hover:to-stone-800 dark:hover:from-stone-600 dark:hover:to-stone-700 text-white font-semibold py-2.5 text-sm rounded-lg shadow-md hover:shadow-lg transition-all duration-200 border-0"
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        {t('invite.copyUrl')}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}