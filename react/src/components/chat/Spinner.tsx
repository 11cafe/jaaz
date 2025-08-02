import { PendingType } from '@/types/types'
import {
  Brush,
  Hammer,
  Loader2,
  Paintbrush,
  PenTool,
  ScanSearch,
  Telescope,
  Video,
} from 'lucide-react'
import ShinyText from '../ui/shiny-text'
import IconCarousel from './IconCarousel'

const ChatSpinner: React.FC<{ pending: PendingType }> = ({ pending }) => {
  return (
    <div className="flex items-center justify-start select-none gap-1">
      {pending === 'image' ? (
        <>
          <Paintbrush className="animate-caret-blink size-4 text-primary/60 brush-icon-animation" />
          <ShinyText
            text="Generating image..."
            className="text-sm text-primary/60!"
            speed={2.5}
          />
        </>
      ) : pending === 'video' ? (
        <>
          <Video className="animate-pulse size-4 text-primary/60" />
          <ShinyText
            text="Generating video..."
            className="text-sm text-primary/60!"
            speed={2.5}
          />
        </>
      ) : pending === 'tool' ? (
        <>
          <IconCarousel
            icons={[
              <PenTool />,
              <Telescope />,
              <Brush />,
              <Hammer />,
              <ScanSearch />,
            ]}
            className="text-primary/60"
            iconClassName="size-4"
            time={1500}
          />
          <ShinyText
            text="Using tools..."
            className="text-sm text-primary/60!"
            speed={2.5}
          />
        </>
      ) : (
        <>
          <Loader2 className="animate-spin size-4 text-primary/60" />
          <ShinyText
            text="Thinking..."
            className="text-sm text-primary/60!"
            speed={2.5}
          />
        </>
      )}
    </div>
  )
}

export default ChatSpinner
