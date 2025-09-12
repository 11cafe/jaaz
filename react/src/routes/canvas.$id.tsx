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

// 检测是否是图片文件
function isImageUrl(url: string): boolean {
  const imageExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif', '.bmp']
  const lowerUrl = url.toLowerCase()
  return imageExtensions.some(ext => lowerUrl.includes(ext))
}

// 检测是否是腾讯云COS URL
function isTencentCosUrl(url: string): boolean {
  return url.includes('.cos.') && url.includes('.myqcloud.com')
}

// 为腾讯云图片URL添加压缩参数
function addCompressionParams(url: string): string {
  // 检查是否已经包含 imageMogr2 参数
  if (url.includes('imageMogr2')) {
    return url
  }
  
  // 检查URL中是否已有参数
  const hasParams = url.includes('?')
  const compressionParam = 'imageMogr2/thumbnail/avif'
  
  if (hasParams) {
    // 已有参数，使用 & 连接
    return `${url}&${compressionParam}`
  } else {
    // 没有参数，使用 ? 连接
    return `${url}?${compressionParam}`
  }
}

// 将旧格式的图片URL转换为优化格式，支持重定向URL和腾讯云压缩参数
function convertLegacyImageUrls(canvasData: any) {
  if (canvasData?.data?.files) {
    const files = canvasData.data.files
    Object.keys(files).forEach(fileId => {
      const file = files[fileId]
      if (file?.dataURL && typeof file.dataURL === 'string') {
        let originalUrl = file.dataURL
        let convertedUrl = originalUrl
        
        // 处理本地 API 格式的 URL
        if (originalUrl.startsWith('/api/file/') && !originalUrl.includes('?redirect=true')) {
          convertedUrl = `${originalUrl}?redirect=true`
          console.log(`🔄 转换本地API URL: ${fileId} -> ${convertedUrl}`)
        }
        // 处理腾讯云COS直链URL
        else if (isTencentCosUrl(originalUrl) && isImageUrl(originalUrl)) {
          convertedUrl = addCompressionParams(originalUrl)
          if (convertedUrl !== originalUrl) {
            console.log(`🗜️ 添加腾讯云压缩参数: ${fileId} -> ${convertedUrl}`)
          }
        }
        
        // 更新URL
        if (convertedUrl !== originalUrl) {
          file.dataURL = convertedUrl
        }
      }
    })
  }
  return canvasData
}

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
        
        // 转换旧格式的图片URL为重定向格式
        const convertedData = convertLegacyImageUrls(data)

        if (mounted) {
          setCanvas(convertedData)
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
        <div className='flex flex-col w-screen h-screen bg-soft-blue-radial'>
          <CanvasHeader
            canvasName='加载中...'
            canvasId={id}
            onNameChange={() => {}}
            onNameSave={() => {}}
          />
          <div className='flex items-center justify-center h-full'>
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
        <div className='flex flex-col w-screen h-screen bg-soft-blue-radial'>
          <CanvasHeader
            canvasName='加载失败'
            canvasId={id}
            onNameChange={() => {}}
            onNameSave={() => {}}
          />
          <div className='flex items-center justify-center h-full'>
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
      <div className='flex flex-col w-screen h-screen bg-soft-blue-radial'>
        <CanvasHeader
          canvasName={canvasName}
          canvasId={id}
          onNameChange={setCanvasName}
          onNameSave={handleNameSave}
        />
        <ResizablePanelGroup
          direction='horizontal'
          className='w-screen h-screen py-2'
          autoSaveId='jaaz-chat-panel'
        >
          <ResizablePanel className='relative' defaultSize={75}>
            <div className='w-full h-full p-4 pr-2'>
              <div className='relative w-full h-full bg-white rounded-2xl shadow-xl border border-white/50 backdrop-blur-sm'>
                <CanvasExcali canvasId={id} initialData={canvas?.data} />
                <CanvasMenu />
                <CanvasPopbarWrapper />
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle className="bg-transparent hover:bg-white/20 transition-colors duration-300 w-2" />

          <ResizablePanel defaultSize={25}>
            <div className='w-full h-full p-4 pl-2'>
              <div className='w-full h-full bg-white/60 backdrop-blur-lg rounded-2xl shadow-xl border border-white/40'>
                <ChatInterface
                  canvasId={id}
                  sessionList={sessionList}
                  setSessionList={setSessionList}
                  sessionId={searchSessionId}
                />
              </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </CanvasProvider>
  )
}
