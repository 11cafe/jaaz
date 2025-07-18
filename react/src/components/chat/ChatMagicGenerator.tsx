import { sendMagicGenerate } from '@/api/magic'
import { useConfigs } from '@/contexts/configs'
import { eventBus, TCanvasMagicGenerateEvent } from '@/lib/event'
import { Message, Model, PendingType } from '@/types/types'
import { ModelInfo } from '@/api/model'
import { useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { DEFAULT_SYSTEM_PROMPT } from '@/constants'
import { toast } from 'sonner'
import { useLanguage } from '@/hooks/use-language'

// Track if warning has been shown
let hasShownWarning = false;

type ChatMagicGeneratorProps = {
    sessionId: string
    canvasId: string
    messages: Message[]
    setMessages: (messages: Message[]) => void
    setPending: (pending: PendingType) => void
    scrollToBottom: () => void
}

const ChatMagicGenerator: React.FC<ChatMagicGeneratorProps> = ({
    sessionId,
    canvasId,
    messages,
    setMessages,
    setPending,
    scrollToBottom
}) => {
    const { t } = useTranslation()
    const { currentLanguage } = useLanguage()
    const { textModels, selectedTools, providers } = useConfigs()
    const hasOpenaiProvider = textModels.some((model) => model.provider === 'openai')
    const hasJaazProvider = textModels.some((model) => model.provider === 'jaaz')

    // 使用 gpt4o
    let textModel: Model | undefined = undefined
    if (hasJaazProvider) {
        // 在 textModels 中找到 provider 为 jaaz 和 model 为 gpt-4o-mini 的模型
        textModel = textModels.find((model) => model.provider === 'jaaz' && model.model === 'gpt-4o-mini')
    } else if (hasOpenaiProvider) {
        // 在 textModels 中找到 provider 为 openai 和 model 为 gpt-4o-mini 的模型
        textModel = textModels.find((model) => model.provider === 'openai' && model.model === 'gpt-4o-mini')
    }

    const handleMagicGenerate = useCallback(
        async (data: TCanvasMagicGenerateEvent) => {
            if (!textModel) return

            if (!hasShownWarning && textModel.provider === 'openai') {
                toast.warning(t('canvas:messages.gptImagePermissionRequired'))
                hasShownWarning = true;
            }

            // 设置pending状态为text，表示正在处理
            setPending('text')

            const languageName = `common:languages.${currentLanguage}`

            // 创建包含图片的消息
            const magicMessage: Message = {
                role: 'user',
                content: [
                    {
                        type: 'text',
                        text: `Please analyze this image and generate a new one based on it. Always respond in ${t(languageName)}!`
                    },
                    {
                        type: 'image_url',
                        image_url: {
                            url: data.base64
                        }
                    },
                ]
            }

            // 更新消息列表
            const newMessages = [...messages, magicMessage]
            setMessages(newMessages)
            scrollToBottom()

            // 发送到后台
            try {
                await sendMagicGenerate({
                    sessionId: sessionId,
                    canvasId: canvasId,
                    newMessages: newMessages,
                    textModel: textModel,
                    toolList: selectedTools && selectedTools.length > 0 ? selectedTools : [],
                    systemPrompt: localStorage.getItem('system_prompt') || DEFAULT_SYSTEM_PROMPT,
                })

                scrollToBottom()
                console.log('魔法生成消息已发送到后台')
            } catch (error) {
                console.error('发送魔法生成消息失败:', error)
                // 发生错误时重置pending状态
                setPending(false)
            }
        },
        [sessionId, canvasId, messages, setMessages, setPending, selectedTools, scrollToBottom, textModel, currentLanguage, t]
    )

    useEffect(() => {
        // 监听魔法生成事件
        eventBus.on('Canvas::MagicGenerate', handleMagicGenerate)

        return () => {
            eventBus.off('Canvas::MagicGenerate', handleMagicGenerate)
        }
    }, [handleMagicGenerate])

    return null // 这是一个纯逻辑组件，不渲染UI
}

export default ChatMagicGenerator
