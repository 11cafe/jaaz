import { useState } from 'react'
import { Button } from '@/components/ui/button'
import ChatInterface from '@/components/chat/Chat'
import { ChatPanelHeader } from './ChatPanelHeader'
import { Session } from '@/types/types'
import { MessageCircle, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useNavigate } from '@tanstack/react-router'

interface FloatingChatPanelProps {
  canvasId: string
  sessionList: Session[]
  setSessionList: (sessions: Session[]) => void
  sessionId: string
  onNewSession?: () => void
  onSessionNameChange?: (sessionId: string, newName: string) => void
}

export function FloatingChatPanel({
  canvasId,
  sessionList,
  setSessionList,
  sessionId,
  onNewSession,
  onSessionNameChange,
}: FloatingChatPanelProps) {
  const [isOpen, setIsOpen] = useState(true)
  const navigate = useNavigate()

  // 新建会话 - 现在直接调用传入的回调
  const handleNewSession = () => {
    onNewSession?.()
  }

  // 切换会话
  const handleSessionSelect = (newSessionId: string) => {
    // 跳转到指定会话
    navigate({
      to: '/canvas/$id',
      params: { id: canvasId },
      search: { sessionId: newSessionId }
    })
  }

  return (
    <>
      {/* 聊天切换按钮 */}
      {!isOpen && (
        <div className="absolute top-4 right-4 z-50">
          <Button
            onClick={() => setIsOpen(true)}
            size="sm"
            className="p-3 h-auto w-auto rounded-full bg-white/90 backdrop-blur-md border border-gray-200/50 shadow-lg hover:bg-white hover:scale-105 transition-all duration-200"
          >
            <MessageCircle className="w-5 h-5 text-gray-700" />
          </Button>
        </div>
      )}

      {/* 浮动聊天窗口 - 只在桌面端显示 */}
      <div
        className={cn(
          'hidden md:block absolute top-4 right-4 bottom-4 z-40 transition-all duration-300 ease-in-out',
          isOpen ? 'w-[25vw] opacity-100 translate-x-0' : 'w-0 opacity-0 translate-x-full',
          'min-w-[320px] max-w-[480px]' // 设置最小和最大宽度限制
        )}
      >
        <div className="relative w-full h-full bg-white/95 backdrop-blur-lg rounded-xl shadow-2xl border border-gray-200/50 overflow-hidden flex flex-col">
          {/* 功能栏 */}
          <ChatPanelHeader
            sessionList={sessionList}
            currentSessionId={sessionId}
            onClose={() => setIsOpen(false)}
            onNewSession={handleNewSession}
            onSessionSelect={handleSessionSelect}
            onSessionNameChange={onSessionNameChange}
          />

          {/* 聊天界面 */}
          <div className="flex-1 overflow-hidden">
            <ChatInterface
              canvasId={canvasId}
              sessionList={sessionList}
              setSessionList={setSessionList}
              sessionId={sessionId}
            />
          </div>
        </div>
      </div>

      {/* 移动端适配：小屏幕时的全屏模式 */}
      {isOpen && (
        <div className="md:hidden absolute inset-0 z-40 bg-white flex flex-col">
          {/* 移动端功能栏 */}
          <ChatPanelHeader
            sessionList={sessionList}
            currentSessionId={sessionId}
            onClose={() => setIsOpen(false)}
            onNewSession={handleNewSession}
            onSessionSelect={handleSessionSelect}
            onSessionNameChange={onSessionNameChange}
          />

          {/* 移动端聊天界面 */}
          <div className="flex-1 overflow-hidden">
            <ChatInterface
              canvasId={canvasId}
              sessionList={sessionList}
              setSessionList={setSessionList}
              sessionId={sessionId}
            />
          </div>
        </div>
      )}
    </>
  )
}