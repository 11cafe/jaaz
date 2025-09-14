import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Session } from '@/types/types'
import { History, MessageSquare, Clock, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getSessionDisplayName } from '@/utils/sessionUtils'
import { useLanguage } from '@/hooks/use-language'

interface SessionHistoryDropdownProps {
  sessionList: Session[]
  currentSessionId: string
  onSessionSelect: (sessionId: string) => void
  onNewSession: () => void
}

export function SessionHistoryDropdown({
  sessionList,
  currentSessionId,
  onSessionSelect,
  onNewSession
}: SessionHistoryDropdownProps) {
  const { t } = useTranslation(['chat', 'common'])
  const { currentLanguage } = useLanguage()

  // 格式化创建时间
  const formatCreatedTime = (session: Session) => {
    try {
      const date = new Date(session.created_at)
      return date.toLocaleDateString(currentLanguage === 'zh-CN' ? 'zh-CN' : 'en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return ''
    }
  }

  // 排序会话：按创建时间倒序
  const sortedSessions = [...sessionList].sort((a, b) => {
    const timeA = new Date(a.created_at).getTime()
    const timeB = new Date(b.created_at).getTime()
    return timeB - timeA
  })

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          className="p-1.5 h-auto w-auto rounded-md hover:bg-gray-100/80 transition-colors"
          title={t('chat:sessionHistory.title')}
        >
          <History className="w-4 h-4 text-gray-600" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-80 max-h-[500px] bg-white/95 backdrop-blur-md border-gray-200/50 shadow-xl rounded-xl p-0 overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">{t('chat:sessionHistory.historyTitle')}</h2>
        </div>

        {/* Session List */}
        <div className="max-h-80 overflow-y-auto">
          {sortedSessions.length > 0 ? (
            sortedSessions.map((session, index) => (
              <div
                key={session.id}
                onClick={() => onSessionSelect(session.id)}
                className={`px-6 py-4 cursor-pointer transition-all duration-150 hover:bg-gray-50 border-b border-gray-100/50 last:border-b-0 ${
                  session.id === currentSessionId
                    ? 'bg-blue-50 border-r-3 border-blue-500'
                    : ''
                }`}
              >
                <div className={`text-sm font-medium truncate ${
                  session.id === currentSessionId ? 'text-blue-700' : 'text-gray-900'
                }`}>
                  {getSessionDisplayName(session, sessionList)}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {formatCreatedTime(session)}
                </div>
              </div>
            ))
          ) : (
            <div className="px-6 py-8 text-center">
              <div className="flex items-center justify-center w-12 h-12 mx-auto mb-3 bg-gray-100/60 rounded-full">
                <MessageSquare className="w-6 h-6 text-gray-400" />
              </div>
              <p className="text-sm text-gray-500 mb-1">{t('chat:sessionHistory.noSessionsYet')}</p>
              <p className="text-xs text-gray-400">{t('chat:sessionHistory.startNewConversation')}</p>
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}