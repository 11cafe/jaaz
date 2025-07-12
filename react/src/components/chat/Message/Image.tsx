import { Button } from '@/components/ui/button'
import { useCanvas } from '@/contexts/canvas'
import { useTranslation } from 'react-i18next'
import { PhotoView } from 'react-photo-view'

type MessageImageProps = {
  content: {
    image_url: {
      url: string
    }
    type: 'image_url'
  }
}

const MessageImage = ({ content }: MessageImageProps) => {
  const { excalidrawAPI } = useCanvas()
  const files = excalidrawAPI?.getFiles()
  const filesArray = Object.keys(files || {}).map((key) => ({
    id: key,
    url: files![key].dataURL,
  }))

  const { t } = useTranslation()

  const handleImagePositioning = (id: string) => {
    excalidrawAPI?.scrollToContent(id, { animate: true })
  }
  const id = filesArray.find((file) =>
    content.image_url?.url?.includes(file.url)
  )?.id

  return (
    <div>
      <PhotoView src={content.image_url?.url}>
        <div className="relative">
          <img
            className="hover:scale-105 transition-transform duration-300"
            src={content.image_url?.url}
            alt="Image"
          />

          {id && (
            <Button
              variant="secondary"
              className="group-hover:opacity-100 opacity-0 absolute top-2 right-2 z-10"
              onClick={(e) => {
                e.stopPropagation()
                handleImagePositioning(id)
              }}
            >
              {t('chat:messages:imagePositioning')}
            </Button>
          )}
        </div>
      </PhotoView>
    </div>
  )
}

export default MessageImage
