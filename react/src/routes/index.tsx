import CanvasExcali from '@/components/canvas/CanvasExcali'
import ChatInterface from '@/components/chat/Chat'
import LeftSidebar from '@/components/sidebar/LeftSidebar'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/hooks/use-theme'
import { EAgentState, Message } from '@/types/types'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { MessageCircleIcon } from 'lucide-react'
import { nanoid } from 'nanoid'
import { useEffect, useState } from 'react'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  const [agentState, setAgentState] = useState(EAgentState.IDLE)
  const [messages, setMessages] = useState<Message[]>([])
  const [currentStep, setCurrentStep] = useState(0)
  const [maxSteps, setMaxSteps] = useState(0)
  const [totalTokens, setTotalTokens] = useState(0)
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(false)
  const [sessionId, setSessionId] = useState<string>(nanoid())
  const [editorTitle, setEditorTitle] = useState('')
  const [editorContent, setEditorContent] = useState('')
  const { setTheme, theme } = useTheme()
  const [curFile, setCurFile] = useState('')
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    fetch('/api/config/exists')
      .then((res) => res.json())
      .then((data) => {
        if (!data.exists) {
          navigate({ to: '/settings' })
        }
      })
  }, [navigate])

  return (
    <div className="flex">
      <div
        style={{
          position: 'fixed',
          right: '24%',
          top: 0,
          bottom: 0,
          left: 0,
        }}
      >
        <CanvasExcali />
      </div>

      <div className="flex-1 flex-grow px-4 bg-accent w-[24%] absolute right-0">
        <ChatInterface
          sessionId={sessionId}
          editorTitle={editorTitle}
          editorContent={editorContent}
          onClickNewChat={() => {
            setSessionId(nanoid())
          }}
        />

        {/* <div className="absolute top-5 right-8 flex gap-1">
          <Button
            size={"sm"}
            onClick={() => setIsRightSidebarOpen(!isRightSidebarOpen)}
          >
            {isRightSidebarOpen ? (
              <SidebarOpenIcon />
            ) : (
              <div className="flex">
                <ChevronLeftIcon />
                <ComputerIcon />
              </div>
            )}
          </Button>
        </div> */}
      </div>
      {isLeftSidebarOpen && (
        <div className="fixed left-0 top-0 w-[20%] bg-sidebar h-screen">
          <LeftSidebar
            sessionId={sessionId}
            setSessionId={setSessionId}
            curFile={curFile}
            setCurFile={setCurFile}
            onClose={() => setIsLeftSidebarOpen(false)}
          />
        </div>
      )}
      {!isLeftSidebarOpen && (
        <div className="fixed left-[60px] top-[16px]">
          <Button
            onClick={() => setIsLeftSidebarOpen(true)}
            variant={'secondary'}
          >
            <MessageCircleIcon />
          </Button>
        </div>
      )}
    </div>
  )
}
