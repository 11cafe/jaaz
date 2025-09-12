import * as ISocket from '@/types/socket'
import { io, Socket } from 'socket.io-client'
import { eventBus } from './event'

export interface SocketConfig {
  serverUrl?: string
  autoConnect?: boolean
}

export class SocketIOManager {
  private socket: Socket | null = null
  private connected = false
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000

  constructor(private config: SocketConfig = {}) {
    if (config.autoConnect !== false) {
      this.connect()
    }
  }

  connect(serverUrl?: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const url = serverUrl || this.config.serverUrl

      if (this.socket) {
        this.socket.disconnect()
      }

      this.socket = io(url, {
        transports: ['websocket'],
        upgrade: false,
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: this.reconnectDelay,
      })

      this.socket.on('connect', () => {
        console.log('✅ Socket.IO connected:', this.socket?.id)
        this.connected = true
        this.reconnectAttempts = 0
        
        // 🔗 连接成功后自动注册session
        setTimeout(() => {
          this.autoRegisterSessionFromURL()
        }, 100) // 稍微延迟确保连接稳定
        
        resolve(true)
      })

      this.socket.on('connect_error', (error) => {
        console.error('❌ Socket.IO connection error:', error)
        this.connected = false
        this.reconnectAttempts++

        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          reject(
            new Error(
              `Failed to connect after ${this.maxReconnectAttempts} attempts`
            )
          )
        }
      })

      this.socket.on('disconnect', (reason) => {
        console.log('🔌 Socket.IO disconnected:', reason)
        this.connected = false
      })

      this.registerEventHandlers()
    })
  }

  private registerEventHandlers() {
    if (!this.socket) return

    this.socket.on('connected', (data) => {
      console.log('🔗 Socket.IO connection confirmed:', data)
    })

    this.socket.on('init_done', (data) => {
      console.log('🔗 Server initialization done:', data)
    })

    this.socket.on('session_update', (data) => {
      this.handleSessionUpdate(data)
    })

    this.socket.on('pong', (data) => {
      console.log('🔗 Pong received:', data)
    })

    this.socket.on('session_registered', (data) => {
      console.log('✅ [SOCKET_DEBUG] Session注册成功:', data)
    })

    this.socket.on('registration_failed', (data) => {
      console.error('❌ [SOCKET_DEBUG] Session注册失败:', data)
    })
  }

  private handleSessionUpdate(data: ISocket.SessionUpdateEvent) {
    const { session_id, type } = data

    if (!session_id) {
      console.warn('⚠️ Session update missing session_id:', data)
      return
    }

    switch (type) {
      case ISocket.SessionEventType.Delta:
        eventBus.emit('Socket::Session::Delta', data)
        break
      case ISocket.SessionEventType.ToolCall:
        eventBus.emit('Socket::Session::ToolCall', data)
        break
      case ISocket.SessionEventType.ToolCallPendingConfirmation:
        eventBus.emit('Socket::Session::ToolCallPendingConfirmation', data)
        break
      case ISocket.SessionEventType.ToolCallConfirmed:
        eventBus.emit('Socket::Session::ToolCallConfirmed', data)
        break
      case ISocket.SessionEventType.ToolCallCancelled:
        eventBus.emit('Socket::Session::ToolCallCancelled', data)
        break
      case ISocket.SessionEventType.ToolCallArguments:
        eventBus.emit('Socket::Session::ToolCallArguments', data)
        break
      case ISocket.SessionEventType.ToolCallProgress:
        eventBus.emit('Socket::Session::ToolCallProgress', data)
        break
      case ISocket.SessionEventType.ImageGenerated:
        eventBus.emit('Socket::Session::ImageGenerated', data)
        break
      case ISocket.SessionEventType.VideoGenerated:
        eventBus.emit('Socket::Session::VideoGenerated', data)
        break
      case ISocket.SessionEventType.AllMessages:
        eventBus.emit('Socket::Session::AllMessages', data)
        break
      case ISocket.SessionEventType.Done:
        eventBus.emit('Socket::Session::Done', data)
        break
      case ISocket.SessionEventType.Error:
        eventBus.emit('Socket::Session::Error', data)
        break
      case ISocket.SessionEventType.Info:
        eventBus.emit('Socket::Session::Info', data)
        break
      case ISocket.SessionEventType.ToolCallResult:
        eventBus.emit('Socket::Session::ToolCallResult', data)
        break
      case ISocket.SessionEventType.UserImages:
        eventBus.emit('Socket::Session::UserImages', data)
        break
      // 生成状态事件处理
      case ISocket.SessionEventType.GenerationStarted:
        eventBus.emit('Socket::Session::GenerationStarted', data)
        break
      case ISocket.SessionEventType.GenerationProgress:
        eventBus.emit('Socket::Session::GenerationProgress', data)
        break
      case ISocket.SessionEventType.GenerationComplete:
        eventBus.emit('Socket::Session::GenerationComplete', data)
        break
      default:
        console.log('⚠️ Unknown session update type:', type)
    }
  }

  registerSession(sessionId: string, canvasId?: string) {
    if (this.socket && this.connected) {
      console.log('🔗 [SOCKET_DEBUG] 注册session到WebSocket:', { sessionId, canvasId })
      this.socket.emit('register_session', { session_id: sessionId, canvas_id: canvasId })
    } else {
      console.warn('⚠️ [SOCKET_DEBUG] 无法注册session: socket未连接')
    }
  }

  autoRegisterSessionFromURL() {
    try {
      const url = new URL(window.location.href)
      const sessionId = url.searchParams.get('sessionId')
      const canvasId = url.pathname.includes('/canvas/') ? url.pathname.split('/canvas/')[1]?.split('?')[0] : undefined
      
      console.log('🔍 [SOCKET_DEBUG] 自动检测URL中的session信息:', { sessionId, canvasId, url: url.href })
      
      if (sessionId) {
        this.registerSession(sessionId, canvasId)
        console.log('✅ [SOCKET_DEBUG] 成功自动注册session')
      } else {
        console.log('ℹ️ [SOCKET_DEBUG] URL中没有sessionId，跳过自动注册')
      }
    } catch (error) {
      console.error('❌ [SOCKET_DEBUG] 自动注册session失败:', error)
    }
  }

  ping(data: unknown) {
    if (this.socket && this.connected) {
      this.socket.emit('ping', data)
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
      this.connected = false
      console.log('🔌 Socket.IO manually disconnected')
    }
  }

  isConnected(): boolean {
    return this.connected
  }

  getSocketId(): string | undefined {
    return this.socket?.id
  }

  getSocket(): Socket | null {
    return this.socket
  }

  getReconnectAttempts(): number {
    return this.reconnectAttempts
  }

  isMaxReconnectAttemptsReached(): boolean {
    return this.reconnectAttempts >= this.maxReconnectAttempts
  }
}
