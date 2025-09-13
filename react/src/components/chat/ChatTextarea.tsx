import { cancelChat } from '@/api/chat'
import { cancelMagicGenerate } from '@/api/magic'
import { uploadImage, uploadImageFast, FastUploadResult, getBestImageUrl, getDisplayImageUrl } from '@/api/upload'
import { Button } from '@/components/ui/button'
import { useConfigs } from '@/contexts/configs'
import { eventBus, TCanvasAddImagesToChatEvent, TMaterialAddImagesToChatEvent } from '@/lib/event'
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
import ModelSelectorV2 from './ModelSelectorV2'
import ModelSelectorV3 from './ModelSelectorV3'
import { useAuth } from '@/contexts/AuthContext'
import { useBalance } from '@/hooks/use-balance'
import { useTypingPlaceholder } from '@/hooks/use-typing-placeholder'
import { BASE_API_URL } from '@/constants'
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
      textModel: ModelInfo | null
      toolList: ToolInfo[]
      modelName: string
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
  const { balance } = useBalance()
  const dynamicPlaceholder = useTypingPlaceholder({
    typingSpeed: 80,
    deletingSpeed: 40,
    pauseBetweenWords: 800,
    pauseAfterComplete: 2500
  })
  const [prompt, setPrompt] = useState('')
  const textareaRef = useRef<TextAreaRef>(null)
  const [images, setImages] = useState<
    {
      file_id: string
      width: number
      height: number
      localPreviewUrl?: string // 本地预览URL，优先显示
      serverUrl?: string // 服务器URL，作为备用（向后兼容）
      directUrl?: string | null // 腾讯云直链URL（最佳性能）
      redirectUrl?: string // 重定向URL
      proxyUrl?: string // 代理URL
      uploadStatus?: 'uploading' | 'local_ready' | 'cloud_synced' | 'failed'
    }[]
  >([])
  const [isFocused, setIsFocused] = useState(false)
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<string>('auto')
  const [quantity, setQuantity] = useState<number>(1)
  const [isSubmitting, setIsSubmitting] = useState(false) // 本地提交状态，用于即时按钮反馈
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

  const { mutate: uploadImageMutation } = useMutation({
    mutationFn: (file: File) => uploadImageFast(file),
    onSuccess: (data: FastUploadResult) => {
      console.log('⚡ uploadImageMutation onSuccess', data)
      setImages((prev) => [
        ...prev,
        {
          file_id: data.file_id,
          width: data.width,
          height: data.height,
          localPreviewUrl: data.localPreviewUrl,
          serverUrl: data.url, // 向后兼容
          directUrl: data.direct_url, // 腾讯云直链URL
          redirectUrl: data.redirect_url, // 重定向URL
          proxyUrl: data.proxy_url, // 代理URL
          uploadStatus: data.upload_status as 'local_ready',
        },
      ])
    },
    onError: (error) => {
      console.error('⚡ uploadImageMutation onError', error)
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
    if (pending || isSubmitting) return

    // 立即设置本地提交状态，让按钮瞬间变成加载状态
    setIsSubmitting(true)

    // 首先检查登录状态 - 如果未登录，强制跳转到Google登录
    if (!authStatus.is_logged_in) {
      setShowLoginDialog(true)
      setIsSubmitting(false) // 重置状态
      return
    }

    // 检查是否使用 Jaaz 服务
    const isUsingJaaz =
      textModel?.provider === 'jaaz' || selectedTools?.some((tool) => tool.provider === 'jaaz')
    // console.log('👀isUsingJaaz', textModel, selectedTools, isUsingJaaz)

    // 只有当使用 Jaaz 服务且余额为 0 时才提醒充值
    if (authStatus.is_logged_in && isUsingJaaz && parseFloat(balance) <= 0) {
      toast.error(t('chat:insufficientBalance'), {
        description: <RechargeContent />,
        duration: 10000, // 10s，给用户更多时间操作
      })
      setIsSubmitting(false) // 重置状态
      return
    }

    // 检查是否至少选择了一个模型（文本或工具）
    const hasTextModel = !!textModel
    const hasToolModels = selectedTools && selectedTools.length > 0

    if (!hasTextModel && !hasToolModels) {
      toast.error(t('chat:textarea.selectModel'))
      if (!authStatus.is_logged_in) {
        setShowLoginDialog(true)
      }
      setIsSubmitting(false) // 重置状态
      return
    }

    let text_content: MessageContent[] | string = prompt
    if (prompt.length === 0 || prompt.trim() === '') {
      toast.error(t('chat:textarea.enterPrompt'))
      setIsSubmitting(false) // 重置状态
      return
    }

    // Add aspect ratio and quantity information if not default values
    // let additionalInfo = ''
    // if (selectedAspectRatio !== 'auto') {
    //   additionalInfo += `<aspect_ratio>${selectedAspectRatio}</aspect_ratio>\n`
    // }
    // if (quantity !== 1) {
    //   additionalInfo += `<quantity>${quantity}</quantity>\n`
    // }

    // if (additionalInfo) {
    //   text_content = text_content + '\n\n' + additionalInfo
    // }

    // if (images.length > 0) {
    //   text_content += `\n\n<input_images count="${images.length}">`
    //   images.forEach((image, index) => {
    //     text_content += `\n<image index="${index + 1}" file_id="${image.file_id}" width="${image.width}" height="${image.height}" />`
    //   })
    //   text_content += `\n</input_images>`
    // }

    // Fetch images as base64 with error handling and retry
    const imagePromises = images.map(async (image) => {
      const maxRetries = 3
      let lastError: Error | null = null

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const response = await fetch(`/api/file/${image.file_id}`, {
            method: 'GET',
            headers: {
              Accept: 'image/*',
            },
          })

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`)
          }

          const blob = await response.blob()
          return new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onloadend = () => resolve(reader.result as string)
            reader.onerror = () => reject(new Error('Failed to read image as data URL'))
            reader.readAsDataURL(blob)
          })
        } catch (error) {
          lastError = error as Error
          console.warn(`⚠️ 图片获取失败 (尝试 ${attempt}/${maxRetries}): ${image.file_id}`, error)

          if (attempt < maxRetries) {
            // 指数退避重试
            await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000))
          }
        }
      }

      // 所有重试都失败，显示错误并移除该图片
      console.error(`❌ 图片获取最终失败: ${image.file_id}`, lastError)
      toast.error(`图片获取失败: ${image.file_id}`, {
        description: `请检查网络连接或稍后重试`,
      })

      // 从images列表中移除失败的图片
      setImages((prev) => prev.filter((img) => img.file_id !== image.file_id))

      // 返回空的base64，后续会被过滤掉
      return ''
    })

    const base64Images = await Promise.all(imagePromises)

    // 过滤掉失败的图片和对应的base64数据
    const validImages = images.filter((_, index) => base64Images[index] !== '')
    const validBase64Images = base64Images.filter((base64) => base64 !== '')

    const final_content = [
      {
        type: 'text',
        text: text_content as string,
      },
      ...validImages.map((image, index) => ({
        type: 'image_url',
        image_url: {
          url: validBase64Images[index],
        },
      })),
    ] as MessageContent[]

    const newMessage = messages.concat([
      {
        role: 'user',
        content: final_content,
      },
    ])

    // 立即清空输入状态，提供即时反馈
    setImages([])
    setPrompt('')

    // 直接读取用户在模型选择器中选择的模型
    const currentSelectedModel = localStorage.getItem('current_selected_model')

    let modelName = ''

    if (currentSelectedModel) {
      modelName = currentSelectedModel
    } else {
      if (textModel) {
        modelName = textModel.model
        localStorage.setItem('current_selected_model', modelName)
      } else {
        modelName = 'gpt-4o' // 默认模型
        localStorage.setItem('current_selected_model', modelName)
      }
    }

    // 调用消息发送，触发pending状态
    onSendMessages(newMessage, {
      textModel: textModel ? { ...textModel, type: 'text' as const } : null,
      toolList: selectedTools || [],
      modelName,
    })
  }, [
    pending,
    isSubmitting,
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
    balance,
    RechargeContent,
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
                serverUrl: `/api/file/${image.fileId}`,
                redirectUrl: `/api/file/${image.fileId}?redirect=true`,
                uploadStatus: 'cloud_synced',
              })
            })
          )
        }
      })

      textareaRef.current?.focus()
    }

    const handleMaterialAddImagesToChat = async (data: TMaterialAddImagesToChatEvent) => {
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

  // 同步外部pending状态到本地isSubmitting状态
  useEffect(() => {
    if (!pending) {
      setIsSubmitting(false) // 当外部pending结束时，重置本地状态
    }
  }, [pending])

  // 清理本地预览URL
  useEffect(() => {
    return () => {
      // 组件卸载时清理所有本地预览URL
      images.forEach((image) => {
        if (image.localPreviewUrl) {
          URL.revokeObjectURL(image.localPreviewUrl)
        }
      })
    }
  }, [images])

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
              <p className='text-sm text-muted-foreground'>Drop images here to upload</p>
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
                key={image.file_id}
                className='relative size-10'
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
              >
                <img
                  key={image.file_id}
                  src={
                    image.localPreviewUrl || 
                    image.directUrl || 
                    image.redirectUrl || 
                    image.serverUrl || 
                    `/api/file/${image.file_id}`
                  }
                  alt='Uploaded image'
                  className={cn(
                    'w-full h-full object-cover rounded-md',
                    image.uploadStatus === 'local_ready' && 'ring-2 ring-blue-500 ring-opacity-50'
                  )}
                  draggable={false}
                  onError={(e) => {
                    // 降级处理：本地预览 -> 直链 -> 重定向 -> 代理
                    const target = e.target as HTMLImageElement
                    if (image.localPreviewUrl && target.src === image.localPreviewUrl) {
                      target.src = image.directUrl || image.redirectUrl || image.serverUrl || `/api/file/${image.file_id}`
                    } else if (image.directUrl && target.src === image.directUrl) {
                      target.src = image.redirectUrl || image.serverUrl || `/api/file/${image.file_id}`
                    } else if (image.redirectUrl && target.src === image.redirectUrl) {
                      target.src = image.serverUrl || `/api/file/${image.file_id}`
                    }
                  }}
                />
                {/* 上传状态指示器 */}
                {image.uploadStatus === 'local_ready' && (
                  <div className='absolute -bottom-1 -right-1 size-3 bg-blue-500 rounded-full animate-pulse' />
                )}
                <Button
                  variant='secondary'
                  size='icon'
                  className='absolute -top-1 -right-1 size-4'
                  onClick={() => {
                    // 清理本地预览URL
                    if (image.localPreviewUrl) {
                      URL.revokeObjectURL(image.localPreviewUrl)
                    }
                    setImages((prev) => prev.filter((i) => i.file_id !== image.file_id))
                  }}
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
        className='w-full h-full border-none outline-none resize-none'
        placeholder={prompt ? '' : dynamicPlaceholder}
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
        <div className='flex items-center gap-2 max-w-[calc(100%-45px)] flex-nowrap overflow-x-auto'>
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
            onClick={() => imageInputRef.current?.click()}
            className='shrink-0 h-8 w-8 p-0 flex items-center justify-center'
          >
            <PlusIcon className='size-4' />
          </Button>

          <div className='shrink-0'>
            <ModelSelectorV3 />
          </div>

          {/* Aspect Ratio Selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant='outline'
                className='shrink-0 h-8 w-8 p-0 flex items-center justify-center'
              >
                <RectangleVertical className='size-4' />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='start' className='w-36'>
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

          {/* Quantity Selector - Hidden */}
          {/* <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant='outline' 
                className='shrink-0 h-8 w-8 p-0 flex items-center justify-center'
              >
                <Hash className='size-4' />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='start' className='w-72 p-0'>
              <div className='p-4'>
                <div className='flex items-center justify-between mb-4'>
                  <span className='text-sm font-medium'>
                    {t('chat:textarea.quantity', 'Image Quantity')}
                  </span>
                  <span className='text-sm text-primary font-medium bg-primary/10 px-2 py-1 rounded'>{quantity}</span>
                </div>
                
                <div className='mb-4'>
                  <div className='text-xs text-muted-foreground mb-2'>Quick Select:</div>
                  <div className='grid grid-cols-6 gap-2'>
                    {[1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 30].map((num) => (
                      <Button
                        key={num}
                        variant={quantity === num ? 'default' : 'outline'}
                        size='sm'
                        className='h-8 text-xs'
                        onClick={() => setQuantity(num)}
                      >
                        {num}
                      </Button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className='text-xs text-muted-foreground mb-2'>Custom Value:</div>
                  <div className='flex items-center gap-3'>
                    <span className='text-xs text-muted-foreground w-4'>1</span>
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
                    <span className='text-xs text-muted-foreground w-6'>{MAX_QUANTITY}</span>
                  </div>
                </div>
              </div>
            </DropdownMenuContent>
          </DropdownMenu> */}
        </div>

        {pending || isSubmitting ? (
          <Button
            className='shrink-0 relative h-8 w-8 p-0 flex items-center justify-center'
            variant='default'
            onClick={handleCancelChat}
          >
            <Loader2 className='size-4 animate-spin absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2' />
            <Square className='size-1.5 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2' />
          </Button>
        ) : (
          <Button
            className='shrink-0 h-8 w-8 p-0 flex items-center justify-center'
            variant='default'
            onClick={handleSendPrompt}
            disabled={
              (!textModel && (!selectedTools || selectedTools.length === 0)) ||
              prompt.length === 0 ||
              pending ||
              isSubmitting
            }
          >
            <ArrowUp className='size-4' />
          </Button>
        )}
      </div>
    </motion.div>
  )
}

export default ChatTextarea
