import { Separator } from '@/components/ui/separator'
import { useCanvas } from '@/contexts/canvas'
import { useState } from 'react'
import CanvasMenuButton from './CanvasMenuButton'
import { ToolType } from './CanvasMenuIcon'

const CanvasToolMenu = () => {
  const { excalidrawAPI } = useCanvas()

  const [activeTool, setActiveTool] = useState<ToolType | undefined>(undefined)

  const handleToolChange = (tool: ToolType) => {
    excalidrawAPI?.setActiveTool({ type: tool })
  }

  excalidrawAPI?.onChange((_elements, appState, _files) => {
    setActiveTool(appState.activeTool.type as ToolType)
  })

  const tools: (ToolType | null)[] = [
    'hand',
    'selection',
    null,
    'rectangle',
    'ellipse',
    'arrow',
    'line',
    'freedraw',
    null,
    'text',
    'image',
  ]

  return (
    <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 bg-white/85 backdrop-blur-md rounded-xl p-1.5 shadow-lg border border-white/40">
      {tools.map((tool, index) =>
        tool ? (
          <CanvasMenuButton
            key={tool}
            type={tool}
            activeTool={activeTool}
            onClick={() => handleToolChange(tool)}
          />
        ) : (
          <Separator
            key={index}
            orientation="vertical"
            className="h-6! bg-primary/5"
          />
        )
      )}
    </div>
  )
}

export default CanvasToolMenu
