import { Button } from '@/components/ui/button'
import { Hotkey } from '@/components/ui/hotkey'
import { useCanvas } from '@/contexts/canvas'
import { eventBus, TCanvasAddImagesToChatEvent } from '@/lib/event'
import { useKeyPress } from 'ahooks'
import { motion } from 'motion/react'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { exportToCanvas, exportToBlob, exportToSvg } from '@excalidraw/excalidraw'
import { OrderedExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import { toast } from 'sonner'
import { useUserInfo } from '@/hooks/use-user-info'
import { processRemoteImage } from '@/utils/remoteImageProcessor'

type CanvasMagicGeneratorProps = {
  selectedImages: TCanvasAddImagesToChatEvent
  selectedElements: OrderedExcalidrawElement[]
}

const CanvasMagicGenerator = ({ selectedImages, selectedElements }: CanvasMagicGeneratorProps) => {
  const { t } = useTranslation()
  const { excalidrawAPI } = useCanvas()
  const { userInfo } = useUserInfo()

  const handleMagicGenerate = async () => {
    console.log('[CanvasMagicGenerator] 开始Magic Generation流程...')

    if (!excalidrawAPI) {
      console.error('[CanvasMagicGenerator] excalidrawAPI不可用')
      toast.error('Canvas API不可用，请刷新页面重试')
      return
    }

    try {
      // 获取选中的元素
      console.log('[CanvasMagicGenerator] 获取选中的元素...')
      const appState = excalidrawAPI.getAppState()
      const selectedIds = appState.selectedElementIds
      console.log('[CanvasMagicGenerator] 选中的元素ID:', selectedIds)

      if (Object.keys(selectedIds).length === 0) {
        console.warn('[CanvasMagicGenerator] 没有选中任何元素')
        toast.error('请先选中要生成的元素')
        return
      }

      const files = excalidrawAPI.getFiles()
      console.log('[CanvasMagicGenerator] 获取到的文件:', Object.keys(files).length, '个')
      console.log('[CanvasMagicGenerator] 选中的元素数量:', selectedElements.length)

      // 详细分析files对象结构
      const fileIds = Object.keys(files)
      fileIds.forEach((fileId, index) => {
        const file = files[fileId]
        console.log(`[CanvasMagicGenerator] 文件${index + 1} (${fileId}):`, {
          type: typeof file,
          isDataURL: file && typeof file === 'object' && 'dataURL' in file,
          hasUrl: file && typeof file === 'object' && 'url' in file,
          keys: file && typeof file === 'object' ? Object.keys(file) : 'not object',
          dataURLPreview:
            file && file.dataURL ? file.dataURL.substring(0, 50) + '...' : 'no dataURL',
        })

        // 检查是否是远程URL
        if (file && file.dataURL && file.dataURL.startsWith('http')) {
          console.log(`[CanvasMagicGenerator] ⚠️ 检测到远程图片URL: ${file.dataURL}`)
        }
      })

      // 分析选中的图片元素
      const imageElements = selectedElements.filter((element) => element.type === 'image')
      imageElements.forEach((element, index) => {
        console.log(`[CanvasMagicGenerator] 图片元素${index + 1}:`, {
          id: element.id,
          fileId: element.fileId,
          width: element.width,
          height: element.height,
          hasFileId: !!element.fileId,
          fileExists: element.fileId ? !!files[element.fileId] : false,
        })
      })

      // 检查是否包含图片元素（可能导致Canvas污染）
      const hasImages = selectedElements.some((element) => element.type === 'image')
      console.log('[CanvasMagicGenerator] Canvas安全检测:', {
        hasImages,
        imageElementsCount: imageElements.length,
        fileCount: fileIds.length,
        fileIds: fileIds.slice(0, 3), // 只显示前3个文件ID
      })


      // 预处理所有远程图片
      const processedFiles = { ...files }
      const remoteFileIds = fileIds.filter((fileId) => {
        const file = files[fileId]
        return file && file.dataURL && file.dataURL.startsWith('http')
      })

      if (remoteFileIds.length > 0) {
        console.log(`[CanvasMagicGenerator] 检测到 ${remoteFileIds.length} 个远程图片，开始下载...`)
        toast.loading(`正在下载 ${remoteFileIds.length} 个远程图片...`, {
          id: 'download-images',
        })

        try {
          for (let i = 0; i < remoteFileIds.length; i++) {
            const fileId = remoteFileIds[i]
            const file = files[fileId]

            const localDataURL = await processRemoteImage(file.dataURL, userInfo)
            processedFiles[fileId] = {
              ...file,
              dataURL: localDataURL as typeof file.dataURL,
            }
            console.log(`[CanvasMagicGenerator] 远程图片已转换为本地: ${fileId}`)
          }

          console.log(`[CanvasMagicGenerator] 所有远程图片已下载完成，开始导出Canvas`)
        } catch (error) {
          console.error(`[CanvasMagicGenerator] 批量下载远程图片失败:`, error)
          toast.error(`图片下载失败: ${error instanceof Error ? error.message : '未知错误'}`, {
            id: 'download-images',
          })
          return
        }
      } else {
        console.log(`[CanvasMagicGenerator] 未检测到远程图片，直接进行Canvas导出`)
      }

      let base64: string
      let width: number
      let height: number

      if (hasImages && fileIds.length > 0) {
        // 有图片时使用更安全的Blob导出方案
        console.log('[CanvasMagicGenerator] 检测到图片元素，使用Blob导出方案...')

        try {
          const blob = await exportToBlob({
            elements: selectedElements,
            appState: {
              ...appState,
              selectedElementIds: selectedIds,
            },
            files: processedFiles, // 使用处理后的files对象
            mimeType: 'image/png',
            quality: 0.8,
            exportPadding: 10,
          })
          console.log('[CanvasMagicGenerator] Blob导出成功，大小:', blob.size, 'bytes')

          // 将Blob转换为base64
          base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result as string)
            reader.onerror = reject
            reader.readAsDataURL(blob)
          })
          console.log('[CanvasMagicGenerator] Blob转base64成功，长度:', base64.length)

          // 通过创建临时image获取尺寸
          const tempImg = new Image()
          const imgLoad = new Promise<void>((resolve, reject) => {
            tempImg.onload = () => resolve()
            tempImg.onerror = reject
            tempImg.src = base64
          })

          await imgLoad
          width = tempImg.width
          height = tempImg.height
          console.log('[CanvasMagicGenerator] 图片尺寸:', width, 'x', height)
        } catch (blobError) {
          console.warn('[CanvasMagicGenerator] Blob导出失败，尝试SVG转PNG方案:', blobError)

          // Blob失败时尝试SVG导出并转换为PNG
          const svgString = await exportToSvg({
            elements: selectedElements,
            appState: {
              ...appState,
              selectedElementIds: selectedIds,
            },
            files: processedFiles, // 使用处理后的files对象
            exportPadding: 10,
          })
          console.log('[CanvasMagicGenerator] SVG导出成功，长度:', svgString.outerHTML.length)

          // SVG转PNG（通过Canvas）
          const svgWidth = parseInt(svgString.getAttribute('width') || '800')
          const svgHeight = parseInt(svgString.getAttribute('height') || '600')

          // 创建临时Canvas将SVG转换为PNG
          const tempCanvas = document.createElement('canvas')
          const ctx = tempCanvas.getContext('2d')
          tempCanvas.width = svgWidth
          tempCanvas.height = svgHeight

          const img = new Image()
          const svgBlob = new Blob([svgString.outerHTML], { type: 'image/svg+xml' })
          const svgUrl = URL.createObjectURL(svgBlob)

          await new Promise<void>((resolve, reject) => {
            img.onload = () => {
              if (ctx) {
                ctx.drawImage(img, 0, 0)
              }
              URL.revokeObjectURL(svgUrl)
              resolve()
            }
            img.onerror = () => {
              URL.revokeObjectURL(svgUrl)
              reject(new Error('SVG to PNG conversion failed'))
            }
            img.src = svgUrl
          })

          // 转换为PNG base64
          base64 = tempCanvas.toDataURL('image/png', 0.8)
          width = svgWidth
          height = svgHeight
          console.log('[CanvasMagicGenerator] SVG转PNG成功，尺寸:', width, 'x', height)
        }
      } else {
        // 没有图片时使用原来的Canvas导出方案
        console.log('[CanvasMagicGenerator] 无图片元素，使用Canvas导出方案...')

        const canvas = await exportToCanvas({
          elements: selectedElements,
          appState: {
            ...appState,
            selectedElementIds: selectedIds,
          },
          files: processedFiles, // 使用处理后的files对象
          mimeType: 'image/png',
          maxWidthOrHeight: 2048,
          quality: 1,
        })
        console.log(
          '[CanvasMagicGenerator] Canvas导出成功，尺寸:',
          canvas.width,
          'x',
          canvas.height
        )

        try {
          base64 = canvas.toDataURL('image/png', 0.8)
          width = canvas.width
          height = canvas.height
          console.log('[CanvasMagicGenerator] Canvas toDataURL成功，长度:', base64.length)
        } catch (canvasError) {
          console.error('[CanvasMagicGenerator] Canvas被污染，fallback到Blob方案:', canvasError)

          // Canvas被污染时fallback到Blob
          const blob = await exportToBlob({
            elements: selectedElements,
            appState: {
              ...appState,
              selectedElementIds: selectedIds,
            },
            files: processedFiles, // 使用处理后的files对象
            mimeType: 'image/png',
            quality: 0.8,
            exportPadding: 10,
          })

          base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result as string)
            reader.onerror = reject
            reader.readAsDataURL(blob)
          })
          width = canvas.width
          height = canvas.height
          console.log('[CanvasMagicGenerator] Fallback Blob转换成功')
        }
      }

      // 发送魔法生成事件
      const eventData = {
        fileId: `magic-${Date.now()}`,
        base64: base64,
        width: width,
        height: height,
        timestamp: new Date().toISOString(),
      }
      console.log(
        '[CanvasMagicGenerator] 准备发送事件:',
        eventData.fileId,
        '尺寸:',
        width,
        'x',
        height
      )

      eventBus.emit('Canvas::MagicGenerate', eventData)
      console.log('[CanvasMagicGenerator] 事件发送成功')

      // 清除选中状态
      excalidrawAPI?.updateScene({
        appState: { selectedElementIds: {} },
      })
      console.log('[CanvasMagicGenerator] 清除选中状态完成')
    } catch (error) {
      console.error('[CanvasMagicGenerator] Magic Generation过程中发生错误:', error)
      console.error(
        '[CanvasMagicGenerator] 错误堆栈:',
        error instanceof Error ? error.stack : '无堆栈信息'
      )
      toast.error('Magic Generation失败: ' + (error instanceof Error ? error.message : '未知错误'))
    }
  }

  useKeyPress(['meta.b', 'ctrl.b'], handleMagicGenerate)

  return (
    <Button variant='ghost' size='sm' onClick={handleMagicGenerate}>
      {t('canvas:popbar.magicGenerate')} <Hotkey keys={['⌘', 'B']} />
    </Button>
  )
}

export default memo(CanvasMagicGenerator)
