import { sendMessages } from '@/api/chat'
import Blur from '@/components/common/Blur'
import { ScrollArea } from '@/components/ui/scroll-area'
import * as ISocket from '@/types/socket'
import {
  AssistantMessage,
  Message,
  Model,
  PendingType,
  Session,
} from '@/types/types'
import { useSearch } from '@tanstack/react-router'
import { produce } from 'immer'
import { motion } from 'motion/react'
import { nanoid } from 'nanoid'
import {
  Dispatch,
  SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { useTranslation } from 'react-i18next'
import { PhotoProvider } from 'react-photo-view'
import { toast } from 'sonner'
import ShinyText from '../ui/shiny-text'
import ChatTextarea from './ChatTextarea'
import MessageRegular from './Message/Regular'
import { ToolCallContent } from './Message/ToolCallContent'
import ToolCallTag from './Message/ToolCallTag'
import SessionSelector from './SessionSelector'
import ChatSpinner from './Spinner'
import ToolcallProgressUpdate from './ToolcallProgressUpdate'
import ShareTemplateDialog from './ShareTemplateDialog'

import { useConfigs } from '@/contexts/configs'
import 'react-photo-view/dist/react-photo-view.css'
import { DEFAULT_SYSTEM_PROMPT } from '@/constants'
import { ModelInfo, ToolInfo } from '@/api/model'
import { Button } from '@/components/ui/button'
import { Share2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import { eventBus, TCanvasMagicGenerateEvent } from '@/lib/event'
import MixedContent, {
  MixedContentImages,
  MixedContentText,
} from './Message/MixedContent'
import { connectChatStream } from './connectSSE'
import ChatMagicGenerator from './ChatMagicGenerator'

type ChatInterfaceProps = {
  canvasId: string
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ canvasId }) => {
  const { t } = useTranslation()
  const router = useRouter()
  const searchSessionId = router.query.session_id as string
  const [session, setSession] = useState<{
    id: string
    title: string
  } | null>(null)
  const { authStatus } = useAuth()
  const queryClient = useQueryClient()

  // SSE连接相关状态
  const eventSourceRef = useRef<EventSource | null>(null)
  const [sseConnected, setSseConnected] = useState(false)

  const [messages, setMessages] = useState<Message[]>([])
  const [pending, setPending] = useState<PendingType>(false)
  const mergedToolCallIds = useRef<string[]>([])
  const [expandingToolCalls, setExpandingToolCalls] = useState<string[]>([])
  const [pendingToolConfirmations, setPendingToolConfirmations] = useState<
    string[]
  >([])

  const scrollRef = useRef<HTMLDivElement>(null)
  const isAtBottomRef = useRef(false)

  const scrollToBottom = useCallback(() => {
    if (!isAtBottomRef.current) {
      return
    }
    setTimeout(() => {
      scrollRef.current?.scrollTo({
        top: scrollRef.current!.scrollHeight,
        behavior: 'smooth',
      })
    }, 200)
  }, [])

  const mergeToolCallResult = (messages: Message[]) => {
    const messagesWithToolCallResult = messages.map((message, index) => {
      if (message.role === 'assistant' && message.tool_calls) {
        for (const toolCall of message.tool_calls) {
          // From the next message, find the tool call result
          for (let i = index + 1; i < messages.length; i++) {
            const nextMessage = messages[i]
            if (
              nextMessage.role === 'tool' &&
              nextMessage.tool_call_id === toolCall.id
            ) {
              toolCall.result = nextMessage.content
              mergedToolCallIds.current.push(toolCall.id)
            }
          }
        }
      }
      return message
    })

    return messagesWithToolCallResult
  }

  const handleDelta = useCallback(
    (data: ISocket.SessionDeltaEvent) => {
      setPending('text')
      setMessages(
        produce((prev) => {
          const last = prev.at(-1)
          if (
            last?.role === 'assistant' &&
            last.content != null &&
            last.tool_calls == null
          ) {
            if (typeof last.content === 'string') {
              last.content += data.text
            } else if (
              last.content &&
              last.content.at(-1) &&
              last.content.at(-1)!.type === 'text'
            ) {
              ; (last.content.at(-1) as { text: string }).text += data.text
            }
          } else {
            prev.push({
              role: 'assistant',
              content: data.text,
            })
          }
        })
      )
      scrollToBottom()
    },
    [scrollToBottom]
  )

  const handleToolCall = useCallback(
    (data: ISocket.SessionToolCallEvent) => {
      const existToolCall = messages.find(
        (m) =>
          m.role === 'assistant' &&
          m.tool_calls &&
          m.tool_calls.find((t) => t.id == data.id)
      )

      if (existToolCall) {
        return
      }

      setMessages(
        produce((prev) => {
          console.log('👇tool_call event get', data)
          setPending('tool')
          prev.push({
            role: 'assistant',
            content: '',
            tool_calls: [
              {
                type: 'function',
                function: {
                  name: data.name,
                  arguments: '',
                },
                id: data.id,
              },
            ],
          })
        })
      )

      setExpandingToolCalls(
        produce((prev) => {
          prev.push(data.id)
        })
      )
    },
    [messages]
  )

  const handleToolCallPendingConfirmation = useCallback(
    (data: ISocket.SessionToolCallPendingConfirmationEvent) => {
      const existToolCall = messages.find(
        (m) =>
          m.role === 'assistant' &&
          m.tool_calls &&
          m.tool_calls.find((t) => t.id == data.id)
      )

      if (existToolCall) {
        return
      }

      setMessages(
        produce((prev) => {
          console.log('👇tool_call_pending_confirmation event get', data)
          setPending('tool')
          prev.push({
            role: 'assistant',
            content: '',
            tool_calls: [
              {
                type: 'function',
                function: {
                  name: data.name,
                  arguments: data.arguments,
                },
                id: data.id,
              },
            ],
          })
        })
      )

      setPendingToolConfirmations(
        produce((prev) => {
          prev.push(data.id)
        })
      )

      // 自动展开需要确认的工具调用
      setExpandingToolCalls(
        produce((prev) => {
          if (!prev.includes(data.id)) {
            prev.push(data.id)
          }
        })
      )
    },
    [messages]
  )

  const handleToolCallConfirmed = useCallback(
    (data: ISocket.SessionToolCallConfirmedEvent) => {
      setPendingToolConfirmations(
        produce((prev) => {
          return prev.filter((id) => id !== data.id)
        })
      )

      setExpandingToolCalls(
        produce((prev) => {
          if (!prev.includes(data.id)) {
            prev.push(data.id)
          }
        })
      )
    },
    []
  )

  const handleToolCallCancelled = useCallback(
    (data: ISocket.SessionToolCallCancelledEvent) => {
      setPendingToolConfirmations(
        produce((prev) => {
          return prev.filter((id) => id !== data.id)
        })
      )

      // 更新工具调用的状态
      setMessages(
        produce((prev) => {
          prev.forEach((msg) => {
            if (msg.role === 'assistant' && msg.tool_calls) {
              msg.tool_calls.forEach((tc) => {
                if (tc.id === data.id) {
                  // 添加取消状态标记
                  tc.result = '工具调用已取消'
                }
              })
            }
          })
        })
      )
    },
    []
  )

  const handleToolCallArguments = useCallback(
    (data: ISocket.SessionToolCallArgumentsEvent) => {
      setMessages(
        produce((prev) => {
          setPending('tool')
          const lastMessage = prev.find(
            (m) =>
              m.role === 'assistant' &&
              m.tool_calls &&
              m.tool_calls.find((t) => t.id == data.id)
          ) as AssistantMessage

          if (lastMessage) {
            const toolCall = lastMessage.tool_calls!.find(
              (t) => t.id == data.id
            )
            if (toolCall) {
              // 检查是否是待确认的工具调用，如果是则跳过参数追加
              if (pendingToolConfirmations.includes(data.id)) {
                return
              }
              toolCall.function.arguments += data.text
            }
          }
        })
      )
      scrollToBottom()
    },
    [scrollToBottom, pendingToolConfirmations]
  )

  const handleToolCallResult = useCallback(
    (data: ISocket.SessionToolCallResultEvent) => {
      console.log('😘🖼️tool_call_result event get', data)
      // TODO: support other non string types of returning content like image_url
      if (data.message.content) {
        setMessages(
          produce((prev) => {
            prev.forEach((m) => {
              if (m.role === 'assistant' && m.tool_calls) {
                m.tool_calls.forEach((t) => {
                  if (t.id === data.id) {
                    t.result = data.message.content
                  }
                })
              }
            })
          })
        )
      }
    },
    [canvasId]
  )

  const handleImageGenerated = useCallback(
    (data: ISocket.SessionImageGeneratedEvent) => {
      console.log('⭐️dispatching image_generated', data)
      setPending('image')
      // Emit the event to the mitt event bus so other components can listen
      eventBus.emit('Socket::Session::ImageGenerated', data)
    },
    [canvasId]
  )

  const handleVideoGenerated = useCallback(
    (data: ISocket.SessionVideoGeneratedEvent) => {
      console.log('🎥 dispatching video_generated', data)
      setPending('video')
      // Emit the event to the mitt event bus so other components can listen
      eventBus.emit('Socket::Session::VideoGenerated', data)
    },
    [canvasId]
  )

  const handleAllMessages = useCallback(
    (data: ISocket.SessionAllMessagesEvent) => {
      setMessages(() => {
        console.log('👇all_messages', data.messages)
        return data.messages
      })
      setMessages(mergeToolCallResult(data.messages))
      scrollToBottom()
    },
    [scrollToBottom]
  )

  const handleDone = useCallback(
    (data: ISocket.SessionDoneEvent) => {
      setPending(false)
      scrollToBottom()

      // 聊天输出完毕后更新余额
      if (authStatus.is_logged_in) {
        queryClient.invalidateQueries({ queryKey: ['balance'] })
      }
    },
    [scrollToBottom, authStatus.is_logged_in, queryClient]
  )

  const handleError = useCallback((data: ISocket.SessionErrorEvent) => {
    setPending(false)
    toast.error('Error: ' + data.error, {
      closeButton: true,
      duration: 3600 * 1000,
    })
  }, [])

  const handleInfo = useCallback((data: ISocket.SessionInfoEvent) => {
    toast.info(data.info, {
      closeButton: true,
      duration: 10 * 1000,
    })
  }, [])

  // SSE连接和事件监听
  const connectSSE = useCallback(
    (
      sessionId: string | undefined,
      messages: Message[],
      configs?: { textModel?: Model; toolList?: ToolInfo[]; magic_configs?: { screenshot_image?: string; is_generate_video?: boolean } } | null,
      lastEventId?: string | null
    ) => {
      const is_new_session = !sessionId
      if (!sessionId) {
        sessionId = nanoid()
        window.history.pushState(
          {},
          '',
          `/canvas/${canvasId}?session_id=${sessionId}`
        )
        setSession({
          id: sessionId,
          title:
            typeof messages[0]?.content === 'string'
              ? messages[0]?.content
              : 'New Chat',
        })
      }

      console.log('🔄 Starting SSE stream for session:', sessionId)
      setPending('text')

      connectChatStream(
        sessionId,
        messages,
        is_new_session,
        canvasId,
        {
          handleDelta,
          handleToolCall,
          handleToolCallPendingConfirmation,
          handleToolCallConfirmed,
          handleToolCallCancelled,
          handleToolCallArguments,
          handleToolCallResult,
          handleImageGenerated,
          handleVideoGenerated,
          handleAllMessages,
          handleDone,
          handleError,
        },
        configs,
        lastEventId
      )
    },
    []
  )

  useEffect(() => {
    const handleScroll = () => {
      if (scrollRef.current) {
        isAtBottomRef.current =
          scrollRef.current.scrollHeight - scrollRef.current.scrollTop <=
          scrollRef.current.clientHeight + 1
      }
    }

    const scrollEl = scrollRef.current
    scrollEl?.addEventListener('scroll', handleScroll)

    return () => {
      scrollEl?.removeEventListener('scroll', handleScroll)
    }
  }, [])

  const fetchSession = useCallback(
    async (sessionId: string) => {
      const searchSessionId = sessionId
      const resp = await fetch('/api/chat_session/' + searchSessionId)
      if (!resp.ok) {
        console.log('initChat resp not ok', resp)
        setMessages([])
        setSession(null)
        return
      }

      const data = (await resp.json()) as {
        session: { id: string; title: string }
        messages: Message[]
      }

      // Handle new response format with session and messages
      if (data.session && data.messages) {
        const msgs = data.messages?.length ? data.messages : []
        setMessages(mergeToolCallResult(msgs))
        setSession({
          id: data.session.id,
          title: data.session.title,
        })
        // recover the SSE connection
        connectSSE(sessionId, data.messages, null, '0')
      } else {
        console.log('initChat resp not ok', data)
        setMessages([])
        setSession(null)
      }

      scrollToBottom()
    },
    [scrollToBottom]
  )

  useEffect(() => {
    if (searchSessionId) {
      fetchSession(searchSessionId)
    }
  }, [searchSessionId, fetchSession])

  const onSelectSession = (session: { id: string; title: string }) => {
    if (session?.id) {
      fetchSession(session?.id)
    }
    window.history.pushState(
      {},
      '',
      `/canvas/${canvasId}?session_id=${session?.id}`
    )
  }

  const onClickNewChat = () => {
    setSession(null)
    window.history.pushState({}, '', `/canvas/${canvasId}?session_id=0`)
    setMessages([])
  }

  const onSendMessages = useCallback(
    (data: Message[], configs: { textModel: Model; toolList: ToolInfo[]; magic_configs?: { screenshot_image?: string; is_generate_video?: boolean } }) => {
      setMessages(data)

      // 启动SSE流，传入配置
      connectSSE(session?.id, data, configs)

      scrollToBottom()
    },
    [canvasId, session, scrollToBottom, connectSSE]
  )

  const handleCancelChat = useCallback(() => {
    setPending(false)

    // 关闭SSE连接
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
  }, [])

  return (
    <PhotoProvider>
      <div className='flex flex-col h-screen relative'>
        {/* Chat messages */}

        <header className='flex items-center px-2 py-2 w-full'>
          <div className='flex-1 min-w-0'>
            <SessionSelector
              session={session}
              canvasId={canvasId}
              onClickNewChat={onClickNewChat}
              onSelectSession={onSelectSession}
            />
          </div>

          {/* SSE Connection Status */}
          {/* <div className='flex items-center gap-2 text-xs text-muted-foreground mr-2'>
            <div
              className={`w-2 h-2 rounded-full ${sseConnected ? 'bg-green-500' : 'bg-red-500'}`}
            />
            {sseConnected ? 'Connected' : 'Disconnected'}
          </div> */}

          {/* Share Template Button */}
          {/* {authStatus.is_logged_in && (
            <Button
              variant="outline"
              size="sm"
              className="ml-2 shrink-0"
              onClick={() => setShowShareDialog(true)}
            >
              <Share2 className="h-4 w-4 mr-1" />
            </Button>
          )} */}
        </header>

        <ScrollArea
          className='h-[calc(100vh-45px)] pb-[200px]'
          viewportRef={scrollRef}
        >
          {messages.length > 0 ? (
            <div className='flex flex-col flex-1 px-4 pb-50 pt-15'>
              {/* Messages */}
              {messages.map((message, idx) => (
                <div key={`${idx}`} className='flex flex-col gap-4 mb-2'>
                  {/* Regular message content */}
                  {typeof message.content == 'string' &&
                    (message.role !== 'tool' ? (
                      <MessageRegular
                        message={message}
                        content={message.content}
                      />
                    ) : message.tool_call_id &&
                      mergedToolCallIds.current.includes(
                        message.tool_call_id
                      ) ? (
                      <></>
                    ) : (
                      <ToolCallContent
                        expandingToolCalls={expandingToolCalls}
                        message={message}
                      />
                    ))}

                  {/* 混合内容消息的文本部分 - 显示在聊天框内 */}
                  {Array.isArray(message.content) && (
                    <>
                      <MixedContentImages contents={message.content} />
                      <MixedContentText
                        message={message}
                        contents={message.content}
                      />
                    </>
                  )}

                  {message.role === 'assistant' &&
                    message.tool_calls &&
                    message.tool_calls.map((toolCall, i) => {
                      return (
                        <ToolCallTag
                          key={toolCall.id}
                          toolCall={toolCall}
                          isExpanded={expandingToolCalls.includes(toolCall.id)}
                          onToggleExpand={() => {
                            if (expandingToolCalls.includes(toolCall.id)) {
                              setExpandingToolCalls((prev) =>
                                prev.filter((id) => id !== toolCall.id)
                              )
                            } else {
                              setExpandingToolCalls((prev) => [
                                ...prev,
                                toolCall.id,
                              ])
                            }
                          }}
                          requiresConfirmation={pendingToolConfirmations.includes(
                            toolCall.id
                          )}
                          onConfirm={() => {
                            // 发送确认事件到后端
                            if (session?.id) {
                              fetch('/api/tool_confirmation', {
                                method: 'POST',
                                headers: {
                                  'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({
                                  session_id: session?.id,
                                  tool_call_id: toolCall.id,
                                  confirmed: true,
                                }),
                              })
                            }
                          }}
                          onCancel={() => {
                            // 发送取消事件到后端
                            if (session?.id) {
                              fetch('/api/tool_confirmation', {
                                method: 'POST',
                                headers: {
                                  'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({
                                  session_id: session?.id,
                                  tool_call_id: toolCall.id,
                                  confirmed: false,
                                }),
                              })
                            }
                          }}
                        />
                      )
                    })}
                </div>
              ))}
              {pending && <ChatSpinner pending={pending} />}
              {pending && session?.id && (
                <ToolcallProgressUpdate sessionId={session?.id} />
              )}
            </div>
          ) : (
            <motion.div className='flex flex-col h-full p-4 items-start justify-start pt-16 select-none'>
              <motion.span
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className='text-muted-foreground text-3xl'
              >
                <ShinyText text='Hello, Jaaz!' />
              </motion.span>
              <motion.span
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className='text-muted-foreground text-2xl'
              >
                <ShinyText text='How can I help you today?' />
              </motion.span>
            </motion.div>
          )}
        </ScrollArea>

        <div className='p-2 gap-2 sticky bottom-0'>
          <ChatTextarea
            sessionId={session?.id || ''}
            pending={!!pending}
            messages={messages}
            onSendMessages={onSendMessages}
            onCancelChat={handleCancelChat}
          />

          {/* 魔法生成组件 */}
          <ChatMagicGenerator
            sessionId={session?.id || ''}
            canvasId={canvasId}
            messages={messages}
            setMessages={setMessages}
            setPending={setPending}
            scrollToBottom={scrollToBottom}
            connectSSE={connectSSE}
          />
        </div>
      </div>

      {/* Share Template Dialog */}
      {/* <ShareTemplateDialog
        open={showShareDialog}
        onOpenChange={setShowShareDialog}
        canvasId={canvasId}
        sessionId={sessionId || ''}
        messages={messages}
      /> */}
    </PhotoProvider>
  )
}

export default ChatInterface
