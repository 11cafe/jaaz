import { Session } from '@/types/types'
import { PlusIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '../ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select'
import { formatSessionTitle } from '@/utils/formatDate'

type SessionSelectorProps = {
  session: Session | null
  sessionList: Session[]
  onSelectSession: (sessionId: string) => void
  onClickNewChat: () => void
}

const SessionSelector: React.FC<SessionSelectorProps> = ({
  session,
  sessionList,
  onSelectSession,
  onClickNewChat,
}) => {
  const { t } = useTranslation(['chat', 'common'])

  return (
    <div className="flex items-center gap-3 w-full p-3 bg-white/40 backdrop-blur-sm rounded-xl border border-white/30 shadow-sm" style={{ display: 'none' }}>
      <Select
        value={session?.id}
        onValueChange={(value) => {
          onSelectSession(value)
        }}
      >
        <SelectTrigger className="flex-1 min-w-0 bg-white/60 backdrop-blur-sm border-white/40 rounded-lg shadow-sm hover:bg-white/80 transition-all duration-200">
          <SelectValue placeholder={session ? formatSessionTitle(session) : t('chat:sessionHistory.selectSession')} />
        </SelectTrigger>
        <SelectContent>
          {sessionList
            ?.filter((session) => session.id && session.id.trim() !== '') // Fix error of A ‹Select.Item /> must have a value prop that is not an empty string.
            ?.map((session) => (
              <SelectItem key={session.id} value={session.id}>
                {formatSessionTitle(session)}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>

      <Button
        onClick={onClickNewChat}
        className="shrink-0 gap-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white border-0 shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-200 px-4 py-2 rounded-lg"
      >
        <PlusIcon className="w-4 h-4" />
        <span className="text-sm font-medium">{t('chat:newChat')}</span>
      </Button>
    </div>
  )
}

export default SessionSelector
