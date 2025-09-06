import { getCanvas, renameCanvas } from '@/api/canvas'
import CanvasExcali from '@/components/canvas/CanvasExcali'
import CanvasHeader from '@/components/canvas/CanvasHeader'
import CanvasMenu from '@/components/canvas/menu'
import CanvasPopbarWrapper from '@/components/canvas/pop-bar'
// VideoCanvasOverlay removed - using native Excalidraw embeddable elements instead
import ChatInterface from '@/components/chat/Chat'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { CanvasProvider } from '@/contexts/canvas'
import { Session } from '@/types/types'
import { createFileRoute, useParams, useSearch } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'

export const Route = createFileRoute('/canvas/$id')({
  component: Canvas,
})

function Canvas() {
  const { id } = useParams({ from: '/canvas/$id' })
  const [canvas, setCanvas] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [canvasName, setCanvasName] = useState('')
  const [sessionList, setSessionList] = useState<Session[]>([])
  // initialVideos removed - using native Excalidraw embeddable elements instead
  const search = useSearch({ from: '/canvas/$id' }) as {
    sessionId: string
  }
  const searchSessionId = search?.sessionId || ''
  useEffect(() => {
    let mounted = true

    const fetchCanvas = async () => {
      try {
        const startTime = performance.now()
        setIsLoading(true)
        setError(null)
        const data = await getCanvas(id)
        const endTime = performance.now()

        if (mounted) {
          setCanvas(data)
          setCanvasName(data.name)
          setSessionList(data.sessions)
          // Video elements now handled by native Excalidraw embeddable elements
        }
      } catch (err) {
        console.error('[debug] Canvas数据获取失败:', err)
        if (mounted) {
          setError(err instanceof Error ? err : new Error('Failed to fetch canvas data'))
          console.error('Failed to fetch canvas data:', err)
        }
      } finally {
        if (mounted) {
          setIsLoading(false)
        }
      }
    }

    fetchCanvas()

    return () => {
      mounted = false
    }
  }, [id])

  const handleNameSave = async () => {
    await renameCanvas(id, canvasName)
  }

  if (isLoading) {
    return (
      <CanvasProvider>
        <div className='flex flex-col w-screen h-screen'>
          <CanvasHeader
            canvasName='加载中...'
            canvasId={id}
            onNameChange={() => {}}
            onNameSave={() => {}}
          />
          <div className='flex items-center justify-center h-full bg-background/50'>
            <div className='flex flex-col items-center gap-4'>
              <Loader2 className='w-8 h-8 animate-spin text-primary' />
              <p className='text-muted-foreground'>正在加载画布...</p>
            </div>
          </div>
        </div>
      </CanvasProvider>
    )
  }

  if (error) {
    return (
      <CanvasProvider>
        <div className='flex flex-col w-screen h-screen'>
          <CanvasHeader
            canvasName='加载失败'
            canvasId={id}
            onNameChange={() => {}}
            onNameSave={() => {}}
          />
          <div className='flex items-center justify-center h-full bg-background/50'>
            <div className='flex flex-col items-center gap-4'>
              <p className='text-red-500'>加载失败: {error.message}</p>
              <button
                onClick={() => window.location.reload()}
                className='px-4 py-2 bg-primary text-primary-foreground rounded'
              >
                重试
              </button>
            </div>
          </div>
        </div>
      </CanvasProvider>
    )
  }

  return (
    <CanvasProvider>
      <div className='flex flex-col w-screen h-screen'>
        <CanvasHeader
          canvasName={canvasName}
          canvasId={id}
          onNameChange={setCanvasName}
          onNameSave={handleNameSave}
        />
        <ResizablePanelGroup
          direction='horizontal'
          className='w-screen h-screen'
          autoSaveId='jaaz-chat-panel'
        >
          <ResizablePanel className='relative' defaultSize={75}>
            <div className='w-full h-full'>
              <div className='relative w-full h-full'>
                <CanvasExcali canvasId={id} initialData={canvas?.data} />
                <CanvasMenu />
                <CanvasPopbarWrapper />
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle />

          <ResizablePanel defaultSize={25}>
            <div className='flex-1 flex-grow bg-accent/50 w-full'>
              <ChatInterface
                canvasId={id}
                sessionList={sessionList}
                setSessionList={setSessionList}
                sessionId={searchSessionId}
              />
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </CanvasProvider>
  )
}
