import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useNotifications } from '@/hooks/use-notifications'
import { eventBus, TEvents } from '@/lib/event'
import { cn } from '@/lib/utils'
import { useLocation, useNavigate } from '@tanstack/react-router'
import {
  Bell,
  CheckCheck,
  CheckCircle,
  CircleX,
  ImageIcon,
  InfoIcon,
  MessageSquare,
  X,
} from 'lucide-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

export const NotificationPanel: React.FC = () => {
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearNotifications,
  } = useNotifications()
  const { t } = useTranslation()
  const location = useLocation()
  const sessionId = (location.search as { sessionId?: string }).sessionId

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'canvas_update':
        return <ImageIcon className="w-4 h-4" />
      case 'session_done':
        return <MessageSquare className="w-4 h-4" />
      case 'error':
        return <CircleX className="w-4 h-4" />
      case 'info':
        return <InfoIcon className="w-4 h-4" />
      case 'success':
        return <CheckCircle className="w-4 h-4" />
      default:
        return <InfoIcon className="w-4 h-4" />
    }
  }

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'canvas_update':
        return 'border-l-blue-500'
      case 'session_done':
        return 'border-l-green-500'
      case 'error':
        return 'border-l-red-500'
      case 'info':
        return 'border-l-yellow-500'
      case 'success':
        return 'border-l-green-500'
      default:
        return 'border-l-gray-500'
    }
  }

  const navigate = useNavigate()

  const handleError = (data: TEvents['Socket::Session::Error']) => {
    // Only show error if it's not the current session
    if (data.session_id === sessionId) {
      return
    }

    toast.error('Error: ' + data.error, {
      closeButton: true,
      duration: 3600 * 1000,
      style: { color: 'red' },
    })
  }

  useEffect(() => {
    eventBus.on('Socket::Session::Error', handleError)

    return () => {
      eventBus.off('Socket::Session::Error', handleError)
    }
  })

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="relative">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 select-none" align="end">
        <div className="flex items-center justify-between pl-3.5 pr-2 py-2 border-b">
          <span className="font-semibold">{t('notifications.title')}</span>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={markAllAsRead}
                className="text-xs"
              >
                <CheckCheck className="w-4 h-4 mr-1" />
                {t('notifications.markAllAsRead')}
              </Button>
            )}
            {notifications.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearNotifications}
                className="text-xs"
              >
                {t('notifications.clear')}
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        <ScrollArea className="h-96 w-full">
          {notifications.length === 0 ? (
            <div className="flex flex-col text-center text-primary justify-center items-center h-96">
              <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
            </div>
          ) : (
            <div>
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    'p-3 border-l-4 mb-2 cursor-pointer rounded-r transition-colors hover:bg-gray-50',
                    getNotificationColor(notification.type),
                    !notification.read && 'bg-blue-50/50'
                  )}
                  onClick={() => {
                    markAsRead(notification.id)
                    if (notification.canvasId) {
                      navigate({
                        to: '/canvas/$id',
                        params: { id: notification.canvasId },
                        search: { sessionId: notification.sessionId },
                      })
                    }
                  }}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-3">
                      {notification.imageUrl ? (
                        <img
                          src={notification.imageUrl}
                          alt="notification"
                          className="w-10 h-10 rounded-md"
                        />
                      ) : (
                        <span className="text-lg flex-shrink-0">
                          {getNotificationIcon(notification.type)}
                        </span>
                      )}

                      <div className="flex flex-col items-start">
                        <span
                          className={cn(
                            'font-medium text-sm',
                            !notification.read && 'text-blue-900'
                          )}
                        >
                          {notification.title}
                        </span>

                        <div className="flex-1 min-w-0 flex items-center gap-1 mt-1">
                          {!notification.read && (
                            <div className="size-2 bg-blue-500 rounded-full flex-shrink-0" />
                          )}

                          <p className="text-xs text-gray-600">
                            {notification.message}
                          </p>
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-gray-400">
                      {notification.timestamp.toLocaleString().split(' ')[1]}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
