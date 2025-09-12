import { useCanvas } from '@/contexts/canvas'
import { TCanvasAddImagesToChatEvent } from '@/lib/event'
import { motion } from 'motion/react'
import { memo } from 'react'
import { OrderedExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import CanvasMagicGenerator from './CanvasMagicGenerator'
import CanvasPopbar from './CanvasPopbar'

type CanvasPopbarContainerProps = {
    pos: { x: number; y: number }
    selectedImages: TCanvasAddImagesToChatEvent
    selectedElements: OrderedExcalidrawElement[]
    showAddToChat: boolean
    showMagicGenerate: boolean
}

const CanvasPopbarContainer = ({
    pos,
    selectedImages,
    selectedElements,
    showAddToChat,
    showMagicGenerate
}: CanvasPopbarContainerProps) => {

    return (
        <motion.div
            initial={{ opacity: 0, y: -3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -3 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="absolute z-20 flex items-center gap-1 -translate-x-1/2 "
            style={{
                left: `${pos.x}px`,
                top: `${pos.y + 5}px`,
            }}
        >
            <div className="flex items-center gap-1 bg-white/85 backdrop-blur-md rounded-xl p-1.5 shadow-lg border border-white/40 pointer-events-auto">
                {showAddToChat && (
                    <CanvasPopbar selectedImages={selectedImages} />
                )}
                {showMagicGenerate && (
                    <CanvasMagicGenerator selectedImages={selectedImages} selectedElements={selectedElements} />
                )}
            </div>
        </motion.div>
    )
}

export default memo(CanvasPopbarContainer) 