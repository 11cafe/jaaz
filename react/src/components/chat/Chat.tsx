import { sendMessages } from '@/api/chat'
import Blur from '@/components/common/Blur'
import { ScrollArea } from '@/components/ui/scroll-area'
import * as ISocket from '@/types/socket'
import ChatMagicGenerator from './ChatMagicGenerator'
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

type ChatInterfaceProps = {
  canvasId: string
  sessionList: Session[]
  setSessionList: Dispatch<SetStateAction<Session[]>>
  sessionId: string
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({
  canvasId,
  sessionList,
  setSessionList,
  sessionId: searchSessionId,
}) => {
  const { t } = useTranslation()
  const [session, setSession] = useState<Session | null>(null)
  const { initCanvas, setInitCanvas } = useConfigs()
  const { authStatus } = useAuth()
  const [showShareDialog, setShowShareDialog] = useState(false)
  const queryClient = useQueryClient()

  // 直接使用WebSocket原生连接
  const websocketRef = useRef<WebSocket | null>(null)
  const [wsConnected, setWsConnected] = useState(false)

  useEffect(() => {
    if (sessionList.length > 0) {
      let _session = null
      if (searchSessionId) {
        _session = sessionList.find((s) => s.id === searchSessionId) || null
      } else {
        _session = sessionList[0]
      }
      setSession(_session)
    } else {
      setSession(null)
    }
  }, [sessionList, searchSessionId])

  const [messages, setMessages] = useState<Message[]>([])
  const [pending, setPending] = useState<PendingType>(
    initCanvas ? 'text' : false
  )
  const mergedToolCallIds = useRef<string[]>([])

  const sessionId = session?.id ?? searchSessionId

  const sessionIdRef = useRef<string>(session?.id || nanoid())
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
      if (data.session_id && data.session_id !== sessionId) {
        return
      }

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
              ;(last.content.at(-1) as { text: string }).text += data.text
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
    [sessionId, scrollToBottom]
  )

  const handleToolCall = useCallback(
    (data: ISocket.SessionToolCallEvent) => {
      if (data.session_id && data.session_id !== sessionId) {
        return
      }

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
    [sessionId, messages]
  )

  const handleToolCallPendingConfirmation = useCallback(
    (data: ISocket.SessionToolCallPendingConfirmationEvent) => {
      if (data.session_id && data.session_id !== sessionId) {
        return
      }

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
    [sessionId, messages]
  )

  const handleToolCallConfirmed = useCallback(
    (data: ISocket.SessionToolCallConfirmedEvent) => {
      if (data.session_id && data.session_id !== sessionId) {
        return
      }

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
    [sessionId]
  )

  const handleToolCallCancelled = useCallback(
    (data: ISocket.SessionToolCallCancelledEvent) => {
      if (data.session_id && data.session_id !== sessionId) {
        return
      }

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
    [sessionId]
  )

  const handleToolCallArguments = useCallback(
    (data: ISocket.SessionToolCallArgumentsEvent) => {
      if (data.session_id && data.session_id !== sessionId) {
        return
      }

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
    [sessionId, scrollToBottom, pendingToolConfirmations]
  )

  const handleToolCallResult = useCallback(
    (data: ISocket.SessionToolCallResultEvent) => {
      console.log('😘🖼️tool_call_result event get', data)
      if (data.session_id && data.session_id !== sessionId) {
        return
      }
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
    [canvasId, sessionId]
  )

  const handleImageGenerated = useCallback(
    (data: ISocket.SessionImageGeneratedEvent) => {
      if (
        data.canvas_id &&
        data.canvas_id !== canvasId &&
        data.session_id !== sessionId
      ) {
        return
      }

      console.log('⭐️dispatching image_generated', data)
      setPending('image')
    },
    [canvasId, sessionId]
  )

  const handleAllMessages = useCallback(
    (data: ISocket.SessionAllMessagesEvent) => {
      if (data.session_id && data.session_id !== sessionId) {
        return
      }

      setMessages(() => {
        console.log('👇all_messages', data.messages)
        return data.messages
      })
      setMessages(mergeToolCallResult(data.messages))
      scrollToBottom()
    },
    [sessionId, scrollToBottom]
  )

  const handleDone = useCallback(
    (data: ISocket.SessionDoneEvent) => {
      if (data.session_id && data.session_id !== sessionId) {
        return
      }

      setPending(false)
      scrollToBottom()

      // 聊天输出完毕后更新余额
      if (authStatus.is_logged_in) {
        queryClient.invalidateQueries({ queryKey: ['balance'] })
      }
    },
    [sessionId, scrollToBottom, authStatus.is_logged_in, queryClient]
  )

  const handleError = useCallback((data: ISocket.SessionErrorEvent) => {
    setPending(false)
    toast.error('Error: ' + data.error, {
      closeButton: true,
      duration: 3600 * 1000,
      style: { color: 'red' },
    })
  }, [])

  const handleInfo = useCallback((data: ISocket.SessionInfoEvent) => {
    toast.info(data.info, {
      closeButton: true,
      duration: 10 * 1000,
    })
  }, [])

  // WebSocket连接和事件监听
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

    // 建立原生WebSocket连接
    const connectWebSocket = () => {
      // 关闭现有连接
      if (websocketRef.current) {
        websocketRef.current.close()
      }

      // 创建新的WebSocket连接
      const wsUrl = 'ws://localhost:3999/ws?session_id=' + sessionId

      websocketRef.current = new WebSocket(wsUrl)

      websocketRef.current.onopen = () => {
        console.log('✅ WebSocket connected')
        setWsConnected(true)
      }

      websocketRef.current.onclose = () => {
        console.log('🔌 WebSocket disconnected')
        setWsConnected(false)

        // 自动重连
        setTimeout(() => {
          if (
            !websocketRef.current ||
            websocketRef.current.readyState === WebSocket.CLOSED
          ) {
            console.log('🔄 WebSocket reconnecting...')
            connectWebSocket()
          }
        }, 3000)
      }

      websocketRef.current.onerror = (error) => {
        console.error('❌ WebSocket error:', error)
        setWsConnected(false)
      }

      websocketRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)

          // 根据消息类型分发到对应的处理函数
          switch (data.type) {
            case ISocket.SessionEventType.Delta:
              handleDelta(data)
              break
            case ISocket.SessionEventType.ToolCall:
              handleToolCall(data)
              break
            case ISocket.SessionEventType.ToolCallPendingConfirmation:
              handleToolCallPendingConfirmation(data)
              break
            case ISocket.SessionEventType.ToolCallConfirmed:
              handleToolCallConfirmed(data)
              break
            case ISocket.SessionEventType.ToolCallCancelled:
              handleToolCallCancelled(data)
              break
            case ISocket.SessionEventType.ToolCallArguments:
              handleToolCallArguments(data)
              break
            case ISocket.SessionEventType.ToolCallResult:
              handleToolCallResult(data)
              break
            case ISocket.SessionEventType.ImageGenerated:
              handleImageGenerated(data)
              break
            case ISocket.SessionEventType.AllMessages:
              handleAllMessages(data)
              break
            case ISocket.SessionEventType.Done:
              handleDone(data)
              break
            case ISocket.SessionEventType.Error:
              handleError(data)
              break
            case ISocket.SessionEventType.Info:
              handleInfo(data)
              break
            default:
              console.log('⚠️ Unknown message type:', data.type)
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error)
        }
      }
    }

    // 建立连接
    connectWebSocket()

    return () => {
      scrollEl?.removeEventListener('scroll', handleScroll)

      // 清理WebSocket连接
      if (websocketRef.current) {
        websocketRef.current.close()
        websocketRef.current = null
      }
    }
  }, [
    sessionId,
    handleDelta,
    handleToolCall,
    handleToolCallPendingConfirmation,
    handleToolCallConfirmed,
    handleToolCallCancelled,
    handleToolCallArguments,
    handleToolCallResult,
    handleImageGenerated,
    handleAllMessages,
    handleDone,
    handleError,
    handleInfo,
  ])

  const initChat = useCallback(async () => {
    if (!sessionId) {
      return
    }

    sessionIdRef.current = sessionId

    const resp = await fetch('/api/chat_session/' + sessionId)
    const data = await resp.json()
    const msgs = data?.length ? data : []

    setMessages(mergeToolCallResult(msgs))
    if (msgs.length > 0) {
      setInitCanvas(false)
    }

    scrollToBottom()
  }, [sessionId, scrollToBottom, setInitCanvas])

  useEffect(() => {
    initChat()
  }, [sessionId, initChat])

  const onSelectSession = (sessionId: string) => {
    setSession(sessionList.find((s) => s.id === sessionId) || null)
    window.history.pushState(
      {},
      '',
      `/canvas/${canvasId}?sessionId=${sessionId}`
    )
  }

  const onClickNewChat = () => {
    const newSession: Session = {
      id: nanoid(),
      title: t('chat:newChat'),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      model: session?.model || 'gpt-4o',
      provider: session?.provider || 'openai',
    }

    setSessionList((prev) => [...prev, newSession])
    onSelectSession(newSession.id)
  }

  const onSendMessages = useCallback(
    (data: Message[], configs: { textModel: Model; toolList: ToolInfo[] }) => {
      setPending('text')
      setMessages(data)

      sendMessages({
        sessionId: sessionId!,
        canvasId: canvasId,
        newMessages: data,
        textModel: configs.textModel,
        toolList: configs.toolList,
        systemPrompt:
          localStorage.getItem('system_prompt') || DEFAULT_SYSTEM_PROMPT,
      })

      if (searchSessionId !== sessionId) {
        window.history.pushState(
          {},
          '',
          `/canvas/${canvasId}?sessionId=${sessionId}`
        )
      }

      scrollToBottom()
    },
    [canvasId, sessionId, searchSessionId, scrollToBottom]
  )

  const handleCancelChat = useCallback(() => {
    setPending(false)
  }, [])

  return (
    <PhotoProvider>
      <div className='flex flex-col h-screen relative'>
        {/* Chat messages */}

        <header className='flex items-center px-2 py-2 absolute top-0 z-1 w-full'>
          <div className='flex-1 min-w-0'>
            <SessionSelector
              session={session}
              sessionList={sessionList}
              onClickNewChat={onClickNewChat}
              onSelectSession={onSelectSession}
            />
          </div>

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

          <Blur className='absolute top-0 left-0 right-0 h-full -z-1' />
        </header>

        <ScrollArea className='h-[calc(100vh-45px)]' viewportRef={scrollRef}>
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

                  {Array.isArray(message.content) &&
                    message.content.map((content, i) => (
                      <MessageRegular
                        key={i}
                        message={message}
                        content={content}
                      />
                    ))}

                  {message.role === 'assistant' &&
                    message.tool_calls &&
                    message.tool_calls.at(-1)?.function.name != 'finish' &&
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
                            fetch('/api/tool_confirmation', {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                              },
                              body: JSON.stringify({
                                session_id: sessionId,
                                tool_call_id: toolCall.id,
                                confirmed: true,
                              }),
                            })
                          }}
                          onCancel={() => {
                            // 发送取消事件到后端
                            fetch('/api/tool_confirmation', {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                              },
                              body: JSON.stringify({
                                session_id: sessionId,
                                tool_call_id: toolCall.id,
                                confirmed: false,
                              }),
                            })
                          }}
                        />
                      )
                    })}
                </div>
              ))}
              {pending && <ChatSpinner pending={pending} />}
              {pending && sessionId && (
                <ToolcallProgressUpdate sessionId={sessionId} />
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
            sessionId={sessionId!}
            pending={!!pending}
            messages={messages}
            onSendMessages={onSendMessages}
            onCancelChat={handleCancelChat}
          />

          {/* 魔法生成组件 */}
          <ChatMagicGenerator
            sessionId={sessionId || ''}
            canvasId={canvasId}
            messages={messages}
            setMessages={setMessages}
            setPending={setPending}
            scrollToBottom={scrollToBottom}
          />
        </div>
      </div>

      {/* Share Template Dialog */}
      <ShareTemplateDialog
        open={showShareDialog}
        onOpenChange={setShowShareDialog}
        canvasId={canvasId}
        sessionId={sessionId || ''}
        messages={messages}
      />
    </PhotoProvider>
  )
}

export default ChatInterface
