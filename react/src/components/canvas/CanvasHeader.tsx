import { Input } from '@/components/ui/input'
import TopMenu from '../TopMenu'

type CanvasHeaderProps = {
  canvasName: string
  canvasId: string
  onNameChange: (name: string) => void
  onNameSave: () => void
}

const CanvasHeader: React.FC<CanvasHeaderProps> = ({
  canvasName,
  canvasId,
  onNameChange,
  onNameSave,
}) => {
  return (
    <TopMenu
      middle={
        <div className="hidden sm:block">
          <Input
            className="text-sm text-muted-foreground text-center bg-transparent border-none shadow-none w-fit h-7 hover:bg-primary-foreground transition-all"
            value={canvasName}
            onChange={(e) => onNameChange(e.target.value)}
            onBlur={onNameSave}
          />
        </div>
      }
    />
  )
}

export default CanvasHeader
