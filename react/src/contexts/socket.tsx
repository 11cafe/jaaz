import { SocketIOManager } from '@/lib/socket'
import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface SocketContextType {
  connected: boolean
  socketId?: string
  connecting: boolean
  error?: string
  socketManager: SocketIOManager | null
}

const SocketContext = createContext<SocketContextType>({
  connected: false,
  connecting: false,
  socketManager: null,
})

interface SocketProviderProps {
  children: React.ReactNode
}

export const SocketProvider: React.FC<SocketProviderProps> = ({ children }) => {
  const { t } = useTranslation()
  const [connected, setConnected] = useState(false)
  const [socketId, setSocketId] = useState<string>()
  const [connecting, setConnecting] = useState(true)
  const [error, setError] = useState<string>()

  // Use useRef to maintain socket manager instance across re-renders
  const socketManagerRef = useRef<SocketIOManager | null>(null)

  useEffect(() => {
    let mounted = true

    const initializeSocket = async () => {
      try {
        setConnecting(true)
        setError(undefined)

        // Create socket manager instance if not exists
        if (!socketManagerRef.current) {
          socketManagerRef.current = new SocketIOManager({
            serverUrl: process.env.NODE_ENV === 'development'
              ? 'http://localhost:8088'
              : window.location.origin,
            autoConnect: false
          })
        }

        const socketManager = socketManagerRef.current
        await socketManager.connect()

        if (mounted) {
          setConnected(true)
          setSocketId(socketManager.getSocketId())
          setConnecting(false)
          console.log('🚀 Socket.IO initialized successfully')

          const socket = socketManager.getSocket()
          if (socket) {
            const handleConnect = () => {
              if (mounted) {
                setConnected(true)
                setSocketId(socketManager.getSocketId())
                setConnecting(false)
                setError(undefined)
              }
            }

            const handleDisconnect = () => {
              if (mounted) {
                setConnected(false)
                setSocketId(undefined)
                setConnecting(false)
              }
            }

            const handleConnectError = (error: Error) => {
              if (mounted) {
                setError(error.message || '❌ Socket.IO Connection Error')
                setConnected(false)
                setConnecting(false)
              }
            }

            socket.on('connect', handleConnect)
            socket.on('disconnect', handleDisconnect)
            socket.on('connect_error', handleConnectError)

            return () => {
              socket.off('connect', handleConnect)
              socket.off('disconnect', handleDisconnect)
              socket.off('connect_error', handleConnectError)
            }
          }
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Unknown error')
          setConnected(false)
          setConnecting(false)
          console.error('❌ Failed to initialize Socket.IO:', err)
        }
      }
    }

    initializeSocket()

    return () => {
      mounted = false
      // Clean up socket connection when component unmounts
      if (socketManagerRef.current) {
        socketManagerRef.current.disconnect()
        socketManagerRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    console.log('📢 Notification manager initialized')
  }, [])

  const value: SocketContextType = {
    connected,
    socketId,
    connecting,
    error,
    socketManager: socketManagerRef.current,
  }

  return (
    <SocketContext.Provider value={value}>
      {children}

      {error && (
        <div className="fixed top-4 right-4 z-50 bg-red-500 text-white px-3 py-2 rounded-md shadow-lg">
          {socketManagerRef.current?.isMaxReconnectAttemptsReached()
            ? t('socket.maxRetriesReached')
            : t('socket.connectionError', {
              current: socketManagerRef.current?.getReconnectAttempts() || 0,
              max: 5,
              error
            })}
        </div>
      )}
    </SocketContext.Provider>
  )
}
