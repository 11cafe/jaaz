import { cancelChat } from '@/api/chat'
import { cancelMagicGenerate } from '@/api/magic'
import { uploadImage } from '@/api/upload'
import { Button } from '@/components/ui/button'
import { useConfigs } from '@/contexts/configs'
import {
  eventBus,
  TCanvasAddImagesToChatEvent,
  TMaterialAddImagesToChatEvent,
} from '@/lib/event'
import { cn, dataURLToFile } from '@/lib/utils'
import { Message, MessageContent, Model } from '@/types/types'
import { ModelInfo, ToolInfo } from '@/api/model'
import { useMutation } from '@tanstack/react-query'
import { useDrop } from 'ahooks'
import { produce } from 'immer'
import {
  ArrowUp,
  Loader2,
  PlusIcon,
  Square,
  XIcon,
  RectangleVertical,
  ChevronDown,
  Hash,
} from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import Textarea, { TextAreaRef } from 'rc-textarea'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import ModelSelector from './ModelSelector'
import ModelSelectorV2 from './ModelSelectorV2'
import { useAuth } from '@/contexts/AuthContext'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

type ChatTextareaProps = {
  pending: boolean
  className?: string
  messages: Message[]
  sessionId?: string
  onSendMessages: (
    data: Message[],
    configs: {
      textModel: Model
      toolList: ToolInfo[]
    }
  ) => void
  onCancelChat?: () => void
}

const ChatTextarea: React.FC<ChatTextareaProps> = ({
  pending,
  className,
  messages,
  sessionId,
  onSendMessages,
  onCancelChat,
}) => {
  const { t } = useTranslation()
  const { authStatus } = useAuth()
  const { textModel, selectedTools, setShowLoginDialog } = useConfigs()
  const [prompt, setPrompt] = useState('')
  const textareaRef = useRef<TextAreaRef>(null)
  const [images, setImages] = useState<
    {
      file_id: string
      width: number
      height: number
    }[]
  >([])
  const [isFocused, setIsFocused] = useState(false)
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<string>('auto')
  const [quantity, setQuantity] = useState<number>(1)
  const [showQuantitySlider, setShowQuantitySlider] = useState(false)
  const quantitySliderRef = useRef<HTMLDivElement>(null)
  const MAX_QUANTITY = 30

  const imageInputRef = useRef<HTMLInputElement>(null)

  const { mutate: uploadImageMutation } = useMutation({
    mutationFn: (file: File) => uploadImage(file),
    onSuccess: (data) => {
      console.log('🦄uploadImageMutation onSuccess', data)
      setImages((prev) => [
        ...prev,
        {
          file_id: data.file_id,
          width: data.width,
          height: data.height,
        },
      ])
    },
    onError: (error) => {
      console.error('🦄uploadImageMutation onError', error)
      toast.error('Failed to upload image', {
        description: <div>{error.toString()}</div>,
      })
    },
  })

  const handleImagesUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files
      if (files) {
        for (const file of files) {
          uploadImageMutation(file)
        }
      }
    },
    [uploadImageMutation]
  )

  const handleCancelChat = useCallback(async () => {
    if (sessionId) {
      // 同时取消普通聊天和魔法生成任务
      await Promise.all([cancelChat(sessionId), cancelMagicGenerate(sessionId)])
    }
    onCancelChat?.()
  }, [sessionId, onCancelChat])

  // Send Prompt
  const handleSendPrompt = useCallback(async () => {
    if (pending) return
    if (!textModel) {
      toast.error(t('chat:textarea.selectModel'))
      if (!authStatus.is_logged_in) {
        setShowLoginDialog(true)
      }
      return
    }

    if (!selectedTools || selectedTools.length === 0) {
      toast.warning(t('chat:textarea.selectTool'))
    }

    let value: MessageContent[] | string = prompt
    if (prompt.length === 0 || prompt.trim() === '') {
      toast.error(t('chat:textarea.enterPrompt'))
      return
    }

    // Add aspect ratio and quantity information if not default values
    let additionalInfo = ''
    if (selectedAspectRatio !== 'auto') {
      additionalInfo += `<aspect_ratio>${selectedAspectRatio}</aspect_ratio>\n`
    }
    if (quantity !== 1) {
      additionalInfo += `<quantity>${quantity}</quantity>\n`
    }

    if (additionalInfo) {
      value = value + '\n\n' + additionalInfo
    }

    if (images.length > 0) {
      images.forEach((image) => {
        value += `\n\n ![Attached image - width: ${image.width} height: ${image.height} filename: ${image.file_id}](/api/file/${image.file_id})`
      })

      // Fetch images as base64
      const imagePromises = images.map(async (image) => {
        const response = await fetch(`/api/file/${image.file_id}`)
        const blob = await response.blob()
        return new Promise<string>((resolve) => {
          const reader = new FileReader()
          reader.onloadend = () => resolve(reader.result as string)
          reader.readAsDataURL(blob)
        })
      })

      const base64Images = await Promise.all(imagePromises)

      value = [
        {
          type: 'text',
          text: value as string,
        },
        ...images.map((image, index) => ({
          type: 'image_url',
          image_url: {
            url: base64Images[index],
          },
        })),
      ] as MessageContent[]
    }

    const newMessage = messages.concat([
      {
        role: 'user',
        content: value,
      },
    ])

    setImages([])
    setPrompt('')

    onSendMessages(newMessage, {
      textModel: textModel,
      toolList: selectedTools && selectedTools.length > 0 ? selectedTools : [],
    })
  }, [
    pending,
    textModel,
    selectedTools,
    prompt,
    onSendMessages,
    images,
    messages,
    t,
    selectedAspectRatio,
    quantity,
    authStatus.is_logged_in,
    setShowLoginDialog,
  ])

  // Drop Area
  const dropAreaRef = useRef<HTMLDivElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  const handleFilesDrop = useCallback(
    (files: File[]) => {
      for (const file of files) {
        uploadImageMutation(file)
      }
    },
    [uploadImageMutation]
  )

  useDrop(dropAreaRef, {
    onDragOver() {
      setIsDragOver(true)
    },
    onDragLeave() {
      setIsDragOver(false)
    },
    onDrop() {
      setIsDragOver(false)
    },
    onFiles: handleFilesDrop,
  })

  useEffect(() => {
    const handleAddImagesToChat = (data: TCanvasAddImagesToChatEvent) => {
      data.forEach(async (image) => {
        if (image.base64) {
          const file = dataURLToFile(image.base64, image.fileId)
          uploadImageMutation(file)
        } else {
          setImages(
            produce((prev) => {
              prev.push({
                file_id: image.fileId,
                width: image.width,
                height: image.height,
              })
            })
          )
        }
      })

      textareaRef.current?.focus()
    }

    const handleMaterialAddImagesToChat = async (
      data: TMaterialAddImagesToChatEvent
    ) => {
      data.forEach(async (image: TMaterialAddImagesToChatEvent[0]) => {
        // Convert file path to blob and upload
        try {
          const fileUrl = `/api/serve_file?file_path=${encodeURIComponent(image.filePath)}`
          const response = await fetch(fileUrl)
          const blob = await response.blob()
          const file = new File([blob], image.fileName, {
            type: `image/${image.fileType}`,
          })
          uploadImageMutation(file)
        } catch (error) {
          console.error('Failed to load image from material:', error)
          toast.error('Failed to load image from material', {
            description: `${error}`,
          })
        }
      })

      textareaRef.current?.focus()
    }

    eventBus.on('Canvas::AddImagesToChat', handleAddImagesToChat)
    eventBus.on('Material::AddImagesToChat', handleMaterialAddImagesToChat)
    return () => {
      eventBus.off('Canvas::AddImagesToChat', handleAddImagesToChat)
      eventBus.off('Material::AddImagesToChat', handleMaterialAddImagesToChat)
    }
  }, [uploadImageMutation])

  // Close quantity slider when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        quantitySliderRef.current &&
        !quantitySliderRef.current.contains(event.target as Node)
      ) {
        setShowQuantitySlider(false)
      }
    }

    if (showQuantitySlider) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showQuantitySlider])

  return (
    <motion.div
      ref={dropAreaRef}
      className={cn(
        'w-full flex flex-col items-center border border-primary/20 rounded-2xl p-3 hover:border-primary/40 transition-all duration-300 cursor-text gap-5 bg-background/80 backdrop-blur-xl relative',
        isFocused && 'border-primary/40',
        className
      )}
      style={{
        boxShadow: isFocused
          ? '0 0 0 4px color-mix(in oklab, var(--primary) 10%, transparent)'
          : 'none',
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, ease: 'linear' }}
      onClick={() => textareaRef.current?.focus()}
    >
      <AnimatePresence>
        {isDragOver && (
          <motion.div
            className="absolute top-0 left-0 right-0 bottom-0 bg-background/50 backdrop-blur-xl rounded-2xl z-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
          >
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-muted-foreground">
                Drop images here to upload
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {images.length > 0 && (
          <motion.div
            className="flex items-center gap-2 w-full"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
          >
            {images.map((image) => (
              <motion.div
                key={image.file_id}
                className="relative size-10"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
              >
                <img
                  key={image.file_id}
                  src={`/api/file/${image.file_id}`}
                  alt="Uploaded image"
                  className="w-full h-full object-cover rounded-md"
                  draggable={false}
                />
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute -top-1 -right-1 size-4"
                  onClick={() =>
                    setImages((prev) =>
                      prev.filter((i) => i.file_id !== image.file_id)
                    )
                  }
                >
                  <XIcon className="size-3" />
                </Button>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <Textarea
        ref={textareaRef}
        className="w-full h-full border-none outline-none resize-none max-h-[calc(100vh-700px)]"
        placeholder={t('chat:textarea.placeholder')}
        value={prompt}
        autoSize
        onChange={(e) => setPrompt(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSendPrompt()
          }
        }}
      />

      <div className="flex items-center justify-between gap-2 w-full">
        <div className="flex items-center gap-2 max-w-[calc(100%-50px)] flex-wrap">
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleImagesUpload}
            hidden
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => imageInputRef.current?.click()}
          >
            <PlusIcon className="size-4" />
          </Button>

          <ModelSelectorV2 />

          {/* Aspect Ratio Selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="flex items-center gap-1"
                size={'sm'}
              >
                <RectangleVertical className="size-4" />
                <span className="text-sm">{selectedAspectRatio}</span>
                <ChevronDown className="size-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-32">
              {['auto', '1:1', '4:3', '3:4', '16:9', '9:16'].map((ratio) => (
                <DropdownMenuItem
                  key={ratio}
                  onClick={() => setSelectedAspectRatio(ratio)}
                  className="flex items-center justify-between"
                >
                  <span>{ratio}</span>
                  {selectedAspectRatio === ratio && (
                    <div className="size-2 rounded-full bg-primary" />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Quantity Selector */}
          <div className="relative" ref={quantitySliderRef}>
            <Button
              variant="outline"
              className="flex items-center gap-1"
              onClick={() => setShowQuantitySlider(!showQuantitySlider)}
              size={'sm'}
            >
              <Hash className="size-4" />
              <span className="text-sm">{quantity}</span>
              <ChevronDown className="size-3 opacity-50" />
            </Button>

            {/* Quantity Slider */}
            <AnimatePresence>
              {showQuantitySlider && (
                <motion.div
                  className="absolute bottom-full mb-2 left-0  bg-background border border-border rounded-lg p-4 shadow-lg min-w-48"
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.15, ease: 'easeOut' }}
                >
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        {t('chat:textarea.quantity', 'Image Quantity')}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {quantity}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">1</span>
                      <input
                        type="range"
                        min="1"
                        max={MAX_QUANTITY}
                        value={quantity}
                        onChange={(e) => setQuantity(Number(e.target.value))}
                        className="flex-1 h-2 bg-muted rounded-lg appearance-none cursor-pointer
                                  [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                                  [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary
                                  [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-sm
                                  [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full
                                  [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-0"
                      />
                      <span className="text-xs text-muted-foreground">
                        {MAX_QUANTITY}
                      </span>
                    </div>
                  </div>
                  {/* Arrow pointing down */}
                  <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-border"></div>
                  <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-background translate-y-[-1px]"></div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {pending ? (
          <Button
            className="shrink-0 relative"
            variant="default"
            size="icon"
            onClick={handleCancelChat}
          >
            <Loader2 className="size-5.5 animate-spin absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            <Square className="size-2 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </Button>
        ) : (
          <Button
            className="shrink-0"
            variant="default"
            size="icon"
            onClick={handleSendPrompt}
            disabled={!textModel || !selectedTools || prompt.length === 0}
          >
            <ArrowUp className="size-4" />
          </Button>
        )}
      </div>
    </motion.div>
  )
}

export default ChatTextarea
