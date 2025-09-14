import { Button } from '@/components/ui/button'
import { SessionHistoryDropdown } from './SessionHistoryDropdown'
import { EditableTitle } from './EditableTitle'
import { Session } from '@/types/types'
import { Plus, Minimize2 } from 'lucide-react'
import { getSessionDisplayName } from '@/utils/sessionUtils'

interface ChatPanelHeaderProps {
  sessionList: Session[]
  currentSessionId: string
  onClose: () => void
  onNewSession: () => void
  onSessionSelect: (sessionId: string) => void
  onSessionNameChange?: (sessionId: string, newName: string) => void
}

export function ChatPanelHeader({
  sessionList,
  currentSessionId,
  onClose,
  onNewSession,
  onSessionSelect,
  onSessionNameChange
}: ChatPanelHeaderProps) {
  // 获取当前session
  const currentSession = sessionList.find(session => session.id === currentSessionId)
  const sessionName = getSessionDisplayName(currentSession, sessionList)

  // 处理session名称变更
  const handleSessionNameSave = (newName: string) => {
    if (onSessionNameChange && currentSessionId) {
      onSessionNameChange(currentSessionId, newName)
    }
  }
  return (
    <div className="flex items-center justify-between px-3 md:px-4 py-2 md:py-3 border-b border-gray-200/50 bg-white/50 backdrop-blur-sm">
      {/* 左侧：Session名称 */}
      <div className="flex-1 min-w-0">
        <EditableTitle
          title={sessionName}
          onSave={handleSessionNameSave}
          placeholder="新对话"
          maxLength={100}
          className="min-w-0 text-sm md:text-base"
        />
      </div>

      {/* 右侧：功能按钮 */}
      <div className="flex items-center gap-0.5 md:gap-1 ml-1 md:ml-2">
        {/* 新建按钮 */}
        <Button
          onClick={onNewSession}
          size="sm"
          variant="ghost"
          className="p-1 md:p-1.5 h-auto w-auto rounded-md hover:bg-gray-100/80 transition-colors"
          title="新建对话"
        >
          <Plus className="w-3.5 h-3.5 md:w-4 md:h-4 text-gray-600" />
        </Button>

        {/* 历史会话下拉菜单 */}
        <SessionHistoryDropdown
          sessionList={sessionList}
          currentSessionId={currentSessionId}
          onSessionSelect={onSessionSelect}
          onNewSession={onNewSession}
        />

        {/* Hide Chat按钮 */}
        <Button
          onClick={onClose}
          size="sm"
          variant="ghost"
          className="p-1 md:p-1.5 h-auto w-auto rounded-md hover:bg-gray-100/80 transition-colors ml-0.5 md:ml-1"
          title="Hide Chat"
        >
          <Minimize2 className="w-3.5 h-3.5 md:w-4 md:h-4 text-gray-600" />
        </Button>
      </div>
    </div>
  )
}