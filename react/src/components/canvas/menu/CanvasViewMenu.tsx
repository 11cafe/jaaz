import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useCanvas } from '@/contexts/canvas'
import { cn } from '@/lib/utils'
import { Minus, Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

const CanvasViewMenu = () => {
  const { t } = useTranslation()
  const { excalidrawAPI } = useCanvas()

  const [currentZoom, setCurrentZoom] = useState<number>(100)

  const handleZoomChange = (zoom: number) => {
    excalidrawAPI?.updateScene({
      appState: {
        zoom: {
          // @ts-ignore
          value: zoom / 100,
        },
      },
    })
  }

  const handleZoomFit = () => {
    excalidrawAPI?.scrollToContent(undefined, {
      fitToContent: true,
      animate: true,
    })
  }

  excalidrawAPI?.onChange((_elements, appState, _files) => {
    const zoom = (appState.zoom.value * 100).toFixed(0)
    setCurrentZoom(Number(zoom))
  })

  return (
    <div
      className={cn(
        'absolute top-16 left-32 md:bottom-5 md:top-auto md:left-32 flex items-center gap-1.5 rounded-xl p-1.5 z-20 transition-all duration-300 select-none',
        'bg-white/80 backdrop-blur-md border border-white/40 shadow-lg text-slate-700 hover:bg-white/90'
      )}
    >
      <Button
        className="size-7"
        variant="ghost"
        size="icon"
        onClick={() => handleZoomChange(currentZoom - 10)}
      >
        <Minus />
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <span className="text-xs w-10 text-center font-medium">{currentZoom}%</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {[10, 50, 100, 150, 200].map((zoom) => (
            <DropdownMenuItem key={zoom} onClick={() => handleZoomChange(zoom)}>
              {zoom}%
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleZoomFit}>
            {t('canvas:tool.zoomFit')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Button
        className="size-7"
        variant="ghost"
        size="icon"
        onClick={() => handleZoomChange(currentZoom + 10)}
      >
        <Plus />
      </Button>
    </div>
  )
}

export default CanvasViewMenu
