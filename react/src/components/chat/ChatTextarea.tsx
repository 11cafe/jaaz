import { cancelChat } from '@/api/chat'
import { cancelMagicGenerate } from '@/api/magic'
import { uploadImage, uploadImageToJaaz } from '@/api/upload'
import { Button } from '@/components/ui/button'
import { useConfigs } from '@/contexts/configs'
import { eventBus, TCanvasAddImagesToChatEvent } from '@/lib/event'
import { cn, dataURLToFile } from '@/lib/utils'
import { Message, MessageContent, Model } from '@/types/types'
import { ModelInfo, ToolInfo } from '@/api/model'
import { useMutation } from '@tanstack/react-query'
import { useDrop } from 'ahooks'
import { produce } from 'immer'
import { ArrowUp, Loader2, PlusIcon, Square, XIcon } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import Textarea, { TextAreaRef } from 'rc-textarea'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import ModelSelector from './ModelSelector'
import ModelSelectorV2 from './ModelSelectorV2'
import { useAuth } from '@/contexts/AuthContext'

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
      file_id?: string
      width: number
      height: number
      url?: string // S3 URL if uploaded to Jaaz
    }[]
  >([])
  const [uploadingImages, setUploadingImages] = useState<
    {
      id: string
      file: File
      previewUrl: string
    }[]
  >([])
  const [isFocused, setIsFocused] = useState(false)

  const imageInputRef = useRef<HTMLInputElement>(null)

  // New mutation that handles both local and Jaaz uploads based on login status
  const { mutate: uploadImageMutation } = useMutation({
    mutationFn: async (file: File) => {
      if (authStatus.is_logged_in) {
        // Upload to Jaaz if logged in
        const s3Url = await uploadImageToJaaz(file)

        // Get image dimensions
        const dimensions = await new Promise<{ width: number; height: number }>(
          (resolve) => {
            const img = new Image()
            img.onload = () => {
              resolve({ width: img.naturalWidth, height: img.naturalHeight })
            }
            img.src = URL.createObjectURL(file)
          }
        )

        return {
          url: s3Url,
          width: dimensions.width,
          height: dimensions.height,
          file_id: undefined,
          uploadId: file.name + Date.now(),
        }
      } else {
        // Upload to local server if not logged in
        const result = await uploadImage(file)
        return { ...result, url: undefined, uploadId: file.name + Date.now() }
      }
    },
    onMutate: (file: File) => {
      // Add to uploading images immediately
      const uploadId = file.name + Date.now()
      const previewUrl = URL.createObjectURL(file)
      setUploadingImages((prev) => [
        ...prev,
        { id: uploadId, file, previewUrl },
      ])
      return { uploadId }
    },
    onSuccess: (data, file, context) => {
      console.log('🦄uploadImageMutation onSuccess', data)
      // Remove from uploading images
      setUploadingImages((prev) =>
        prev.filter((img) => img.id !== context?.uploadId)
      )

      // Add to completed images
      setImages((prev) => [
        ...prev,
        {
          file_id: data.file_id,
          width: data.width,
          height: data.height,
          url: data.url,
        },
      ])
    },
    onError: (error, file, context) => {
      console.error('Upload failed:', error)
      toast.error('图片上传失败')
      // Remove from uploading images on error
      setUploadingImages((prev) =>
        prev.filter((img) => img.id !== context?.uploadId)
      )
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

    let text_content: MessageContent[] | string = prompt
    if (prompt.length === 0 || prompt.trim() === '') {
      toast.error(t('chat:textarea.enterPrompt'))
      return
    }

    // 使用XML格式让LLM更容易识别图片信息
    if (images.length > 0) {
      text_content += `\n\n<input_images count="${images.length}">`
      images.forEach((image, index) => {
        const imageId = image.file_id || `image-${index}`
        text_content += `\n  <image index="${index + 1}" file_id="${imageId}" width="${image.width}" height="${image.height}" />`
      })
      text_content += `\n</input_images>`
      text_content += `\n\n<instruction>Please use the input_images as input for image generation or editing.</instruction>`
    }

    // 获取图片URL - 如果已经有S3 URL就直接使用，否则获取本地URL
    const imagePromises = images.map(async (image) => {
      if (image.url) {
        // Already have S3 URL from Jaaz upload
        return image.url
      } else if (image.file_id) {
        // Get local URL and convert to base64
        const response = await fetch(`/api/file/${image.file_id}`)
        const blob = await response.blob()
        return new Promise<string>((resolve) => {
          const reader = new FileReader()
          reader.onloadend = () => resolve(reader.result as string)
          reader.readAsDataURL(blob)
        })
      } else {
        throw new Error('Invalid image data')
      }
    })

    const imageUrlList = await Promise.all(imagePromises)

    const final_content = [
      {
        type: 'text',
        text: text_content,
      },
      ...images.map((image, index) => ({
        type: 'image_url',
        image_url: {
          url: imageUrlList[index],
        },
      })),
    ] as MessageContent[]

    const newMessage = messages.concat([
      {
        role: 'user',
        content: final_content,
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
    eventBus.on('Canvas::AddImagesToChat', handleAddImagesToChat)
    return () => {
      eventBus.off('Canvas::AddImagesToChat', handleAddImagesToChat)
    }
  }, [uploadImageMutation])

  // Cleanup object URLs to prevent memory leaks
  useEffect(() => {
    return () => {
      uploadingImages.forEach((img) => {
        URL.revokeObjectURL(img.previewUrl)
      })
    }
  }, [uploadingImages])

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
        {(images.length > 0 || uploadingImages.length > 0) && (
          <motion.div
            className="flex items-center gap-2 w-full"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
          >
            {/* Show uploading images first */}
            {uploadingImages.map((uploadingImage) => (
              <motion.div
                key={uploadingImage.id}
                className="relative size-10"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
              >
                <img
                  src={uploadingImage.previewUrl}
                  alt="Uploading image"
                  className="w-full h-full object-cover rounded-md opacity-50"
                  draggable={false}
                />
                {/* Upload spinner */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-md">
                  <Loader2 className="size-4 animate-spin text-white" />
                </div>
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute -top-1 -right-1 size-4"
                  onClick={() =>
                    setUploadingImages((prev) =>
                      prev.filter((img) => img.id !== uploadingImage.id)
                    )
                  }
                >
                  <XIcon className="size-3" />
                </Button>
              </motion.div>
            ))}

            {/* Show completed images */}
            {images.map((image, index) => (
              <motion.div
                key={image.file_id || `image-${index}`}
                className="relative size-10"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
              >
                <img
                  src={
                    image.url ||
                    (image.file_id ? `/api/file/${image.file_id}` : '')
                  }
                  alt="Uploaded image"
                  className="w-full h-full object-cover rounded-md"
                  draggable={false}
                />
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute -top-1 -right-1 size-4"
                  onClick={() =>
                    setImages((prev) => prev.filter((_, i) => i !== index))
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
        <div className="flex items-center gap-2 max-w-[calc(100%-50px)]">
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
            size="icon"
            onClick={() => imageInputRef.current?.click()}
          >
            <PlusIcon className="size-4" />
          </Button>

          <ModelSelectorV2 />
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
