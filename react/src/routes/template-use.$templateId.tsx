import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import TopMenu from '@/components/TopMenu'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft,
  Play,
  Settings,
  Wand2,
  Loader2,
  PlusIcon,
  RectangleVertical,
  ChevronDown,
  Hash,
  XIcon,
} from 'lucide-react'
import { useState, useRef, useCallback, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { getTemplate } from '@/api/templates'
import { BASE_API_URL } from '@/constants'
import { uploadImageFast, FastUploadResult } from '@/api/upload'
import { createCanvas } from '@/api/canvas'
import { sendMagicGenerate } from '@/api/magic'
import { AnimatePresence, motion } from 'motion/react'
import Textarea, { TextAreaRef } from 'rc-textarea'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import ModelSelectorV3 from '@/components/chat/ModelSelectorV3'
import { useConfigs } from '@/contexts/configs'
import { DEFAULT_SYSTEM_PROMPT } from '@/constants'
import { nanoid } from 'nanoid'
import { UserMessage } from '@/types/types'

export const Route = createFileRoute('/template-use/$templateId')({
  component: TemplateUsePage,
})

function TemplateUsePage() {
  const { templateId } = Route.useParams()
  const navigate = useNavigate()
  const { t } = useTranslation('template-use')
  const { textModel, selectedTools, setInitCanvas } = useConfigs()
  const [characterName, setCharacterName] = useState('')
  const [images, setImages] = useState<
    {
      file_id: string
      width: number
      height: number
      localPreviewUrl?: string // 本地预览URL，优先显示
      serverUrl?: string // 服务器URL，作为备用
      uploadStatus?: 'uploading' | 'local_ready' | 'cloud_synced' | 'failed'
    }[]
  >([])
  const [isFocused, setIsFocused] = useState(false)
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<string>('auto')
  const [quantity, setQuantity] = useState<number>(1)
  const [showQuantitySlider, setShowQuantitySlider] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatingStep, setGeneratingStep] = useState('')

  const textareaRef = useRef<TextAreaRef>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const quantitySliderRef = useRef<HTMLDivElement>(null)
  const MAX_QUANTITY = 10

  // 获取模板数据
  const {
    data: template,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['template', templateId],
    queryFn: () => getTemplate(parseInt(templateId)),
    staleTime: 5 * 60 * 1000,
  })

  // 图片上传 - 使用快速上传API
  const { mutate: uploadImageMutation } = useMutation({
    mutationFn: (file: File) => uploadImageFast(file),
    onSuccess: (data: FastUploadResult) => {
      console.log('⚡ 模板页面快速上传成功', data)
      setImages((prev) => [
        ...prev,
        {
          file_id: data.file_id,
          width: data.width,
          height: data.height,
          localPreviewUrl: data.localPreviewUrl,
          serverUrl: data.url,
          uploadStatus: data.upload_status as 'local_ready',
        },
      ])
    },
    onError: (error) => {
      console.error('⚡ 模板页面上传失败', error)
      toast.error('图片上传失败', {
        description: error.message,
      })
    },
  })

  // 这个状态用于UI显示，实际的canvas创建现在在handleGenerate中直接调用
  const isCanvasCreating = false

  // 处理图片上传
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

  // 导航到画布的辅助函数
  const navigateToCanvas = useCallback(
    (canvasId: string, sessionId: string, userMessage: UserMessage) => {
      try {
        setInitCanvas(true)

        // 将用户消息存储到localStorage，供canvas页面立即显示（和首页跳转逻辑一致）
        const messageData = {
          sessionId: sessionId,
          message: userMessage,
          timestamp: Date.now(),
          canvasId: canvasId,
        }
        localStorage.setItem('initial_user_message', JSON.stringify(messageData))

        // 立即跳转到canvas页面，让用户实时看到生成过程
        navigate({
          to: '/canvas/$id',
          params: { id: canvasId },
          search: { sessionId },
        })
      } catch (error) {
        console.error('❌ 跳转失败:', error)
        toast.error(t('messages.jumpFailed'))
      }
    },
    [navigate, setInitCanvas]
  )

  // 生成处理
  const handleGenerate = useCallback(async () => {
    if (isGenerating || isCanvasCreating) return

    if (!characterName.trim()) {
      toast.error(t('messages.enterCharacterName'))
      return
    }

    if (images.length === 0) {
      toast.error(t('messages.uploadImage'))
      return
    }

    setIsGenerating(true)
    setGeneratingStep(t('steps.preparingData'))

    try {
      const textContent = characterName.trim()
      const canvasId = nanoid()
      const sessionId = nanoid()
      const systemPrompt = localStorage.getItem('system_prompt') || DEFAULT_SYSTEM_PROMPT

      console.log('🚀 开始模板生成流程', {
        templateId,
        characterName: textContent,
        canvasId,
        sessionId,
        imagesCount: images.length,
      })

      // 优化图片处理 - 优先使用本地预览，避免重复网络请求
      setGeneratingStep(t('steps.processingImages'))
      const imagePromises = images.map(async (image) => {
        // 如果有本地预览URL，直接使用（已经是base64格式）
        if (image.localPreviewUrl && image.localPreviewUrl.startsWith('data:')) {
          console.log('⚡ 使用本地预览URL，避免网络请求:', image.file_id)
          return image.localPreviewUrl
        }
        
        // 如果没有本地预览，才从服务器获取
        console.log('⚡ 从服务器获取图片:', image.file_id)
        const response = await fetch(`/api/file/${image.file_id}?redirect=true`)
        const blob = await response.blob()
        return new Promise<string>((resolve) => {
          const reader = new FileReader()
          reader.onloadend = () => resolve(reader.result as string)
          reader.readAsDataURL(blob)
        })
      })

      const base64Images = await Promise.all(imagePromises)

      // 构建包含图片的消息内容
      const messageContent = [
        {
          type: 'text',
          text: textContent,
        },
        ...images.map((_, index) => ({
          type: 'image_url',
          image_url: {
            url: base64Images[index],
          },
        })),
      ]

      // 构造完整的用户消息对象（用于显示和magic生成）
      const fullUserMessage: UserMessage = {
        role: 'user',
        content: messageContent,
      }

      const magicMessages = [fullUserMessage]

      // 1. 先创建画布
      setGeneratingStep(t('steps.creatingCanvas'))
      // 获取当前选择的模型名称
      const currentSelectedModel = localStorage.getItem('current_selected_model')
      let modelName = ''
      
      if (currentSelectedModel) {
        modelName = currentSelectedModel
      } else if (textModel) {
        modelName = textModel.model
        localStorage.setItem('current_selected_model', modelName)
      } else {
        modelName = 'gpt-4o-mini' // 默认模型
        localStorage.setItem('current_selected_model', modelName)
      }

      const canvasResult = await createCanvas({
        name: `${template?.title} - ${characterName}`,
        canvas_id: canvasId,
        messages: [
          {
            role: 'user',
            content: textContent,
          },
        ],
        session_id: sessionId,
        text_model: textModel || {
          provider: 'openai',
          model: 'gpt-4o-mini',
          url: '',
        },
        tool_list: selectedTools && selectedTools.length > 0 ? selectedTools : [],
        model_name: modelName,
        system_prompt: systemPrompt,
        template_id: parseInt(templateId),
      })

      // 2. 立即跳转到canvas页面，让用户实时看到生成过程
      navigateToCanvas(canvasResult.id, sessionId, fullUserMessage)

      // 3. 在后台启动魔法生成（通过websocket向canvas页面推送进度）
      // 使用setTimeout确保这个调用不会阻塞页面跳转
      setTimeout(() => {
        sendMagicGenerate({
          sessionId: sessionId,
          canvasId: canvasId,
          newMessages: magicMessages,
          systemPrompt: systemPrompt,
          templateId: parseInt(templateId),
        }).catch((error) => {
          console.error('❌ 魔法生成启动失败:', error)
          // 错误会通过websocket推送到canvas页面
        })
      }, 100)
    } catch (error) {
      console.error('❌ 生成失败:', error)
      toast.error(`${t('messages.generateFailed')}: ${error instanceof Error ? error.message : t('messages.unknownError')}`)
      setGeneratingStep('')
    } finally {
      setIsGenerating(false)
      setGeneratingStep('')
    }
  }, [
    isGenerating,
    isCanvasCreating,
    characterName,
    templateId,
    images,
    template,
    textModel,
    selectedTools,
    navigateToCanvas,
  ])

  // 关闭数量滑块的点击外部事件
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (quantitySliderRef.current && !quantitySliderRef.current.contains(event.target as Node)) {
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

  // 加载状态
  if (isLoading) {
    return (
      <div className='min-h-screen bg-background'>
        <TopMenu />
        <div className='flex items-center justify-center min-h-[400px]'>
          <Loader2 className='h-8 w-8 animate-spin' />
        </div>
      </div>
    )
  }

  // 错误状态
  if (error || !template) {
    return (
      <div className='min-h-screen bg-background'>
        <TopMenu />
        <div className='container mx-auto px-4 py-8'>
          <div className='text-center py-12'>
            <p className='text-muted-foreground mb-4'>
              {error ? t('messages.error') : t('messages.templateNotFound')}
            </p>
            <Button variant='outline' onClick={() => navigate({ to: '/templates' })}>
              {t('messages.backToTemplates')}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className='min-h-screen bg-background'>
      <TopMenu />

      {/* Breadcrumb/Navigation */}
      <div className='container mx-auto px-4 py-4'>
        <Button variant='ghost' size='sm' onClick={() => navigate({ to: '/templates' })}>
          <ArrowLeft className='h-4 w-4 mr-2' />
          {t('navigation.back')}
        </Button>
      </div>

      <div className='container mx-auto px-4 py-6'>
        <div className='flex gap-6 items-start h-[600px]'>
          {/* Left side - Template preview */}
          <div className='flex-1 h-full'>
            <div className='h-full bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 rounded-2xl overflow-hidden relative'>
              {template.image ? (
                <img
                  src={template.image.startsWith('http') ? template.image : `${BASE_API_URL}${template.image}`}
                  alt={template.title}
                  className='w-full h-full object-cover'
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                    e.currentTarget.nextElementSibling?.classList.remove('hidden')
                  }}
                />
              ) : null}
              <div
                className={`absolute inset-0 flex items-center justify-center text-muted-foreground ${template.image ? 'hidden' : ''}`}
              >
                <div className='text-center'>
                  <Wand2 className='h-12 w-12 mx-auto mb-2' />
                  <p>{t('template.preview')}</p>
                </div>
              </div>

              {/* Template info overlay */}
              <div className='absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-6'>
                <div className='mb-2'>
                  <h3 className='text-xl font-bold text-white'>{template.title}</h3>
                </div>
                <p className='text-white/80 text-sm'>{template.description}</p>
              </div>
            </div>
          </div>

          {/* Right side - Input form */}
          <div className='flex-1 h-full flex flex-col'>
            {/* Header */}
            <div className='mb-6'>
              <h2 className='text-2xl font-bold mb-2'>{template.title}</h2>
              <p className='text-muted-foreground'>
                {t('form.subtitle')}
              </p>
            </div>

            {/* Template usage info */}
            <div className='mb-4'>
              <div className='flex items-center gap-2 mb-3'>
                <span className='text-sm text-muted-foreground'>{t('template.using')}</span>
                <Badge variant='outline' className='flex items-center gap-1'>
                  <Wand2 className='h-3 w-3' />
                  {template.title}
                </Badge>
              </div>

              <p className='text-sm text-muted-foreground'>
                {t('form.characterName.description')}
              </p>
            </div>

            {/* Enhanced Input Area */}
            <div className='flex-1'>
              <motion.div
                className={cn(
                  'w-full h-full flex flex-col border border-primary/20 rounded-2xl p-4 hover:border-primary/40 transition-all duration-300 cursor-text gap-4 bg-background/80 backdrop-blur-xl relative',
                  isFocused && 'border-primary/40'
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
                {/* Uploaded Images */}
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
                            src={image.localPreviewUrl || image.serverUrl || `/api/file/${image.file_id}?redirect=true`}
                            alt='Uploaded image'
                            className='w-full h-full object-cover rounded-md'
                            draggable={false}
                            onError={(e) => {
                              // 如果本地预览失败，尝试使用服务器URL
                              const target = e.target as HTMLImageElement
                              if (image.localPreviewUrl && target.src === image.localPreviewUrl) {
                                target.src = image.serverUrl || `/api/file/${image.file_id}?redirect=true`
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

                {/* Text Input */}
                <div className='flex-1'>
                  <Textarea
                    ref={textareaRef}
                    className='w-full h-full border-none outline-none resize-none min-h-[100px]'
                    placeholder={t('form.characterName.placeholder')}
                    value={characterName}
                    onChange={(e) => setCharacterName(e.target.value)}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleGenerate()
                      }
                    }}
                  />
                </div>

                {/* Controls */}
                <div className='flex items-center justify-between gap-2 w-full mt-auto'>
                  <div className='flex items-center gap-2 flex-wrap'>
                    {/* File Upload */}
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

                    {/* Model Selector */}
                    <ModelSelectorV3 />

                    {/* Aspect Ratio Selector */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant='outline' className='flex items-center gap-1' size={'sm'}>
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
                            className='absolute bottom-full mb-2 left-0 bg-background border border-border rounded-lg p-4 shadow-lg min-w-48'
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            transition={{ duration: 0.15, ease: 'easeOut' }}
                          >
                            <div className='flex flex-col gap-3'>
                              <div className='flex items-center justify-between'>
                                <span className='text-sm font-medium'>{t('form.quantity')}</span>
                                <span className='text-sm text-muted-foreground'>{quantity}</span>
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

                  {/* Generate Button */}
                  {isGenerating || isCanvasCreating ? (
                    <div className='flex items-center gap-2 shrink-0'>
                      {generatingStep && (
                        <span className='text-sm text-muted-foreground animate-pulse'>
                          {generatingStep}
                        </span>
                      )}
                      <Button className='relative' variant='default' size='icon' disabled>
                        <Loader2 className='size-4 animate-spin' />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      className='shrink-0'
                      variant='default'
                      size='icon'
                      onClick={handleGenerate}
                      disabled={!characterName.trim() || images.length === 0}
                    >
                      <Play className='size-4' />
                    </Button>
                  )}
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
