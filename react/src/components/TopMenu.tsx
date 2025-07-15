import { useConfigs } from '@/contexts/configs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ChevronLeft, ImageIcon } from 'lucide-react'
import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from '@tanstack/react-router'
import { SettingsIcon } from 'lucide-react'
import ThemeButton from '@/components/theme/ThemeButton'
import { LOGO_URL } from '@/constants'
import LanguageSwitcher from './common/LanguageSwitcher'
import { cn } from '@/lib/utils'
import { UserMenu } from './auth/UserMenu'

export default function TopMenu({
  middle,
  right,
}: {
  middle?: React.ReactNode
  right?: React.ReactNode
}) {
  const { t } = useTranslation()

  const navigate = useNavigate()
  const { setShowSettingsDialog } = useConfigs()

  return (
    <motion.div
      className="sticky top-0 z-0 flex w-full h-8 bg-background px-4 justify-between items-center select-none border-b border-border"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-center gap-8">
        <motion.div
          className="flex items-center gap-2 cursor-pointer group"
          onClick={() => navigate({ to: '/' })}
        >
          {window.location.pathname !== '/' && (
            <ChevronLeft className="size-5 group-hover:-translate-x-0.5 transition-transform duration-300" />
          )}
          <img src={LOGO_URL} alt="logo" className="size-5" draggable={false} />
          <motion.div className="flex relative overflow-hidden items-start h-7 text-xl font-bold">
            <motion.span className="flex items-center" layout>
              {window.location.pathname === '/' ? 'Jaaz' : t('canvas:back')}
            </motion.span>
          </motion.div>
        </motion.div>
        <Button
          variant={window.location.pathname === '/assets' ? 'default' : 'ghost'}
          size="sm"
          className={cn('flex items-center font-bold rounded-none')}
          onClick={() => navigate({ to: '/assets' })}
        >
          <ImageIcon className="size-4" />
          {t('canvas:assets', 'Library')}
        </Button>
      </div>

      <div className="flex items-center gap-2">{middle}</div>

      <div className="flex items-center gap-2">
        {right}
        {/* <AgentSettings /> */}
        <Button
          size={'sm'}
          variant="ghost"
          onClick={() => setShowSettingsDialog(true)}
        >
          <SettingsIcon size={30} />
        </Button>
        <LanguageSwitcher />
        <ThemeButton />
        <UserMenu />
      </div>
    </motion.div>
  )
}
