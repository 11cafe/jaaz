import { eventBus } from '@/lib/event'
import { useCallback, useEffect, useRef } from 'react'

export const useWebSocket = (sessionId?: string) => {
  const webSocketRef = useRef<WebSocket | null>(null)

  const initWebSocket = useCallback(async () => {
    if (webSocketRef.current) {
      webSocketRef.current.close()
    }

    if (!sessionId) {
      return
    }

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsHost = window.location.host
    const wsUrl = `${wsProtocol}//${wsHost}/ws?session_id=${sessionId}`

    const socket = new WebSocket(wsUrl)
    webSocketRef.current = socket

    socket.onopen = () => {
      console.log('Connected to WebSocket server')
    }
    socket.onclose = () => {
      console.log('Disconnected from WebSocket server')
    }
    socket.onerror = (event) => {
      console.error('WebSocket error:', event)
    }
    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type == 'error') {
          eventBus.emit('Socket::Error', data.error)
        } else if (data.type == 'done') {
          eventBus.emit('Socket::Done')
        } else if (data.type == 'info') {
          eventBus.emit('Socket::Info', data.info)
        } else if (data.type == 'image_generated') {
          eventBus.emit('Socket::ImageGenerated', data.image_data)
        } else if (data.type == 'delta') {
          eventBus.emit('Socket::Delta', data)
        } else if (data.type == 'tool_call') {
          eventBus.emit('Socket::ToolCall', data)
        } else if (data.type == 'tool_call_arguments') {
          eventBus.emit('Socket::ToolCallArguments', data)
        } else if (data.type == 'tool_call_result') {
          eventBus.emit('Socket::ToolCallResult', data)
        } else if (data.type == 'all_messages') {
          eventBus.emit('Socket::AllMessages', data)
        }
      } catch (error) {
        console.error('Error parsing JSON:', error)
      }
    }
  }, [sessionId])

  useEffect(() => {
    if (sessionId) {
      initWebSocket()
    }
  }, [sessionId, initWebSocket])
}
