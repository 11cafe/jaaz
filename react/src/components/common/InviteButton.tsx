import { Button } from '@/components/ui/button'
import { Users } from 'lucide-react'
import { InviteDialog } from '@/components/invite/InviteDialog'
import { useTranslation } from 'react-i18next'

interface InviteButtonProps {
  className?: string
}

export default function InviteButton({ className }: InviteButtonProps) {
  const { t } = useTranslation('common')

  return (
    <div className={className}>
      <InviteDialog>
        <Button
          variant="ghost"
          size="sm"
          className="flex items-center gap-1.5 font-medium px-2 py-1.5 text-sm rounded-lg hover:bg-white/20 hover:backdrop-blur-sm sm:px-3 sm:py-2 sm:text-base"
        >
          <Users size={18} />
          <span className="hidden sm:inline">{t('invite.title')}</span>
        </Button>
      </InviteDialog>
    </div>
  )
}