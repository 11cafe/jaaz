import { getCanvas, renameCanvas } from '@/api/canvas'
import CanvasExcali from '@/components/canvas/CanvasExcali'
import CanvasHeader from '@/components/canvas/CanvasHeader'
import ChatInterface from '@/components/chat/Chat'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable'
import { CanvasProvider } from '@/contexts/canvas'
import { Session } from '@/types/types'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useParams, useSearch } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { nanoid } from 'nanoid'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

export const Route = createFileRoute('/canvas/$id')({
  component: Canvas,
})

function Canvas() {
  const [canvasName, setCanvasName] = useState('')
  const [session, setSession] = useState<Session | null>(null)
  const [sessionList, setSessionList] = useState<Session[]>([])
  const { t } = useTranslation()

  const { id } = useParams({ from: '/canvas/$id' })
  const search = useSearch({ from: '/canvas/$id' }) as { sessionId: string }

  const canvasKey = useRef(nanoid())

  const { data: canvas, isLoading } = useQuery({
    queryKey: ['canvas', id],
    queryFn: () => getCanvas(id),
  })

  useEffect(() => {
    console.log('👇canvas', canvas)
    canvasKey.current = nanoid()
    if (canvas && !canvasName && sessionList.length === 0) {
      setCanvasName(canvas.name)
      setSessionList(canvas.sessions)
      if (canvas.sessions.length > 0) {
        if (search.sessionId) {
          setSession(
            canvas.sessions.find((s) => s.id === search.sessionId) || null
          )
        } else {
          setSession(canvas.sessions[0])
        }
      }
    }
  }, [canvas, search.sessionId, canvasName, sessionList])

  const handleNameSave = async () => {
    await renameCanvas(id, canvasName)
  }

  const handleNewChat = () => {
    const newSession: Session = {
      id: nanoid(),
      title: t('chat:newChat'),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      model: session?.model || 'gpt-4o',
      provider: session?.provider || 'openai',
    }
    setSession(newSession)
    setSessionList((prev) => [...prev, newSession])
  }

  const handleSessionChange = (sessionId: string) => {
    setSession(canvas?.sessions.find((s) => s.id === sessionId) || null)
    window.history.pushState({}, '', `/canvas/${id}?sessionId=${sessionId}`)
  }

  return (
    <CanvasProvider>
      <div className="flex flex-col w-screen h-screen">
        <CanvasHeader
          canvasName={canvasName}
          canvasId={id}
          onNameChange={setCanvasName}
          onNameSave={handleNameSave}
        />
        <ResizablePanelGroup
          direction="horizontal"
          className="w-screen h-screen"
          autoSaveId="jaaz-chat-panel"
        >
          <ResizablePanel className="relative" defaultSize={80}>
            <div className="w-full h-full">
              {isLoading ? (
                <div className="flex-1 flex-grow px-4 bg-accent w-[24%] absolute right-0">
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="w-4 h-4 animate-spin" />
                  </div>
                </div>
              ) : (
                <CanvasExcali
                  key={canvasKey.current}
                  canvasId={id}
                  initialData={canvas?.data}
                />
              )}
            </div>
          </ResizablePanel>

          <ResizableHandle />

          <ResizablePanel defaultSize={25} maxSize={35} minSize={25}>
            <div className="flex-1 flex-grow bg-accent/50 w-full">
              <ChatInterface
                canvasId={id}
                session={session}
                sessionList={sessionList}
                onClickNewChat={handleNewChat}
                onSessionChange={handleSessionChange}
              />
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </CanvasProvider>
  )
}
