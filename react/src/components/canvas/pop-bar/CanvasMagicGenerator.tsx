import { Button } from '@/components/ui/button'
import { Hotkey } from '@/components/ui/hotkey'
import { useCanvas } from '@/contexts/canvas'
import { eventBus, TCanvasAddImagesToChatEvent } from '@/lib/event'
import { useKeyPress } from 'ahooks'
import { motion } from 'motion/react'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { exportToBlob } from "@excalidraw/excalidraw";
import { OrderedExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import { toast } from 'sonner'
import { BinaryFiles } from '@excalidraw/excalidraw/types'

type CanvasMagicGeneratorProps = {
    selectedImages: TCanvasAddImagesToChatEvent
    selectedElements: OrderedExcalidrawElement[]
}

const CanvasMagicGenerator = ({ selectedImages, selectedElements }: CanvasMagicGeneratorProps) => {
    const { t } = useTranslation()
    const { excalidrawAPI } = useCanvas()

    const handleMagicGenerate = async (type: 'image' | 'video') => {
        if (!excalidrawAPI) return;

        // 获取选中的元素
        const appState = excalidrawAPI.getAppState();
        const selectedIds = appState.selectedElementIds;
        if (Object.keys(selectedIds).length === 0) {
            console.log('没有选中任何元素');
            return;
        }

        const files = excalidrawAPI.getFiles();

        // Create a new files object for export, with proxied URLs for external images
        const filesForExport: BinaryFiles = {};
        for (const fileId in files) {
            const file = files[fileId];
            if (file.dataURL?.startsWith('http')) {
                // 使用 代理地址，避免跨域问题
                const proxiedUrl = `/api/image/proxy?url=${encodeURIComponent(file.dataURL)}`;
                filesForExport[fileId] = { ...file, dataURL: proxiedUrl as any};
            } else {
                filesForExport[fileId] = file;
            }
        }


        try {
            // 使用官方SDK导出blob
            const blob = await exportToBlob({
                elements: selectedElements,
                appState: {
                    ...appState,
                    selectedElementIds: selectedIds,
                },
                files: filesForExport,
                mimeType: 'image/png',
                maxWidthOrHeight: 2048,
                quality: 1,
            });

            // 将blob转换为base64
            const base64 = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => {
                    resolve(reader.result as string);
                };
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });

            // 发送魔法生成事件
            eventBus.emit('Canvas::MagicGenerate', {
                fileId: `magic-${Date.now()}`,
                base64: base64,
                width: 2048, // 使用maxWidthOrHeight的值
                height: 2048, // 实际高度会根据宽高比计算
                timestamp: new Date().toISOString(),
                type: type, // 添加type参数
            });

            // 清除选中状态
            excalidrawAPI?.updateScene({
                appState: { selectedElementIds: {} },
            });

            // toast.success('Canvas exported successfully');
        } catch (error) {
            console.error('Failed to export canvas:', error);
            toast.error('Failed to export canvas');
        }
    }

    const handleMagicGenerateImage = () => handleMagicGenerate('image')
    const handleMagicGenerateVideo = () => handleMagicGenerate('video')

    useKeyPress(['meta.b', 'ctrl.b'], handleMagicGenerateImage)
    useKeyPress(['meta.g', 'ctrl.g'], handleMagicGenerateVideo)

    return (
        <>  
        <Button variant="ghost" size="sm" onClick={handleMagicGenerateImage}>
            {t('canvas:popbar.magicGenerateImage')} <Hotkey keys={['⌘', 'B']} />
        </Button>
        <Button variant="ghost" size="sm" onClick={handleMagicGenerateVideo}>
        {t('canvas:popbar.magicGenerateVideo')} <Hotkey keys={['⌘', 'G']} />
        </Button>
        </>
    )
}

export default memo(CanvasMagicGenerator)
