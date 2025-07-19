import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useCanvas } from "@/contexts/canvas"
import { ExcalidrawImageElement } from "@excalidraw/excalidraw/element/types"
import { toast } from "sonner"
import { Share2 } from "lucide-react"
import { Message } from "@/types/types"
import { BASE_API_URL } from "@/constants"

interface ShareTemplateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  canvasId: string
  sessionId: string
  messages: Message[]
}

interface CanvasImage {
  id: string
  fileId: string
  dataURL: string
  width: number
  height: number
}

export default function ShareTemplateDialog({
  open,
  onOpenChange,
  canvasId,
  sessionId,
  messages,
}: ShareTemplateDialogProps) {
  const { t } = useTranslation()
  const { excalidrawAPI } = useCanvas()
  const [templateName, setTemplateName] = useState("")
  const [images, setImages] = useState<CanvasImage[]>([])
  const [selectedCoverImage, setSelectedCoverImage] = useState<string>("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Get canvas images when dialog opens
  useEffect(() => {
    if (open && excalidrawAPI) {
      const elements = excalidrawAPI.getSceneElements()
      const files = excalidrawAPI.getFiles()

      // Filter image elements and get their file data
      const imageElements = elements.filter(
        (element) => element.type === "image" && element.fileId
      ) as ExcalidrawImageElement[]

      const canvasImages: CanvasImage[] = imageElements
        .map((element) => {
          const file = files[element.fileId!]
          if (file) {
            return {
              id: element.id,
              fileId: element.fileId! as string,
              dataURL: file.dataURL as string,
              width: element.width,
              height: element.height,
            }
          }
          return null
        })
        .filter((img): img is CanvasImage => img !== null)

      setImages(canvasImages)
      // Set first image as default cover
      if (canvasImages.length > 0) {
        setSelectedCoverImage(canvasImages[0].fileId)
      }
    }
  }, [open, excalidrawAPI])

  const handleSubmit = async () => {
    if (!templateName.trim()) {
      toast.error(t("chat:shareTemplate.nameRequired"))
      return
    }

    if (!selectedCoverImage) {
      toast.error(t("chat:shareTemplate.coverImageRequired"))
      return
    }

    setIsSubmitting(true)

    try {
      // Get the selected cover image
      const coverImage = images.find((img) => img.fileId === selectedCoverImage)
      if (!coverImage) {
        throw new Error("Cover image not found")
      }

      // Get canvas data
      const elements = excalidrawAPI?.getSceneElements()
      const appState = excalidrawAPI?.getAppState()
      const files = excalidrawAPI?.getFiles()

      if (!elements || !appState || !files) {
        throw new Error("Failed to get canvas data")
      }

      // Prepare template data
      const templateData = {
        name: templateName,
        canvas_id: canvasId,
        session_id: sessionId,
        cover_image: coverImage.dataURL,
        message: messages,
        canvas_data: {
          elements,
          appState: {
            ...appState,
            collaborators: undefined,
          },
          files,
        },
      }

      // Call jaaz-cloud API to create template
      const response = await fetch(`${BASE_API_URL}/api/template/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("jaaz_access_token")}`,
        },
        body: JSON.stringify(templateData),
      })

      if (!response.ok) {
        console.error("Failed to create template", response)
        throw new Error(`Failed to create template ${response}`)
      }

      const result = await response.json()

      toast.success(t("chat:shareTemplate.success"))
      onOpenChange(false)

      // Reset form
      setTemplateName("")
      setSelectedCoverImage("")
    } catch (error) {
      console.error("Error creating template:", error)
      toast.error(t("chat:shareTemplate.error"))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    setTemplateName("")
    setSelectedCoverImage("")
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-[500px]'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <Share2 className='h-5 w-5' />
            {t("chat:shareTemplate.title")}
          </DialogTitle>
        </DialogHeader>

        <div className='space-y-4'>
          {/* Template Name Input */}
          <div className='space-y-2'>
            <Label htmlFor='templateName'>
              {t("chat:shareTemplate.templateName")}
            </Label>
            <Input
              id='templateName'
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder={t("chat:shareTemplate.templateNamePlaceholder")}
            />
          </div>

          {/* Cover Photo Selection */}
          <div className='space-y-2'>
            <Label>{t("chat:shareTemplate.coverPhoto")}</Label>

            {images.length === 0 ? (
              <p className='text-sm text-muted-foreground'>
                {t("chat:shareTemplate.noImagesFound")}
              </p>
            ) : (
              <div className='grid grid-cols-3 gap-2 max-h-64 overflow-y-auto'>
                {images.map((image) => (
                  <div
                    key={image.fileId}
                    className={`relative cursor-pointer rounded-lg border-3 transition-colors ${
                      selectedCoverImage === image.fileId
                        ? "border-blue-500"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                    onClick={() => setSelectedCoverImage(image.fileId)}
                  >
                    <img
                      src={image.dataURL}
                      alt='Canvas image'
                      className='w-full h-20 object-cover rounded-lg'
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className='flex justify-end space-x-2 pt-4'>
            <Button
              variant='outline'
              onClick={handleCancel}
              disabled={isSubmitting}
            >
              {t("common:buttons.cancel")}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={
                isSubmitting || !templateName.trim() || !selectedCoverImage
              }
            >
              {isSubmitting
                ? t("chat:shareTemplate.creating")
                : t("chat:shareTemplate.create")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
