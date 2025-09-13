import { Button } from '@/components/ui/button'
import { useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import ThemeButton from '@/components/theme/ThemeButton'
import { LOGO_URL } from '@/constants'
import LanguageSwitcher from './common/LanguageSwitcher'
import { UserMenu } from './auth/UserMenu'

export default function TopMenu({
  middle,
  right,
}: {
  middle?: React.ReactNode
  right?: React.ReactNode
}) {
  const navigate = useNavigate()
  const { t } = useTranslation('common')

  return (
    <div
      className="sticky top-0 z-50 flex w-full h-16 px-3 sm:px-6 items-center select-none relative"
    >
      {/* 左侧区域 */}
      <div className="flex items-center gap-2 sm:gap-10 min-w-0 flex-1">
        <div
          className="flex items-center gap-2 sm:gap-3 cursor-pointer group min-w-0"
          onClick={() => navigate({ to: '/' })}
        >
          <img src={LOGO_URL} alt="logo" className="size-6 sm:size-7 shrink-0" draggable={false} />
          <div className="flex relative items-center text-base sm:text-lg md:text-2xl font-bold text-foreground min-w-0">
            <span className="flex items-center whitespace-nowrap drop-shadow-sm">
              MagicArt
            </span>
          </div>
        </div>
        <nav className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="flex items-center font-medium px-2 py-1.5 text-sm rounded-lg hover:bg-white/20 hover:backdrop-blur-sm sm:px-4 sm:py-2 sm:text-base drop-shadow-sm"
            onClick={() => navigate({ to: '/templates' })}
          >
            {t('navigation.templates')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="flex items-center font-medium px-2 py-1.5 text-sm rounded-lg hover:bg-white/20 hover:backdrop-blur-sm sm:px-4 sm:py-2 sm:text-base drop-shadow-sm"
            onClick={() => navigate({ to: '/pricing' })}
          >
            {t('navigation.pricing')}
          </Button>
        </nav>
      </div>

      {/* 中间区域 - 绝对居中 */}
      {middle && (
        <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2">
          {middle}
        </div>
      )}

      {/* 右侧区域 */}
      <div className="flex items-center gap-1 sm:gap-2 drop-shadow-sm">
        {right}
        {/* <AgentSettings /> */}
        <LanguageSwitcher />
        <ThemeButton />
        <UserMenu />
      </div>
    </div>
  )
}
