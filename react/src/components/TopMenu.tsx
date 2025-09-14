import { Button } from '@/components/ui/button'
import { useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { LOGO_URL } from '@/constants'
import LanguageSwitcher from './common/LanguageSwitcher'
import { UserMenu } from './auth/UserMenu'
import InviteButton from './common/InviteButton'
import PointsBadge from './common/PointsBadge'
import { useAuth } from '@/contexts/AuthContext'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

export default function TopMenu({
  middle,
  right,
}: {
  middle?: React.ReactNode
  right?: React.ReactNode
}) {
  const navigate = useNavigate()
  const { t } = useTranslation('common')
  const { authStatus } = useAuth()

  const [isVisible, setIsVisible] = useState(true)
  const [lastScrollY, setLastScrollY] = useState(0)

  useEffect(() => {
    let timeoutId: NodeJS.Timeout

    const controlNavbar = () => {
      clearTimeout(timeoutId)

      timeoutId = setTimeout(() => {
        const currentScrollY = window.scrollY

        if (currentScrollY < 10) {
          // 在页面顶部附近时始终显示
          setIsVisible(true)
        } else if (currentScrollY > lastScrollY && currentScrollY > 80) {
          // 向下滚动且滚动距离超过80px时隐藏
          setIsVisible(false)
        } else if (currentScrollY < lastScrollY) {
          // 向上滚动时显示
          setIsVisible(true)
        }

        setLastScrollY(currentScrollY)
      }, 10) // 添加10ms的防抖，让滚动更流畅
    }

    window.addEventListener('scroll', controlNavbar, { passive: true })
    return () => {
      window.removeEventListener('scroll', controlNavbar)
      clearTimeout(timeoutId)
    }
  }, [lastScrollY])

  return (
    <div
      className={cn(
        "sticky top-0 z-50 flex w-full h-16 px-3 sm:px-6 items-center select-none relative",
        "transition-transform duration-300 ease-in-out",
        isVisible ? "translate-y-0" : "-translate-y-full"
      )}
    >
      {/* 左侧区域 */}
      <div className="flex items-center gap-2 sm:gap-10 min-w-0 flex-1">
        <div
          className="flex items-center gap-2 sm:gap-3 cursor-pointer group min-w-0"
          onClick={() => navigate({ to: '/' })}
        >
          <img src={LOGO_URL} alt="logo" className="size-6 sm:size-7 shrink-0" draggable={false} />
          <div className="flex relative items-center text-base sm:text-lg md:text-2xl font-bold text-foreground min-w-0">
            <span className="flex items-center whitespace-nowrap">
              MagicArt
            </span>
          </div>
        </div>
        <nav className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="flex items-center font-medium px-2 py-1.5 text-sm rounded-lg hover:bg-white/20 hover:backdrop-blur-sm sm:px-4 sm:py-2 sm:text-base"
            onClick={() => navigate({ to: '/templates' })}
          >
            {t('navigation.templates')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="flex items-center font-medium px-2 py-1.5 text-sm rounded-lg hover:bg-white/20 hover:backdrop-blur-sm sm:px-4 sm:py-2 sm:text-base"
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
      <div className="flex items-center gap-1 sm:gap-2">
        {right}
        {/* <AgentSettings /> */}
        <LanguageSwitcher />
        {/* 只有登录用户才显示邀请按钮 - 移动端隐藏 */}
        {authStatus.is_logged_in && <InviteButton className="hidden sm:flex" />}
        {authStatus.is_logged_in && <PointsBadge className="hidden sm:flex" />}
        {/* <ThemeButton /> */}
        <UserMenu />
      </div>
    </div>
  )
}
