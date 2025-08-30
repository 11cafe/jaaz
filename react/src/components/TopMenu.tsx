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
      className="sticky top-0 z-0 flex w-full h-8 bg-background px-4 justify-between items-center select-none border-b border-border"
    >
      <div className="flex items-center gap-8">
        <div
          className="flex items-center gap-2 cursor-pointer group"
          onClick={() => navigate({ to: '/' })}
        >
          <img src={LOGO_URL} alt="logo" className="size-5" draggable={false} />
          <div className="flex relative overflow-hidden items-start h-7 text-xl font-bold">
            <span className="flex items-center">
              Jaaz
            </span>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="flex items-center font-bold rounded-none"
          onClick={() => navigate({ to: '/templates' })}
        >
          模版
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="flex items-center font-bold rounded-none"
          onClick={() => navigate({ to: '/pricing' })}
        >
          定价
        </Button>
      </div>

      <div className="flex items-center gap-2">{middle}</div>

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
