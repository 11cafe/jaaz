import { cancelChat } from '@/api/chat'
import { cancelMagicGenerate } from '@/api/magic'
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
import ModelSelectorV2 from './ModelSelectorV2'
import ModelSelectorV3 from './ModelSelectorV3'
import { useAuth } from '@/contexts/AuthContext'
import { useBalance } from '@/hooks/use-balance'
import { BASE_API_URL } from '@/constants'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { processImageFiles } from '@/utils/imageUtils'

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
  const { textModel, selectedTools, setShowLoginDialog } = useConfigs()
  const [prompt, setPrompt] = useState('')
  const textareaRef = useRef<TextAreaRef>(null)
  const [images, setImages] = useState<
    {
      url: string
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

  // 充值按钮组件
  const RechargeContent = useCallback(
    () => (
      <div className='flex items-center justify-between gap-3'>
        <span className='text-sm text-muted-foreground flex-1'>
          {t('chat:insufficientBalanceDescription')}
        </span>
        <Button
          size='sm'
          variant='outline'
          className='shrink-0'
          onClick={() => {
            const billingUrl = `${BASE_API_URL}/billing`
            if (window.electronAPI?.openBrowserUrl) {
              window.electronAPI.openBrowserUrl(billingUrl)
            } else {
              window.open(billingUrl, '_blank')
            }
          }}
        >
          {t('common:auth.recharge')}
        </Button>
      </div>
    ),
    [t]
  )

  // Helper function to get image dimensions from base64
  const getImageDimensions = (
    base64Url: string
  ): Promise<{ width: number; height: number }> => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        resolve({ width: img.width, height: img.height })
      }
      img.onerror = reject
      img.src = base64Url
    })
  }

  // Upload image function without react-query - using useCallback for stable reference
  const uploadImageToS3 = useCallback(
    async (file: File) => {
      try {
        console.log('🦄Starting image upload for:', file.name)

        // Process the file using the same logic as workspace
        const processedImages = await processImageFiles([file])

        if (processedImages.length === 0) {
          throw new Error('Failed to process image')
        }

        const processedImage = processedImages[0]

        // Get image dimensions from base64
        const dimensions = await getImageDimensions(processedImage.url)

        // Upload to S3 using the base64 data
        const [header, base64Data] = processedImage.url.split(',')
        const mimeMatch = header.match(/data:([^;]+);base64/)
        const contentType = mimeMatch ? mimeMatch[1] : 'image/png'

        console.log('🦄Uploading to S3...', {
          fileName: processedImage.filename,
          contentType,
        })

        const uploadResponse = await fetch('/api/image/upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            base64Data: base64Data,
            fileName: processedImage.filename,
            contentType: contentType,
          }),
        })

        const uploadData = await uploadResponse.json()

        if (!uploadResponse.ok || !uploadData.success) {
          throw new Error(uploadData.error || 'Upload failed')
        }

        const imageData = {
          url: uploadData.data.s3Url,
          width: dimensions.width,
          height: dimensions.height,
        }

        // Add to images state on success
        setImages((prev) => [...prev, imageData])

        console.log('🦄Image uploaded successfully', imageData)

        return imageData
      } catch (error) {
        console.error('🦄Image upload failed', error)
        const errorMessage =
          error instanceof Error ? error.message : 'Upload failed'
        toast.error('Failed to upload image', {
          description: <div>{errorMessage}</div>,
        })
        throw error
      }
    },
    [setImages]
  )

  const handleImagesUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files
      if (!files || files.length === 0) {
        console.log('🦄No files selected')
        return
      }

      console.log('🦄Processing', files.length, 'files')

      try {
        // Process files sequentially to avoid overwhelming the server
        for (let i = 0; i < files.length; i++) {
          const file = files[i]
          console.log(`🦄Processing file ${i + 1}/${files.length}:`, file.name)

          // Validate file type
          if (!file.type.startsWith('image/')) {
            toast.warning(`Skipped non-image file: ${file.name}`)
            continue
          }

          await uploadImageToS3(file)
        }
      } catch (error) {
        console.error('🦄Batch upload failed:', error)
      } finally {
        // Always reset the file input
        if (e.target) {
          e.target.value = ''
        }
      }
    },
    [uploadImageToS3]
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

    // 检查是否使用 Jaaz 服务
    const isUsingJaaz =
      textModel?.provider === 'jaaz' ||
      selectedTools?.some((tool) => tool.provider === 'jaaz')
    // console.log('👀isUsingJaaz', textModel, selectedTools, isUsingJaaz)

    // 只有当使用 Jaaz 服务且余额为 0 时才提醒充值
    // TODO: 暂时关闭余额检查,未来需要重新打开!
    // if (authStatus.is_logged_in && isUsingJaaz && parseFloat(balance) <= 0) {
    //   toast.error(t('chat:insufficientBalance'), {
    //     description: <RechargeContent />,
    //     duration: 10000, // 10s，给用户更多时间操作
    //   })
    //   return
    // }

    if (!textModel) {
      toast.error(t('chat:textarea.selectModel'))
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

    // Add aspect ratio and quantity information if not default values
    let additionalInfo = ''
    if (selectedAspectRatio !== 'auto') {
      additionalInfo += `<aspect_ratio>${selectedAspectRatio}</aspect_ratio>\n`
    }
    if (quantity !== 1) {
      additionalInfo += `<quantity>${quantity}</quantity>\n`
    }

    if (additionalInfo) {
      text_content = text_content + '\n\n' + additionalInfo
    }

    if (images.length > 0) {
      text_content += `\n\n<input_images count="${images.length}">`
      images.forEach((image, index) => {
        text_content += `\n<image index="${index + 1}" url="${image.url}" width="${image.width}" height="${image.height}" />`
      })
      text_content += `\n</input_images>`
    }

    const final_content = [
      {
        type: 'text',
        text: text_content as string,
      },
      ...images.map((image, index) => ({
        type: 'image_url',
        image_url: {
          url: image.url,
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
    selectedAspectRatio,
    quantity,
    // authStatus.is_logged_in,
    setShowLoginDialog,
    // balance,
    RechargeContent,
  ])

  // Drop Area
  const dropAreaRef = useRef<HTMLDivElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  const handleFilesDrop = useCallback(
    async (files: File[]) => {
      if (!files || files.length === 0) {
        console.log('🦄No files dropped')
        return
      }

      console.log('🦄Processing', files.length, 'dropped files')

      try {
        // Process files sequentially to avoid overwhelming the server
        for (let i = 0; i < files.length; i++) {
          const file = files[i]
          console.log(
            `🦄Processing dropped file ${i + 1}/${files.length}:`,
            file.name
          )

          // Validate file type
          if (!file.type.startsWith('image/')) {
            console.warn(`🦄Skipping non-image dropped file: ${file.name}`)
            toast.error(`Skipped non-image file: ${file.name}`)
            continue
          }

          await uploadImageToS3(file)
        }
      } catch (error) {
        console.error('🦄Batch drop upload failed:', error)
      }
    },
    [uploadImageToS3]
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
    const handleAddImagesToChat = async (data: TCanvasAddImagesToChatEvent) => {
      console.log('🦄Adding', data.length, 'images from canvas to chat')

      try {
        // Process images sequentially
        for (let i = 0; i < data.length; i++) {
          const image = data[i]
          console.log(`🦄Processing canvas image ${i + 1}/${data.length}`)

          if (image.base64) {
            const file = dataURLToFile(image.base64, image.fileId)
            await uploadImageToS3(file)
          } else {
            // If no base64, assume it's already a URL (like S3 URL)
            setImages(
              produce((prev) => {
                prev.push({
                  url: image.fileId, // Assuming fileId is actually a URL in this case
                  width: image.width,
                  height: image.height,
                })
              })
            )
          }
        }
      } catch (error) {
        console.error('🦄Failed to add canvas images to chat:', error)
      }

      textareaRef.current?.focus()
    }

    eventBus.on('Canvas::AddImagesToChat', handleAddImagesToChat)
    return () => {
      eventBus.off('Canvas::AddImagesToChat', handleAddImagesToChat)
    }
  }, [uploadImageToS3])

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
            className='absolute top-0 left-0 right-0 bottom-0 bg-background/50 backdrop-blur-xl rounded-2xl z-10'
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
          >
            <div className='flex items-center justify-center h-full'>
              <p className='text-sm text-muted-foreground'>
                Drop images here to upload
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {images.length > 0 && (
          <motion.div
            className='flex items-center gap-2 w-full'
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
          >
            {images.map((image) => (
              <motion.div
                key={image.url}
                className='relative size-10'
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
              >
                <img
                  key={image.url}
                  src={image.url}
                  alt='Uploaded image'
                  className='w-full h-full object-cover rounded-md'
                  draggable={false}
                />
                <Button
                  variant='secondary'
                  size='icon'
                  className='absolute -top-1 -right-1 size-4'
                  onClick={() =>
                    setImages((prev) => prev.filter((i) => i.url !== image.url))
                  }
                >
                  <XIcon className='size-3' />
                </Button>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <Textarea
        ref={textareaRef}
        className='w-full h-full border-none outline-none resize-none bg-transparent text-foreground placeholder:text-muted-foreground'
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

      <div className='flex items-center justify-between gap-2 w-full'>
        <div className='flex items-center gap-2 max-w-[calc(100%-50px)] flex-wrap'>
          <input
            ref={imageInputRef}
            type='file'
            accept='image/*'
            multiple
            onChange={handleImagesUpload}
            hidden
          />
          <Button
            variant='outline'
            size='sm'
            onClick={() => imageInputRef.current?.click()}
          >
            <PlusIcon className='size-4' />
          </Button>

          <ModelSelectorV3 />

          {/* Aspect Ratio Selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant='outline'
                className='flex items-center gap-1'
                size={'sm'}
              >
                <RectangleVertical className='size-4' />
                <span className='text-sm'>{selectedAspectRatio}</span>
                <ChevronDown className='size-3 opacity-50' />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='start' className='w-32'>
              {['auto', '1:1', '4:3', '3:4', '16:9', '9:16'].map((ratio) => (
                <DropdownMenuItem
                  key={ratio}
                  onClick={() => setSelectedAspectRatio(ratio)}
                  className='flex items-center justify-between'
                >
                  <span>{ratio}</span>
                  {selectedAspectRatio === ratio && (
                    <div className='size-2 rounded-full bg-primary' />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Quantity Selector */}
          <div className='relative' ref={quantitySliderRef}>
            <Button
              variant='outline'
              className='flex items-center gap-1'
              onClick={() => setShowQuantitySlider(!showQuantitySlider)}
              size={'sm'}
            >
              <Hash className='size-4' />
              <span className='text-sm'>{quantity}</span>
              <ChevronDown className='size-3 opacity-50' />
            </Button>

            {/* Quantity Slider */}
            <AnimatePresence>
              {showQuantitySlider && (
                <motion.div
                  className='absolute bottom-full mb-2 left-0  bg-background border border-border rounded-lg p-4 shadow-lg min-w-48'
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.15, ease: 'easeOut' }}
                >
                  <div className='flex flex-col gap-3'>
                    <div className='flex items-center justify-between'>
                      <span className='text-sm font-medium'>
                        {t('chat:textarea.quantity', 'Image Quantity')}
                      </span>
                      <span className='text-sm text-muted-foreground'>
                        {quantity}
                      </span>
                    </div>
                    <div className='flex items-center gap-3'>
                      <span className='text-xs text-muted-foreground'>1</span>
                      <input
                        type='range'
                        min='1'
                        max={MAX_QUANTITY}
                        value={quantity}
                        onChange={(e) => setQuantity(Number(e.target.value))}
                        className='flex-1 h-2 bg-muted rounded-lg appearance-none cursor-pointer
                                  [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                                  [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary
                                  [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-sm
                                  [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full
                                  [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-0'
                      />
                      <span className='text-xs text-muted-foreground'>
                        {MAX_QUANTITY}
                      </span>
                    </div>
                  </div>
                  {/* Arrow pointing down */}
                  <div className='absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-border'></div>
                  <div className='absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-background translate-y-[-1px]'></div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {pending ? (
          <Button
            className='shrink-0 relative'
            variant='default'
            size='icon'
            onClick={handleCancelChat}
          >
            <div className='absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2'>
              <Loader2 className='size-5.5 animate-spin' />
            </div>
            <Square className='size-2 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2' />
          </Button>
        ) : (
          <Button
            className='shrink-0'
            variant='default'
            size='icon'
            onClick={handleSendPrompt}
            disabled={!textModel || !selectedTools || prompt.length === 0}
          >
            <ArrowUp className='size-4' />
          </Button>
        )}
      </div>
    </motion.div>
  )
}

export default ChatTextarea
