import { ToolInfo } from '@/api/model'
import { Message, Model } from '@/types/types'
import * as ISocket from '@/types/socket'

export function connectChatStream(
  sessionId: string,
  messages: Message[],
  is_new_session: boolean,
  canvasId: string,
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
  }: {
    handleDelta: (data: ISocket.SessionDeltaEvent) => void
    handleToolCall: (data: ISocket.SessionToolCallEvent) => void
    handleToolCallPendingConfirmation: (
      data: ISocket.SessionToolCallPendingConfirmationEvent
    ) => void
    handleToolCallConfirmed: (
      data: ISocket.SessionToolCallConfirmedEvent
    ) => void
    handleToolCallCancelled: (
      data: ISocket.SessionToolCallCancelledEvent
    ) => void
    handleToolCallArguments: (
      data: ISocket.SessionToolCallArgumentsEvent
    ) => void
    handleToolCallResult: (data: ISocket.SessionToolCallResultEvent) => void
    handleImageGenerated: (data: ISocket.SessionImageGeneratedEvent) => void
    handleVideoGenerated: (data: ISocket.SessionVideoGeneratedEvent) => void
    handleAllMessages: (data: ISocket.SessionAllMessagesEvent) => void
    handleDone: (data: ISocket.SessionDoneEvent) => void
    handleError: (data: ISocket.SessionErrorEvent) => void
  },
  configs?: {
    textModel?: Model
    toolList?: ToolInfo[]
    magic_configs?: { 
      screenshot_image?: string; 
      is_generate_video?: boolean 
    }
  } | null,
  lastEventId?: string | null
) {
  const header: HeadersInit = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
    'Cache-Control': 'no-cache',
  }
  if (lastEventId !== undefined) {
    header['Last-Event-Id'] = lastEventId ?? '0'
  }
  console.log('🟠connectChatStream', messages, configs, lastEventId)
  // 发送POST请求到SSE端点
  fetch('/api/chat/stream', {
    method: 'POST',
    headers: header,
    body: JSON.stringify({
      messages: messages,
      session_id: sessionId,
      is_new_session: is_new_session,
      canvas_id: canvasId,
      textModel: configs?.textModel,
      selectedTools: configs?.toolList,
      magic_configs: configs?.magic_configs,
    }),
  })
    .then(async (response) => {
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error('No reader available')
      }

      const readStream = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read()

            if (done) {
              console.log('✅ SSE stream completed')
              handleDone({
                type: ISocket.SessionEventType.Done,
                session_id: sessionId ?? '',
              })
              break
            }

            const chunk = decoder.decode(value, { stream: true })
            const lines = chunk.split('\n')

            for (const line of lines) {
              if (line.startsWith('event:')) {
                // 解析事件类型，但我们主要关注data行
                continue
              } else if (line.startsWith('data:')) {
                try {
                  const jsonStr = line.substring(5).trim()
                  if (jsonStr) {
                    const eventData = JSON.parse(jsonStr)

                    // 处理连接事件
                    if (eventData.status === 'connected') {
                      console.log('✅ SSE connected')
                      continue
                    }

                    // 处理完成事件
                    if (eventData.status === 'completed') {
                      console.log('✅ SSE stream completed')
                      handleDone({
                        type: ISocket.SessionEventType.Done,
                        session_id: sessionId,
                      })
                      continue
                    }

                    // 处理chunk事件
                    if (eventData.type && eventData.data) {
                      const chunkData = {
                        ...eventData.data,
                        session_id: eventData.sessionId,
                      }

                      // 根据事件类型分发到对应的处理函数
                      switch (eventData.type) {
                        case ISocket.SessionEventType.Delta:
                          handleDelta({
                            ...chunkData,
                            text: chunkData.text,
                          })
                          break
                        case ISocket.SessionEventType.ToolCall:
                          handleToolCall({
                            ...chunkData,
                            id: chunkData.id,
                            name: chunkData.name,
                          })
                          break
                        case ISocket.SessionEventType
                          .ToolCallPendingConfirmation:
                          handleToolCallPendingConfirmation({
                            ...chunkData,
                            id: chunkData.id,
                            name: chunkData.name,
                            arguments: chunkData.arguments,
                          })
                          break
                        case ISocket.SessionEventType.ToolCallConfirmed:
                          handleToolCallConfirmed({
                            ...chunkData,
                            id: chunkData.id,
                          })
                          break
                        case ISocket.SessionEventType.ToolCallCancelled:
                          handleToolCallCancelled({
                            ...chunkData,
                            id: chunkData.id,
                          })
                          break
                        case ISocket.SessionEventType.ToolCallArguments:
                          handleToolCallArguments({
                            ...chunkData,
                            id: chunkData.id,
                            text: chunkData.text,
                          })
                          break
                        case ISocket.SessionEventType.ToolCallResult:
                          handleToolCallResult({
                            ...chunkData,
                            id: chunkData.id,
                            message: chunkData.message,
                          })
                          break
                        case ISocket.SessionEventType.ImageGenerated:
                          handleImageGenerated({
                            ...chunkData,
                            canvas_id: chunkData.canvas_id,
                            image_url: chunkData.image_url,
                            element: chunkData.element,
                            file: chunkData.file,
                          })
                          break
                        case ISocket.SessionEventType.VideoGenerated:
                          handleVideoGenerated({
                            ...chunkData,
                            canvas_id: chunkData.canvas_id,
                            video_url: chunkData.video_url,
                            element: chunkData.element,
                            file: chunkData.file,
                          })
                          break
                        case ISocket.SessionEventType.AllMessages:
                          handleAllMessages({
                            ...chunkData,
                            messages: chunkData.messages,
                          })
                          break
                        case ISocket.SessionEventType.Done:
                          handleDone(chunkData)
                          break
                        case ISocket.SessionEventType.Error:
                          handleError({
                            ...chunkData,
                            error: chunkData.error,
                          })
                          break
                        default:
                          console.log(
                            '⚠️ Unhandled SSE event type:',
                            eventData.type
                          )
                      }
                    }

                    // 处理错误事件
                    if (eventData.error) {
                      handleError({
                        type: ISocket.SessionEventType.Error,
                        error: eventData.error,
                        session_id: eventData.sessionId,
                      })
                    }
                  }
                } catch (parseError) {
                  console.error(
                    'Error parsing SSE data:',
                    parseError,
                    'Raw line:',
                    line
                  )
                }
              }
            }
          }
        } catch (error) {
          console.error('❌ SSE stream error:', error)
          handleDone({
            type: ISocket.SessionEventType.Done,
            session_id: sessionId,
          })
          handleError({
            type: ISocket.SessionEventType.Error,
            error: 'SSE connection failed: ' + (error as Error).message,
            session_id: sessionId,
          })
        }
      }

      readStream()
    })
    .catch((error) => {
      console.error('❌ SSE fetch error:', error)
      handleDone({
        type: ISocket.SessionEventType.Done,
        session_id: sessionId,
      })
      handleError({
        type: ISocket.SessionEventType.Error,
        error: 'Failed to connect to stream: ' + (error as Error).message,
        session_id: sessionId,
      })
    })
}
