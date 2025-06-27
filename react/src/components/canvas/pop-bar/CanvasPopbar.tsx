import { Button } from '@/components/ui/button'
import { Hotkey } from '@/components/ui/hotkey'
import { useCanvas } from '@/contexts/canvas'
import { eventBus, TCanvasAddImagesToChatEvent } from '@/lib/event'
import { useKeyPress } from 'ahooks'
import { motion } from 'motion/react'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'

// Stable array reference to prevent re-renders
const HOTKEY_KEYS = ['⌘', '↩︎']

type CanvasPopbarProps = {
  pos: { x: number; y: number }
  selectedImages: TCanvasAddImagesToChatEvent
}

const CanvasPopbar = ({ pos, selectedImages }: CanvasPopbarProps) => {
  const { t } = useTranslation()
  const { excalidrawAPI } = useCanvas()

  const handleAddToChat = () => {
    eventBus.emit('Canvas::AddImagesToChat', selectedImages)
    excalidrawAPI?.updateScene({
      appState: { selectedElementIds: {} },
    })
  }

  useKeyPress(['meta.enter', 'ctrl.enter'], handleAddToChat)

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
      <div className="flex items-center gap-1 bg-primary-foreground/75 backdrop-blur-lg rounded-lg p-1 shadow-[0_5px_10px_rgba(0,0,0,0.08)] border border-primary/10 pointer-events-auto">
        <Button variant="ghost" size="sm" onClick={handleAddToChat}>
          {t('canvas:popbar.addToChat')} <Hotkey keys={HOTKEY_KEYS} />
        </Button>
      </div>
    </motion.div>
  )
}

export default memo(CanvasPopbar)
