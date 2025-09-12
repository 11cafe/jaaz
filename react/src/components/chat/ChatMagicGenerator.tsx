import { sendMagicGenerate } from '@/api/magic'
import { useConfigs } from '@/contexts/configs'
import { eventBus, TCanvasMagicGenerateEvent } from '@/lib/event'
import { Message, PendingType } from '@/types/types'
import { useCallback, useEffect } from 'react'
import { DEFAULT_SYSTEM_PROMPT } from '@/constants'
import { useAuth } from '@/contexts/AuthContext'

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
    const { setShowLoginDialog } = useConfigs()
    const { authStatus } = useAuth()

    const handleMagicGenerate = useCallback(
        async (data: TCanvasMagicGenerateEvent) => {
            console.log('[ChatMagicGenerator] 接收到Magic Generation事件:', {
                fileId: data.fileId,
                timestamp: data.timestamp,
                width: data.width,
                height: data.height,
                base64Length: data.base64.length
            });

            if (!authStatus.is_logged_in) {
                console.warn('[ChatMagicGenerator] 用户未登录，显示登录对话框');
                setShowLoginDialog(true)
                return
            }

            try {
                // 设置pending状态为text，表示正在处理
                console.log('[ChatMagicGenerator] 设置pending状态为text');
                setPending('text')

                // 创建包含图片的消息
                const magicMessage: Message = {
                    role: 'user',
                    content: [
                        {
                            type: 'text',
                            text: '✨ Magic Magic! Wait about 1~2 minutes please...'
                        },
                        {
                            type: 'image_url',
                            image_url: {
                                url: data.base64
                            }
                        },
                    ]
                }
                console.log('[ChatMagicGenerator] 创建魔法消息:', {
                    role: magicMessage.role,
                    contentLength: magicMessage.content.length
                });

                // 更新消息列表
                const newMessages = [...messages, magicMessage]
                console.log('[ChatMagicGenerator] 更新消息列表，新消息数量:', newMessages.length);
                setMessages(newMessages)
                scrollToBottom()

                // 发送到后台
                console.log('[ChatMagicGenerator] 准备发送到后台:', {
                    sessionId,
                    canvasId,
                    messagesCount: newMessages.length
                });
                
                const result = await sendMagicGenerate({
                    sessionId: sessionId,
                    canvasId: canvasId,
                    newMessages: newMessages,
                    systemPrompt: localStorage.getItem('system_prompt') || DEFAULT_SYSTEM_PROMPT,
                })

                console.log('[ChatMagicGenerator] 魔法生成请求成功发送到后台，结果:', result);
                scrollToBottom()
            } catch (error) {
                console.error('[ChatMagicGenerator] 发送魔法生成消息失败:', error)
                console.error('[ChatMagicGenerator] 错误详情:', {
                    name: error instanceof Error ? error.name : 'Unknown',
                    message: error instanceof Error ? error.message : String(error),
                    stack: error instanceof Error ? error.stack : undefined
                });
                // 发生错误时重置pending状态
                setPending(false)
            }
        },
        [sessionId, canvasId, messages, setMessages, setPending, scrollToBottom, authStatus.is_logged_in, setShowLoginDialog]
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
