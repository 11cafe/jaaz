import { eventBus, TCanvasMagicGenerateEvent } from '@/lib/event'
import { Message, PendingType } from '@/types/types'
import { useCallback, useEffect } from 'react'

type ChatMagicGeneratorProps = {
    sessionId: string
    canvasId: string
    messages: Message[]
    setMessages: (messages: Message[]) => void
    setPending: (pending: PendingType) => void
    scrollToBottom: () => void
    // 新增：复用 Chat.tsx 的 connectSSE 函数
    connectSSE: (
        sessionId: string | undefined,
        messages: Message[],
        configs?: { textModel?: any; toolList?: any[]; magic_configs?: { screenshot_image?: string; is_generate_video?: boolean } } | null,
    ) => void
}

const ChatMagicGenerator: React.FC<ChatMagicGeneratorProps> = ({
    sessionId,
    canvasId,
    messages,
    setMessages,
    setPending,
    scrollToBottom,
    connectSSE
}) => {
    // Magic 生成处理函数
    const handleMagicGenerate = useCallback(
        async (data: TCanvasMagicGenerateEvent) => {
            // 根据类型设置不同的pending状态
            const pendingType = data.type === 'video' ? 'image' : 'text'
            setPending(pendingType)

            // 根据类型创建不同的消息内容
            const magicText = data.type === 'video' 
                ? '🎬 Magic Video! \n\njaaz will generate keyframes first, then generate video. \n\nWait about 2~3 minutes please...'
                : '✨ Magic Image! \n\nWait about 1~2 minutes please...'

            // 创建包含图片的消息
            const magicMessage: Message = {
                role: 'user',
                content: [
                    {
                        type: 'text',
                        text: magicText
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

            // 根据类型传入不同的配置参数
            const magic_configs = {
                screenshot_image: data.base64,
                is_generate_video: data.type === 'video'
            }

            // 直接调用 connectSSE 函数，传入 magic 生成参数
            connectSSE(
                sessionId,
                newMessages,
                {
                    magic_configs
                }
            )
        },
        [sessionId, messages, setMessages, setPending, scrollToBottom, connectSSE]
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
