import { sendMessages } from '@/api/chat'
import Blur from '@/components/common/Blur'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useWebSocket } from '@/hooks/use-websocket'
import { eventBus, TEvents } from '@/lib/event'
import { Message, Model, PendingType, Session } from '@/types/types'
import { useSearch } from '@tanstack/react-router'
import { motion } from 'motion/react'
import { nanoid } from 'nanoid'
import { useCallback, useEffect, useRef, useState } from 'react'
import { PhotoProvider } from 'react-photo-view'
import { toast } from 'sonner'
import ShinyText from '../ui/shiny-text'
import ChatTextarea from './ChatTextarea'
import MessageRegular from './Message/Regular'
import ToolCallContent from './Message/ToolCallContent'
import ToolCallTag from './Message/ToolCallTag'
import SessionSelector from './SessionSelector'
import ChatSpinner from './Spinner'

import 'react-photo-view/dist/react-photo-view.css'

type ChatInterfaceProps = {
  canvasId: string
  session: Session | null
  sessionList: Session[]
  onClickNewChat: () => void
  onSessionChange: (sessionId: string) => void
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({
  canvasId,
  session,
  sessionList,
  onClickNewChat,
  onSessionChange,
}) => {
  useWebSocket(session?.id)

  const search = useSearch({ from: '/canvas/$id' }) as {
    sessionId: string
    init?: boolean
  }
  const searchSessionId = search.sessionId || ''
  const searchInit = search.init || false

  const [messages, setMessages] = useState<Message[]>([])
  const [prompt, setPrompt] = useState('')
  const [pending, setPending] = useState<PendingType>(
    searchInit ? 'text' : false
  )

  const sessionId = session?.id

  const sessionIdRef = useRef<string>(session?.id || nanoid())
  const [expandingToolCalls, setExpandingToolCalls] = useState<string[]>([])

  const scrollRef = useRef<HTMLDivElement>(null)
  const isAtBottomRef = useRef(false)

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({
        top: scrollRef.current!.scrollHeight,
        behavior: 'smooth',
      })
    }, 200)
  }, [])

  const handleDelta = (data: TEvents['Socket::Delta']) => {
    setPending('text')
    setMessages((prev) => {
      const last = prev.at(-1)
      if (last?.role == 'assistant' && last.content != null) {
        const lastMessage = structuredClone(last)
        if (lastMessage) {
          if (typeof lastMessage.content == 'string') {
            lastMessage.content += data.text
          } else if (
            lastMessage.content &&
            lastMessage.content.at(-1) &&
            lastMessage.content.at(-1)!.type === 'text'
          ) {
            ;(lastMessage.content.at(-1) as { text: string }).text += data.text
          }
          return [...prev.slice(0, -1), lastMessage]
        } else {
          return prev
        }
      } else {
        return [
          ...prev,
          {
            role: 'assistant',
            content: data.text,
          },
        ]
      }
    })
    scrollToBottom()
  }

  const handleToolCall = (data: TEvents['Socket::ToolCall']) => {
    setMessages((prev) => {
      console.log('👇tool_call event get', data)
      setExpandingToolCalls((prev) => [...prev, data.id])
      setPending('tool')
      return prev.concat({
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
  }

  const handleToolCallArguments = (
    data: TEvents['Socket::ToolCallArguments']
  ) => {
    setMessages((prev) => {
      const lastMessage = structuredClone(prev.at(-1))
      if (
        lastMessage?.role === 'assistant' &&
        lastMessage.tool_calls &&
        lastMessage.tool_calls.at(-1) &&
        lastMessage.tool_calls.at(-1)!.id == data.id
      ) {
        lastMessage.tool_calls.at(-1)!.function.arguments += data.text
        return prev.slice(0, -1).concat(lastMessage)
      }
      return prev
    })
    scrollToBottom()
  }

  const handleToolCallResult = (data: TEvents['Socket::ToolCallResult']) => {
    setMessages((prev) => {
      console.log('👇tool_call_result', data)
      return prev
    })
  }

  const handleImageGenerated = (data: TEvents['Socket::ImageGenerated']) => {
    console.log('⭐️dispatching image_generated', data)
    setPending('image')
  }

  const handleAllMessages = (data: TEvents['Socket::AllMessages']) => {
    setMessages(() => {
      console.log('👇all_messages', data.messages)
      return data.messages
    })
    scrollToBottom()
  }

  const handleDone = () => {
    setPending(false)
    scrollToBottom()
  }

  const handleError = (data: TEvents['Socket::Error']) => {
    setPending(false)
    toast.error('Error: ' + data.error, {
      closeButton: true,
      duration: 3600 * 1000, // set super large duration to make it not auto dismiss
      style: {
        color: 'red',
      },
    })
  }

  const handleInfo = (data: TEvents['Socket::Info']) => {
    toast.info(data.info, {
      closeButton: true,
      duration: 10 * 1000,
    })
  }

  useEffect(() => {
    const handleScroll = () => {
      if (scrollRef.current) {
        isAtBottomRef.current =
          scrollRef.current.scrollHeight - scrollRef.current.scrollTop <=
          scrollRef.current.clientHeight
      }
    }
    const scrollEl = scrollRef.current
    scrollEl?.addEventListener('scroll', handleScroll)

    eventBus.on('Socket::Delta', handleDelta)
    eventBus.on('Socket::ToolCall', handleToolCall)
    eventBus.on('Socket::ToolCallArguments', handleToolCallArguments)
    eventBus.on('Socket::ToolCallResult', handleToolCallResult)
    eventBus.on('Socket::ImageGenerated', handleImageGenerated)
    eventBus.on('Socket::AllMessages', handleAllMessages)
    eventBus.on('Socket::Done', handleDone)
    eventBus.on('Socket::Error', handleError)
    eventBus.on('Socket::Info', handleInfo)
    return () => {
      scrollEl?.removeEventListener('scroll', handleScroll)

      eventBus.off('Socket::Delta', handleDelta)
      eventBus.off('Socket::ToolCall', handleToolCall)
      eventBus.off('Socket::ToolCallArguments', handleToolCallArguments)
      eventBus.off('Socket::ToolCallResult', handleToolCallResult)
      eventBus.off('Socket::ImageGenerated', handleImageGenerated)
      eventBus.off('Socket::AllMessages', handleAllMessages)
      eventBus.off('Socket::Done', handleDone)
      eventBus.off('Socket::Error', handleError)
      eventBus.off('Socket::Info', handleInfo)
    }
  })

  const initChat = useCallback(async () => {
    if (!sessionId) {
      return
    }

    sessionIdRef.current = sessionId

    const resp = await fetch('/api/chat_session/' + sessionId)
    const data = await resp.json()
    setMessages(data?.length ? data : [])

    scrollToBottom()
  }, [sessionId, scrollToBottom])

  useEffect(() => {
    initChat()
  }, [sessionId, initChat])

  const onSelectSession = (sessionId: string) => {
    onSessionChange(sessionId)
  }

  const onSendMessages = useCallback(
    (data: Message[], configs: { textModel: Model; imageModel: Model }) => {
      setPending('text')
      setMessages(data)
      setPrompt('')

      sendMessages({
        sessionId: sessionId!,
        canvasId: canvasId,
        newMessages: data,
        textModel: configs.textModel,
        imageModel: configs.imageModel,
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
      <div className="flex flex-col h-screen relative">
        {/* Chat messages */}

        <header className="flex px-2 py-2 absolute top-0 z-1 w-full">
          <SessionSelector
            session={session}
            sessionList={sessionList}
            onClickNewChat={onClickNewChat}
            onSelectSession={onSelectSession}
          />
          <Blur className="absolute top-0 left-0 right-0 h-full" />
        </header>

        <ScrollArea className="h-[calc(100vh-45px)]" viewportRef={scrollRef}>
          {messages.length > 0 ? (
            <div className="flex-1 px-4 space-y-6 pb-50 pt-15">
              {/* Messages */}
              {messages.map((message, idx) => (
                <div key={`${idx}`}>
                  {/* Regular message content */}
                  {typeof message.content == 'string' &&
                    (message.role !== 'tool' ? (
                      <MessageRegular
                        message={message}
                        content={message.content}
                      />
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
                        />
                      )
                    })}
                </div>
              ))}
              {pending && <ChatSpinner pending={pending} />}
            </div>
          ) : (
            <motion.div className="flex flex-col h-full p-4 items-start justify-start pt-16 select-none">
              <motion.span
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="text-muted-foreground text-3xl"
              >
                <ShinyText text="Hello, Jaaz!" />
              </motion.span>
              <motion.span
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="text-muted-foreground text-2xl"
              >
                <ShinyText text="How can I help you today?" />
              </motion.span>
            </motion.div>
          )}
        </ScrollArea>

        <div className="p-2 gap-2 sticky bottom-0">
          <ChatTextarea
            value={prompt}
            sessionId={sessionId!}
            pending={!!pending}
            messages={messages}
            onChange={setPrompt}
            onSendMessages={onSendMessages}
            onCancelChat={handleCancelChat}
          />
        </div>
      </div>
    </PhotoProvider>
  )
}

export default ChatInterface
