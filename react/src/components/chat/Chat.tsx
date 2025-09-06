import { sendMessages } from '@/api/chat'
import Blur from '@/components/common/Blur'
import { ScrollArea } from '@/components/ui/scroll-area'
import { eventBus, TEvents } from '@/lib/event'
import ChatMagicGenerator from './ChatMagicGenerator'
import { AssistantMessage, Message, Model, PendingType, Session } from '@/types/types'
import { useSearch } from '@tanstack/react-router'
import { produce } from 'immer'
import { motion } from 'motion/react'
import { nanoid } from 'nanoid'
import { Dispatch, SetStateAction, useCallback, useEffect, useRef, useState } from 'react'
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
import MixedContent, { MixedContentImages, MixedContentText } from './Message/MixedContent'

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

  const [messages, setMessages] = useState<Message[]>([])
  const [pending, setPending] = useState<PendingType>(false) // 不再基于initCanvas设置初始状态
  const [hasDisplayedInitialMessage, setHasDisplayedInitialMessage] = useState(false)
  const mergedToolCallIds = useRef<string[]>([])
  const pendingTimeoutRef = useRef<NodeJS.Timeout>()
  const hasDisplayedInitialMessageRef = useRef(false)
  const currentMessagesRef = useRef<Message[]>([])

  const sessionId = session?.id ?? searchSessionId

  // 同步状态到ref
  useEffect(() => {
    hasDisplayedInitialMessageRef.current = hasDisplayedInitialMessage
  }, [hasDisplayedInitialMessage])

  useEffect(() => {
    currentMessagesRef.current = messages
  }, [messages])

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


  const sessionIdRef = useRef<string>(session?.id || nanoid())
  const [expandingToolCalls, setExpandingToolCalls] = useState<string[]>([])
  const [pendingToolConfirmations, setPendingToolConfirmations] = useState<string[]>([])

  const scrollRef = useRef<HTMLDivElement>(null)
  const isAtBottomRef = useRef(true) // 初始默认在底部
  const isUserScrollingRef = useRef(false) // 跟踪用户是否在手动滚动

  const checkIfAtBottom = useCallback(() => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
      const threshold = 50 // 50px的阈值，更宽容的底部检测
      const atBottom = scrollHeight - scrollTop - clientHeight < threshold
      isAtBottomRef.current = atBottom
      console.log('[debug] 滚动位置检查:', { atBottom, scrollTop, scrollHeight, clientHeight })
      return atBottom
    }
    return false
  }, [])

  const scrollToBottom = useCallback(() => {
    // 只有在用户在底部或者是新消息时才自动滚动
    if (isAtBottomRef.current && !isUserScrollingRef.current) {
      setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTo({
            top: scrollRef.current.scrollHeight,
            behavior: 'smooth',
          })
          console.log('[debug] 自动滚动到底部')
        }
      }, 100) // 减少延迟以提供更好的响应性
    } else {
      console.log('[debug] 跳过自动滚动 - 用户不在底部或正在滚动')
    }
  }, [])

  const forceScrollToBottom = useCallback(() => {
    // 强制滚动到底部，用于用户发送消息时
    setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTo({
          top: scrollRef.current.scrollHeight,
          behavior: 'smooth',
        })
        isAtBottomRef.current = true
        console.log('[debug] 强制滚动到底部')
      }
    }, 100)
  }, [])

  // 立即检查并显示初始用户消息 - 组件挂载时就检查
  useEffect(() => {
    console.log('[debug] 组件挂载，检查初始消息')
    
    const checkAndDisplayInitialMessage = () => {
      const initialMessageData = localStorage.getItem('initial_user_message')
      if (initialMessageData && !hasDisplayedInitialMessage) {
        try {
          const { sessionId: storedSessionId, message, timestamp } = JSON.parse(initialMessageData)
          
          console.log('[debug] 发现初始消息:', { 
            storedSessionId, 
            currentSearchSessionId: searchSessionId,
            messageContent: message 
          })
          
          // 检查timestamp是否在5分钟内，更宽松的session匹配
          if (Date.now() - timestamp < 5 * 60 * 1000) {
            // 如果searchSessionId匹配或者还没有sessionId，就显示消息
            if (!searchSessionId || storedSessionId === searchSessionId) {
              console.log('[debug] ✅ 立即显示初始用户消息:', {
                role: message.role,
                content: message.content,
                contentType: typeof message.content,
                isArray: Array.isArray(message.content)
              })
              setMessages([message])
              setHasDisplayedInitialMessage(true)
              
              // 延迟显示等待状态，让用户先看到自己的消息
              pendingTimeoutRef.current = setTimeout(() => {
                setPending('text')
              }, 300)
              
              // 多次尝试滚动确保成功
              setTimeout(() => forceScrollToBottom(), 50)
              setTimeout(() => forceScrollToBottom(), 200)
              setTimeout(() => forceScrollToBottom(), 500)
              
              // 延迟清除localStorage，给后端推送时间
              setTimeout(() => {
                localStorage.removeItem('initial_user_message')
              }, 2000)
              return true
            }
          } else {
            console.log('[debug] 初始消息已过期，清理')
            localStorage.removeItem('initial_user_message')
          }
        } catch (error) {
          console.error('[debug] 解析初始消息失败:', error)
          localStorage.removeItem('initial_user_message')
        }
      }
      return false
    }

    // 立即检查一次
    const displayed = checkAndDisplayInitialMessage()
    
    // 如果没有显示，等待一小段时间再检查一次（防止sessionId延迟）
    if (!displayed && !hasDisplayedInitialMessage) {
      const timeoutId = setTimeout(() => {
        checkAndDisplayInitialMessage()
      }, 200)
      
      return () => clearTimeout(timeoutId)
    }
  }, [searchSessionId, hasDisplayedInitialMessage, forceScrollToBottom])

  // 当sessionId变化时也检查一次（兜底逻辑）
  useEffect(() => {
    if (!hasDisplayedInitialMessage && sessionId) {
      const initialMessageData = localStorage.getItem('initial_user_message')
      if (initialMessageData) {
        try {
          const { sessionId: storedSessionId, message, timestamp } = JSON.parse(initialMessageData)
          
          if (storedSessionId === sessionId && Date.now() - timestamp < 5 * 60 * 1000) {
            console.log('[debug] 兜底显示初始用户消息:', {
              role: message.role,
              content: typeof message.content === 'string' ? message.content.substring(0, 50) + '...' : 'complex content'
            })
            setMessages([message])
            setHasDisplayedInitialMessage(true)
            
            // 延迟显示等待状态，让用户先看到自己的消息
            pendingTimeoutRef.current = setTimeout(() => {
              setPending('text')
            }, 300)
            
            // 多次尝试滚动确保成功
            setTimeout(() => forceScrollToBottom(), 50)
            setTimeout(() => forceScrollToBottom(), 200)
            
            // 延迟清除localStorage，给后端推送时间
            setTimeout(() => {
              localStorage.removeItem('initial_user_message')
            }, 2000)
          }
        } catch (error) {
          console.error('[debug] 兜底解析失败:', error)
          setTimeout(() => {
            localStorage.removeItem('initial_user_message')
          }, 1000)
        }
      }
    }
  }, [sessionId, hasDisplayedInitialMessage, forceScrollToBottom])

  // 监听messages变化，确保用户消息显示后立即滚动
  useEffect(() => {
    if (messages.length > 0 && hasDisplayedInitialMessage) {
      console.log('[debug] 消息列表已更新，确保滚动到底部')
      // 延迟一点确保DOM已更新
      setTimeout(() => {
        forceScrollToBottom()
      }, 100)
    }
  }, [messages, hasDisplayedInitialMessage, forceScrollToBottom])

  // 清理函数
  useEffect(() => {
    return () => {
      if (pendingTimeoutRef.current) {
        clearTimeout(pendingTimeoutRef.current)
      }
    }
  }, [])

  const mergeToolCallResult = (messages: Message[]) => {
    // 修复：基于消息ID去重，而不是内容去重，避免误删相同内容的不同消息
    const uniqueMessages = messages.filter((message, index, arr) => {
      // 如果消息有message_id，基于ID去重
      const messageWithId = message as Message & { message_id?: string }
      if (messageWithId.message_id) {
        const isDuplicate = arr.slice(0, index).some((prevMessage) => {
          const prevMessageWithId = prevMessage as Message & { message_id?: string }
          return prevMessageWithId.message_id === messageWithId.message_id
        })
        return !isDuplicate
      }
      
      // 对于没有message_id的消息（兼容旧数据），只对工具调用消息进行去重
      if (message.role === 'tool') {
        const toolMessage = message as Message & { tool_call_id?: string }
        const isDuplicate = arr.slice(0, index).some((prevMessage) => {
          const prevToolMessage = prevMessage as Message & { tool_call_id?: string }
          return prevMessage.role === 'tool' && 
                 prevToolMessage.tool_call_id === toolMessage.tool_call_id &&
                 JSON.stringify(prevMessage.content) === JSON.stringify(message.content)
        })
        return !isDuplicate
      }
      
      // 用户消息和助手消息不进行内容去重，允许重复内容
      return true
    })

    console.log('[debug] 消息去重：原始', messages.length, '去重后', uniqueMessages.length)

    const messagesWithToolCallResult = uniqueMessages.map((message, index) => {
      if (message.role === 'assistant' && message.tool_calls) {
        for (const toolCall of message.tool_calls) {
          // From the next message, find the tool call result
          for (let i = index + 1; i < uniqueMessages.length; i++) {
            const nextMessage = uniqueMessages[i]
            if (nextMessage.role === 'tool' && nextMessage.tool_call_id === toolCall.id) {
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
    (data: TEvents['Socket::Session::Delta']) => {
      if (data.session_id && data.session_id !== sessionId) {
        return
      }

      setPending('text')
      setMessages(
        produce((prev) => {
          const last = prev.at(-1)
          // 确保只有当最后一条消息是assistant且没有tool_calls时才追加内容
          if (last?.role === 'assistant' && last.content != null && !last.tool_calls) {
            if (typeof last.content === 'string') {
              last.content += data.text
            } else if (
              Array.isArray(last.content) &&
              last.content.length > 0 &&
              last.content.at(-1)?.type === 'text'
            ) {
              ;(last.content.at(-1) as { text: string }).text += data.text
            } else {
              // 如果最后一条内容不是文本，添加新的文本内容
              if (Array.isArray(last.content)) {
                last.content.push({ type: 'text', text: data.text })
              } else {
                last.content = data.text
              }
            }
          } else {
            // 创建新的assistant消息
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
    (data: TEvents['Socket::Session::ToolCall']) => {
      if (data.session_id && data.session_id !== sessionId) {
        return
      }

      const existToolCall = messages.find(
        (m) => m.role === 'assistant' && m.tool_calls && m.tool_calls.find((t) => t.id == data.id)
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
    [sessionId]
  )

  const handleToolCallPendingConfirmation = useCallback(
    (data: TEvents['Socket::Session::ToolCallPendingConfirmation']) => {
      if (data.session_id && data.session_id !== sessionId) {
        return
      }

      const existToolCall = messages.find(
        (m) => m.role === 'assistant' && m.tool_calls && m.tool_calls.find((t) => t.id == data.id)
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
    [sessionId]
  )

  const handleToolCallConfirmed = useCallback(
    (data: TEvents['Socket::Session::ToolCallConfirmed']) => {
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
    (data: TEvents['Socket::Session::ToolCallCancelled']) => {
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
    (data: TEvents['Socket::Session::ToolCallArguments']) => {
      if (data.session_id && data.session_id !== sessionId) {
        return
      }

      setMessages(
        produce((prev) => {
          setPending('tool')
          const lastMessage = prev.find(
            (m) =>
              m.role === 'assistant' && m.tool_calls && m.tool_calls.find((t) => t.id == data.id)
          ) as AssistantMessage

          if (lastMessage) {
            const toolCall = lastMessage.tool_calls!.find((t) => t.id == data.id)
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
    (data: TEvents['Socket::Session::ToolCallResult']) => {
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
    (data: TEvents['Socket::Session::ImageGenerated']) => {
      if (data.canvas_id && data.canvas_id !== canvasId && data.session_id !== sessionId) {
        return
      }

      console.log('⭐️dispatching image_generated', data)
      setPending('image')
    },
    [canvasId, sessionId]
  )

  const handleUserImages = useCallback(
    (data: TEvents['Socket::Session::UserImages']) => {
      if (data.session_id && data.session_id !== sessionId) {
        return
      }

      console.log('📸 接收到用户图片', data.message)
      
      // 将用户图片消息添加到消息列表
      setMessages(produce((prev) => {
        prev.push({
          role: 'user',
          content: data.message.content,
        })
      }))
      
      scrollToBottom()
    },
    [sessionId, scrollToBottom]
  )

  const handleAllMessages = useCallback(
    (data: TEvents['Socket::Session::AllMessages']) => {
      if (data.session_id && data.session_id !== sessionId) {
        return
      }

      console.log('[debug] 收到所有消息，数量:', data.messages?.length || 0)
      console.log('[debug] 当前前端消息数量:', messages.length)
      console.log('[debug] 已显示初始消息:', hasDisplayedInitialMessage)
      
      const processedMessages = mergeToolCallResult(data.messages)
      
      // 如果已经显示了初始用户消息，且后端消息为空，则不覆盖
      if (hasDisplayedInitialMessage && processedMessages.length === 0 && messages.length > 0) {
        console.log('[debug] 🚫 阻止空消息覆盖用户初始消息')
        return
      }
      
      // 如果已显示初始消息，且后端消息不包含用户消息，则合并
      if (hasDisplayedInitialMessage && messages.length > 0) {
        const hasUserMessage = processedMessages.some(msg => msg.role === 'user')
        if (!hasUserMessage) {
          console.log('[debug] 🔄 合并用户初始消息和后端消息')
          const mergedMessages = [...messages, ...processedMessages]
          setMessages(mergedMessages)
          scrollToBottom()
          return
        }
      }
      
      console.log('[debug] 📝 直接设置后端消息')
      setMessages(processedMessages)
      scrollToBottom()
    },
    [sessionId, scrollToBottom, messages, hasDisplayedInitialMessage]
  )

  const handleDone = useCallback(
    (data: TEvents['Socket::Session::Done']) => {
      if (data.session_id && data.session_id !== sessionId) {
        return
      }

      console.log('[debug] === 聊天完成 ===')
      setPending(false)
      scrollToBottom()

      // 聊天输出完毕后更新余额
      if (authStatus.is_logged_in) {
        queryClient.invalidateQueries({ queryKey: ['balance'] })
        console.log('[debug] 余额查询已刷新')
      }
    },
    [sessionId, scrollToBottom, authStatus.is_logged_in, queryClient]
  )

  const handleError = useCallback((data: TEvents['Socket::Session::Error']) => {
    setPending(false)
    toast.error('Error: ' + data.error, {
      closeButton: true,
      duration: 3600 * 1000,
      style: { color: 'red' },
    })
  }, [])

  const handleInfo = useCallback((data: TEvents['Socket::Session::Info']) => {
    toast.info(data.info, {
      closeButton: true,
      duration: 10 * 1000,
    })
  }, [])

  useEffect(() => {
    let scrollTimeout: NodeJS.Timeout
    
    const handleScroll = () => {
      // 标记用户正在滚动
      isUserScrollingRef.current = true
      
      // 检查是否在底部
      checkIfAtBottom()
      
      // 清除之前的定时器
      clearTimeout(scrollTimeout)
      
      // 延迟重置滚动状态，给滚动动画时间完成
      scrollTimeout = setTimeout(() => {
        isUserScrollingRef.current = false
        console.log('[debug] 用户滚动结束')
      }, 150)
    }
    
    const scrollEl = scrollRef.current
    scrollEl?.addEventListener('scroll', handleScroll, { passive: true })

    eventBus.on('Socket::Session::Delta', handleDelta)
    eventBus.on('Socket::Session::ToolCall', handleToolCall)
    eventBus.on('Socket::Session::ToolCallPendingConfirmation', handleToolCallPendingConfirmation)
    eventBus.on('Socket::Session::ToolCallConfirmed', handleToolCallConfirmed)
    eventBus.on('Socket::Session::ToolCallCancelled', handleToolCallCancelled)
    eventBus.on('Socket::Session::ToolCallArguments', handleToolCallArguments)
    eventBus.on('Socket::Session::ToolCallResult', handleToolCallResult)
    eventBus.on('Socket::Session::ImageGenerated', handleImageGenerated)
    eventBus.on('Socket::Session::UserImages', handleUserImages)
    eventBus.on('Socket::Session::AllMessages', handleAllMessages)
    eventBus.on('Socket::Session::Done', handleDone)
    eventBus.on('Socket::Session::Error', handleError)
    eventBus.on('Socket::Session::Info', handleInfo)
    return () => {
      scrollEl?.removeEventListener('scroll', handleScroll)
      clearTimeout(scrollTimeout)

      eventBus.off('Socket::Session::Delta', handleDelta)
      eventBus.off('Socket::Session::ToolCall', handleToolCall)
      eventBus.off(
        'Socket::Session::ToolCallPendingConfirmation',
        handleToolCallPendingConfirmation
      )
      eventBus.off('Socket::Session::ToolCallConfirmed', handleToolCallConfirmed)
      eventBus.off('Socket::Session::ToolCallCancelled', handleToolCallCancelled)
      eventBus.off('Socket::Session::ToolCallArguments', handleToolCallArguments)
      eventBus.off('Socket::Session::ToolCallResult', handleToolCallResult)
      eventBus.off('Socket::Session::ImageGenerated', handleImageGenerated)
      eventBus.off('Socket::Session::UserImages', handleUserImages)
      eventBus.off('Socket::Session::AllMessages', handleAllMessages)
      eventBus.off('Socket::Session::Done', handleDone)
      eventBus.off('Socket::Session::Error', handleError)
      eventBus.off('Socket::Session::Info', handleInfo)
    }
  })

  const initChat = useCallback(async () => {
    if (!sessionId) {
      return
    }

    console.log('[debug] 初始化聊天，sessionId:', sessionId)
    console.log('[debug] 当前消息数量:', currentMessagesRef.current.length)
    console.log('[debug] 已显示初始消息:', hasDisplayedInitialMessageRef.current)
    
    sessionIdRef.current = sessionId

    try {
      const resp = await fetch('/api/chat_session/' + sessionId)
      const data = await resp.json()
      const msgs = data?.length ? data : []

      console.log('[debug] 加载历史消息，数量:', msgs.length)
      
      // 如果已经显示了初始用户消息，且历史消息为空或者历史消息不包含用户消息，则不覆盖
      if (hasDisplayedInitialMessageRef.current && currentMessagesRef.current.length > 0) {
        if (msgs.length === 0) {
          console.log('[debug] 🚫 已显示初始消息且历史为空，跳过覆盖')
          return
        }
        
        const hasUserInHistory = msgs.some((msg: Message) => msg.role === 'user')
        if (!hasUserInHistory) {
          console.log('[debug] 🔄 历史消息不含用户消息，合并显示')
          const processedMessages = mergeToolCallResult(msgs)
          const mergedMessages = [...currentMessagesRef.current, ...processedMessages]
          setMessages(mergedMessages)
          forceScrollToBottom()
          return
        }
      }
      
      // 正常情况：设置历史消息
      const processedMessages = mergeToolCallResult(msgs)
      setMessages(processedMessages)
      
      if (msgs.length > 0) {
        setInitCanvas(false)
        // 如果有历史消息，滚动到底部
        forceScrollToBottom()
      }
    } catch (error) {
      console.error('[debug] 初始化聊天失败:', error)
    }
  }, [sessionId, forceScrollToBottom, setInitCanvas])

  useEffect(() => {
    initChat()
  }, [sessionId, initChat])

  const onSelectSession = (sessionId: string) => {
    setSession(sessionList.find((s) => s.id === sessionId) || null)
    window.history.pushState({}, '', `/canvas/${canvasId}?sessionId=${sessionId}`)
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
    (data: Message[], modelName: string) => {
      console.log('[debug] === 开始发送消息 ===')
      const startTime = performance.now()
      
      console.log('[debug] 消息数量:', data.length)
      console.log('[debug] 选择的模型:', modelName)
      
      setPending('text')
      setMessages(data)

      // Ensure we have a valid sessionId
      const effectiveSessionId = sessionId || sessionIdRef.current || nanoid()
      
      const sendStart = performance.now()
      sendMessages({
        sessionId: effectiveSessionId,
        canvasId: canvasId,
        newMessages: data,
        modelName: modelName,
        systemPrompt: localStorage.getItem('system_prompt') || DEFAULT_SYSTEM_PROMPT,
      })
      console.log(`[debug] API调用耗时: ${(performance.now() - sendStart).toFixed(2)}ms`)

      if (searchSessionId !== effectiveSessionId) {
        window.history.pushState({}, '', `/canvas/${canvasId}?sessionId=${effectiveSessionId}`)
      }

      forceScrollToBottom() // 用户发送消息时强制滚动到底部
      console.log(`[debug] 消息发送总耗时: ${(performance.now() - startTime).toFixed(2)}ms`)
    },
    [canvasId, sessionId, searchSessionId, forceScrollToBottom]
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
              {messages.map((message, idx) => {
                console.log(`[debug] 渲染消息 ${idx}:`, {
                  role: message.role,
                  contentType: typeof message.content,
                  isArray: Array.isArray(message.content),
                  content: message.content
                })
                
                return (
                  <div key={`${idx}`} className='flex flex-col gap-4 mb-2'>
                    {/* 根据消息类型选择合适的渲染方式 */}
                    {message.role === 'tool' ? (
                      // Tool消息处理
                      message.tool_call_id && mergedToolCallIds.current.includes(message.tool_call_id) ? (
                        <></>
                      ) : (
                        <ToolCallContent expandingToolCalls={expandingToolCalls} message={message} />
                      )
                    ) : typeof message.content === 'string' ? (
                      // 字符串内容消息
                      <MessageRegular message={message} content={message.content} />
                    ) : Array.isArray(message.content) ? (
                      // 混合内容消息（文本+图片）
                      <>
                        <MixedContentImages contents={message.content} />
                        <MixedContentText message={message} contents={message.content} />
                      </>
                    ) : null}

                    {/* Tool calls for assistant messages */}
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
                                setExpandingToolCalls((prev) => [...prev, toolCall.id])
                              }
                            }}
                            requiresConfirmation={pendingToolConfirmations.includes(toolCall.id)}
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
                )
              })}
              {pending && <ChatSpinner pending={pending} />}
              {pending && sessionId && <ToolcallProgressUpdate sessionId={sessionId} />}
            </div>
          ) : (
            <motion.div className='flex flex-col h-full p-4 items-start justify-start pt-16 select-none'>
              <motion.span
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className='text-muted-foreground text-3xl'
              >
                <ShinyText text='你好，MagicArt!' />
              </motion.span>
              <motion.span
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className='text-muted-foreground text-2xl'
              >
                <ShinyText text='希望设计点什么呢?' />
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
            sessionId={sessionId || sessionIdRef.current || nanoid()}
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
