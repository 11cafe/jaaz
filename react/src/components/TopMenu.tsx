import { Button } from '@/components/ui/button'
import { useNavigate } from '@tanstack/react-router'
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

  return (
    <div
      className="sticky top-0 z-50 flex w-full h-16 bg-background/95 backdrop-blur-md px-6 justify-between items-center select-none border-b border-border/60 shadow-sm"
    >
      <div className="flex items-center gap-10">
        <div
          className="flex items-center gap-3 cursor-pointer group transition-all duration-200 hover:scale-105"
          onClick={() => navigate({ to: '/' })}
        >
          <img src={LOGO_URL} alt="logo" className="size-7 transition-transform duration-200 group-hover:rotate-12" draggable={false} />
          <div className="flex relative overflow-hidden items-center text-2xl font-bold text-foreground">
            <span className="flex items-center">
              MagicArt
            </span>
          </div>
        </div>
        <nav className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="flex items-center font-medium px-4 py-2 rounded-lg hover:bg-muted/60 transition-all duration-200 hover:scale-105"
            onClick={() => navigate({ to: '/templates' })}
          >
            模版
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="flex items-center font-medium px-4 py-2 rounded-lg hover:bg-muted/60 transition-all duration-200 hover:scale-105"
            onClick={() => navigate({ to: '/pricing' })}
          >
            定价
          </Button>
        </nav>
      </div>

      <div className="flex items-center gap-3">{middle}</div>

      <div className="flex items-center gap-2">
        {right}
        {/* <AgentSettings /> */}
        <LanguageSwitcher />
        <ThemeButton />
        <UserMenu />
      </div>
    </div>
  )
}
